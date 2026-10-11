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
  
  if (currentDbVersion >= 2) {
    return;
  }

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
          attended_weight INTEGER NOT NULL,
          conducted_weight INTEGER NOT NULL,
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
}
