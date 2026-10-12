import { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // A simple migration table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS local_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  const result = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM local_metadata WHERE key = 'user_version'`
  );
  
  let currentDbVersion = result ? parseInt(result.value, 10) : 0;
  
  // Version 1 migrations
  if (currentDbVersion === 0) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      // 1. Semesters
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS semesters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1
        );
      `);

      // 2. Subjects
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          semester_id TEXT NOT NULL,
          name TEXT NOT NULL,
          code TEXT,
          color TEXT,
          has_theory INTEGER NOT NULL DEFAULT 1,
          has_practical INTEGER NOT NULL DEFAULT 0,
          target_percentage REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
        );
      `);

      // 3. Timetable Rules
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS timetable_rules (
          id TEXT PRIMARY KEY,
          semester_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          day_of_week INTEGER NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          component TEXT NOT NULL, -- 'theory', 'practical', 'none'
          is_attendance_bearing INTEGER NOT NULL DEFAULT 1,
          weight INTEGER NOT NULL DEFAULT 1,
          batch_constraint TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
          FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        );
      `);

      // 4. Week-off days
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS week_off_days (
          id TEXT PRIMARY KEY,
          semester_id TEXT NOT NULL,
          date TEXT NOT NULL, -- YYYY-MM-DD
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
        );
      `);

      // 5. Dated Class Sessions (Pending attendance inherently represented by a class session without an attendance record)
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS class_sessions (
          id TEXT PRIMARY KEY,
          semester_id TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          timetable_rule_id TEXT, -- Can be null for ad-hoc sessions
          date TEXT NOT NULL, -- YYYY-MM-DD
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          component TEXT NOT NULL,
          weight INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
          FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
          FOREIGN KEY (timetable_rule_id) REFERENCES timetable_rules(id) ON DELETE SET NULL
        );
      `);

      // 6. Attendance Records
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS attendance_records (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL, -- 'present', 'absent'
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE
        );
      `);

      // 7. Attendance Baselines
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS attendance_baselines (
          id TEXT PRIMARY KEY,
          subject_id TEXT NOT NULL,
          component TEXT NOT NULL,
          attended_weight INTEGER NOT NULL DEFAULT 0,
          conducted_weight INTEGER NOT NULL DEFAULT 0,
          attended INTEGER NOT NULL DEFAULT 0,
          conducted INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          UNIQUE(subject_id, component),
          FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        );
      `);

      // 8. Habits
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS habits (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT,
          color TEXT,
          frequency_type TEXT NOT NULL, -- 'daily', 'weekly'
          target_count INTEGER NOT NULL DEFAULT 1,
          start_date TEXT NOT NULL, -- YYYY-MM-DD
          reminder_time TEXT, -- HH:mm (optional)
          reminder_enabled INTEGER NOT NULL DEFAULT 0, -- 0 or 1
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1
        );
      `);

      try {
        await tx.execAsync(`ALTER TABLE habits ADD COLUMN start_date TEXT NOT NULL DEFAULT '1970-01-01';`);
        await tx.execAsync(`ALTER TABLE habits ADD COLUMN reminder_time TEXT;`);
        await tx.execAsync(`ALTER TABLE habits ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0;`);
      } catch (e) {}

      // Tombstones for local prevention of backup resurrection
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS deleted_records (
          id TEXT NOT NULL,
          table_name TEXT NOT NULL,
          deleted_at TEXT NOT NULL,
          PRIMARY KEY (id, table_name)
        );
      `);

      // 9. Habit Entries
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS habit_entries (
          id TEXT PRIMARY KEY,
          habit_id TEXT NOT NULL,
          date TEXT NOT NULL, -- YYYY-MM-DD
          count INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          UNIQUE(habit_id, date),
          FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
        );
      `);

      // 10. User Preferences
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1
        );
      `);

      // 11. Sync Outbox
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_outbox (
          id TEXT PRIMARY KEY,
          operation_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
          entity_type TEXT NOT NULL, -- e.g., 'attendance_records', 'habits'
          entity_id TEXT NOT NULL,
          payload TEXT, -- JSON serialization of the data (or null for DELETE)
          created_at TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'failed'
          error_info TEXT,
          claimed_at TEXT,
          claimed_by TEXT
        );
      `);
      
      try {
        await tx.execAsync(`ALTER TABLE sync_outbox ADD COLUMN claimed_at TEXT;`);
        await tx.execAsync(`ALTER TABLE sync_outbox ADD COLUMN claimed_by TEXT;`);
      } catch (e) {}

      // Set DB version to 1
      await tx.execAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('user_version', '1');`);
    });

    currentDbVersion = 1;
  }

  // Version 2 migrations
  if (currentDbVersion < 2) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      // 12. Holidays table
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS holidays (
          id TEXT PRIMARY KEY,
          semester_id TEXT NOT NULL,
          date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
          name TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
        );
      `);

      // Safe cleanup of demonstrably application-generated demo records:
      // Only remove if NO attendance records exist in the entire database
      const attCount = await tx.getFirstAsync<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM attendance_records`);
      if (!attCount || attCount.cnt === 0) {
        await tx.runAsync(`DELETE FROM timetable_rules WHERE id IN ('tt_1', 'tt_2', 'tt_3', 'tt_4', 'tt_5', 'tt_6', 'tt_7')`);
        await tx.runAsync(`DELETE FROM subjects WHERE id IN ('sub_1', 'sub_2', 'sub_3', 'sub_4', 'sub_5', 'sub_6', 'sub_7', 'sub_8', 'sports', 'library')`);
        await tx.runAsync(`DELETE FROM semesters WHERE name = 'Legacy Semester' AND NOT EXISTS (SELECT 1 FROM subjects WHERE semester_id = semesters.id)`);
      }

      await tx.execAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('user_version', '2');`);
    });

    currentDbVersion = 2;
  }

  // Version 3 migrations: Baselines columns compatibility, subject UUID repair, and component flags
  if (currentDbVersion < 3) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      // 1. Ensure attendance_baselines has attended and conducted columns for bidirectional sync
      try {
        await tx.execAsync(`ALTER TABLE attendance_baselines ADD COLUMN attended INTEGER DEFAULT 0;`);
        await tx.execAsync(`ALTER TABLE attendance_baselines ADD COLUMN conducted INTEGER DEFAULT 0;`);
      } catch (e) {}

      // 2. Repair subjects that might have UUIDs as names
      const subjectsWithUUID = await tx.getAllAsync<{ id: string; name: string }>(
        `SELECT id, name FROM subjects WHERE name LIKE '________-____-____-____-____________'`
      );
      for (const sub of subjectsWithUUID) {
        await tx.runAsync(`UPDATE subjects SET name = 'Subject' WHERE id = ?`, [sub.id]);
      }

      // 3. Ensure subjects with 0 theory and 0 practical get enabled appropriately
      const zeroCompSubjects = await tx.getAllAsync<{ id: string }>(
        `SELECT id FROM subjects WHERE has_theory = 0 AND has_practical = 0`
      );
      for (const zSub of zeroCompSubjects) {
        const hasPracticalSession = await tx.getFirstAsync(
          `SELECT 1 FROM class_sessions WHERE subject_id = ? AND component = 'practical' LIMIT 1`,
          [zSub.id]
        );
        const hasPracticalRule = await tx.getFirstAsync(
          `SELECT 1 FROM timetable_rules WHERE subject_id = ? AND component = 'practical' LIMIT 1`,
          [zSub.id]
        );
        const hasPracticalBaseline = await tx.getFirstAsync(
          `SELECT 1 FROM attendance_baselines WHERE subject_id = ? AND component = 'practical' LIMIT 1`,
          [zSub.id]
        );

        const isPractical = !!(hasPracticalSession || hasPracticalRule || hasPracticalBaseline);
        await tx.runAsync(
          `UPDATE subjects SET has_theory = 1, has_practical = ? WHERE id = ?`,
          [isPractical ? 1 : 0, zSub.id]
        );
      }

      await tx.execAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('user_version', '3');`);
    });

    currentDbVersion = 3;
  }

  // Version 4 migrations: Recurring weekly off days (week_off_days)
  if (currentDbVersion < 4) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(`
        CREATE TABLE IF NOT EXISTS week_off_days (
          id TEXT PRIMARY KEY,
          semester_id TEXT NOT NULL,
          day_of_week INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'pending',
          sync_revision INTEGER NOT NULL DEFAULT 1,
          UNIQUE(semester_id, day_of_week),
          FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
        );
      `);
      await tx.execAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('user_version', '4');`);
    });

    currentDbVersion = 4;
  }

  // Self-healing guard: ensure week_off_days table exists
  try {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS week_off_days (
        id TEXT PRIMARY KEY,
        semester_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending',
        sync_revision INTEGER NOT NULL DEFAULT 1,
        UNIQUE(semester_id, day_of_week)
      );
    `);
  } catch (e) {}

  // Self-healing guard: unconditionally ensure attendance_baselines has all columns
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(attendance_baselines)`);
    if (tableInfo.length > 0) {
      const existingCols = new Set(tableInfo.map(c => c.name));
      if (!existingCols.has('attended')) {
        await db.execAsync(`ALTER TABLE attendance_baselines ADD COLUMN attended INTEGER DEFAULT 0;`);
      }
      if (!existingCols.has('conducted')) {
        await db.execAsync(`ALTER TABLE attendance_baselines ADD COLUMN conducted INTEGER DEFAULT 0;`);
      }
      if (!existingCols.has('attended_weight')) {
        await db.execAsync(`ALTER TABLE attendance_baselines ADD COLUMN attended_weight INTEGER DEFAULT 0;`);
      }
      if (!existingCols.has('conducted_weight')) {
        await db.execAsync(`ALTER TABLE attendance_baselines ADD COLUMN conducted_weight INTEGER DEFAULT 0;`);
      }
    }
  } catch (e) {
    // Non-fatal if table not yet created
  }

  // Self-healing guard: reconcile subject ID references across tables and deduplicate
  try {
    const allSubjects = await db.getAllAsync<{ id: string; name: string }>(`SELECT id, name FROM subjects`);
    if (allSubjects && allSubjects.length > 0) {
      for (const sub of allSubjects) {
        if (!sub.name || sub.name.trim().length === 0) continue;
        await db.runAsync(
          `UPDATE class_sessions SET subject_id = ? WHERE LOWER(subject_id) = LOWER(?) AND subject_id != ?`,
          [sub.id, sub.name, sub.id]
        );
        await db.runAsync(
          `UPDATE timetable_rules SET subject_id = ? WHERE LOWER(subject_id) = LOWER(?) AND subject_id != ?`,
          [sub.id, sub.name, sub.id]
        );
        await db.runAsync(
          `UPDATE attendance_baselines SET subject_id = ? WHERE LOWER(subject_id) = LOWER(?) AND subject_id != ?`,
          [sub.id, sub.name, sub.id]
        );
      }

      // Deduplicate subjects with identical names
      const seenNames = new Map<string, string>();
      for (const sub of allSubjects) {
        const normName = sub.name.trim().toLowerCase();
        if (seenNames.has(normName)) {
          const canonicalId = seenNames.get(normName)!;
          await db.runAsync(`UPDATE class_sessions SET subject_id = ? WHERE subject_id = ?`, [canonicalId, sub.id]);
          await db.runAsync(`UPDATE timetable_rules SET subject_id = ? WHERE subject_id = ?`, [canonicalId, sub.id]);
          await db.runAsync(`UPDATE attendance_baselines SET subject_id = ? WHERE subject_id = ?`, [canonicalId, sub.id]);
          await db.runAsync(`DELETE FROM subjects WHERE id = ?`, [sub.id]);
        } else {
          seenNames.set(normName, sub.id);
        }
      }
    }
  } catch (e) {
    // Non-fatal self-healing
  }
}

