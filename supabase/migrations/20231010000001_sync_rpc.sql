-- Atomic Sync Upsert RPC
-- Safely applies updates only if the client's timestamp is >= the server's timestamp.
-- Returns the winning row and a status string.

CREATE OR REPLACE FUNCTION sync_upsert(
    p_table_name TEXT,
    p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_id TEXT;
    v_server_updated_at TIMESTAMP WITH TIME ZONE;
    v_client_updated_at TIMESTAMP WITH TIME ZONE;
    v_query TEXT;
    v_result JSONB;
    v_pk_col TEXT := 'id';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_table_name NOT IN ('semesters', 'subjects', 'timetable_rules', 'class_sessions', 'attendance_records', 'user_preferences', 'habits', 'habit_entries', 'deleted_records') THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table_name;
    END IF;

    IF p_table_name = 'user_preferences' THEN
        v_pk_col := 'key';
    END IF;

    v_id := p_payload->>v_pk_col;
    
    IF p_table_name = 'deleted_records' THEN
        v_client_updated_at := (p_payload->>'deleted_at')::TIMESTAMP WITH TIME ZONE;
    ELSE
        v_client_updated_at := (p_payload->>'updated_at')::TIMESTAMP WITH TIME ZONE;
    END IF;

    IF v_client_updated_at IS NULL THEN
        v_client_updated_at := now(); -- fallback
    END IF;

    -- Lock the row and get the current timestamp
    v_query := format('SELECT %I FROM %I WHERE %I = $1 AND user_id = $2 FOR UPDATE', 
                      CASE WHEN p_table_name = 'deleted_records' THEN 'deleted_at' ELSE 'updated_at' END,
                      p_table_name, v_pk_col);
    EXECUTE v_query INTO v_server_updated_at USING v_id, v_user_id;

    -- If this is an insert/update, ensure it hasn't been deleted by a newer tombstone
    IF p_table_name != 'deleted_records' THEN
        DECLARE
            v_tombstone_at TIMESTAMP WITH TIME ZONE;
        BEGIN
            EXECUTE 'SELECT deleted_at FROM deleted_records WHERE id = $1 AND table_name = $2 AND user_id = $3 FOR UPDATE'
            INTO v_tombstone_at USING v_id, p_table_name, v_user_id;

            IF v_tombstone_at IS NOT NULL AND v_tombstone_at > v_client_updated_at THEN
                -- Conflict: Server has a newer tombstone.
                RETURN jsonb_build_object(
                    'status', 'conflict', 
                    'data', jsonb_build_object('id', v_id, 'is_deleted', true)
                );
            END IF;
        END;
    END IF;

    IF v_server_updated_at IS NOT NULL AND v_server_updated_at > v_client_updated_at THEN
        -- Conflict: Server is newer. 
        EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND user_id = $2', p_table_name, v_pk_col)
        INTO v_result USING v_id, v_user_id;
        
        RETURN jsonb_build_object('status', 'conflict', 'data', v_result);
    END IF;

    -- Safe to Upsert. 
    -- Ensure user_id is set to the authenticated user safely
    p_payload := p_payload || jsonb_build_object('user_id', v_user_id);

    -- Dynamic INSERT ... ON CONFLICT
    -- We can extract the keys and values from the JSONB payload.
    -- PostgreSQL jsonb_populate_record is very handy.
    
    v_query := format(
        'INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1) ' ||
        'ON CONFLICT (%I%s) DO UPDATE SET ',
        p_table_name, p_table_name, v_pk_col,
        CASE WHEN p_table_name = 'user_preferences' OR p_table_name = 'deleted_records' THEN ', user_id' ELSE '' END
    );

    -- Build the SET clause for DO UPDATE
    SELECT string_agg(format('%I = EXCLUDED.%I', key, key), ', ')
    INTO v_query
    FROM jsonb_object_keys(p_payload) AS key
    WHERE key != v_pk_col;

    -- If there's only the PK in the payload (unlikely, but safe check)
    IF v_query IS NULL THEN
        v_query := format('INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1) ON CONFLICT ON CONSTRAINT %I DO NOTHING', 
            p_table_name, p_table_name, p_table_name || '_pkey');
    ELSE
        -- The v_query above didn't concatenate to the original string correctly because of how SELECT INTO works.
        -- Let's do it cleanly:
        DECLARE
            v_set_clause TEXT;
        BEGIN
            SELECT string_agg(format('%I = EXCLUDED.%I', key, key), ', ')
            INTO v_set_clause
            FROM jsonb_object_keys(p_payload) AS key
            WHERE key != v_pk_col AND key != 'user_id';
            
            v_query := format(
                'INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1) ' ||
                'ON CONFLICT ON CONSTRAINT %I DO UPDATE SET %s',
                p_table_name, p_table_name, p_table_name || '_pkey',
                v_set_clause
            );
        END;
    END IF;

    EXECUTE v_query USING p_payload;

    -- Return the upserted row
    EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND user_id = $2', p_table_name, v_pk_col)
    INTO v_result USING v_id, v_user_id;

    RETURN jsonb_build_object('status', 'success', 'data', v_result);
END;
$$;
