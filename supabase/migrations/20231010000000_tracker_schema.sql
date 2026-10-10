-- Supabase Schema for Tracker Rebuild
-- Deployed by: User (Manual or CLI)
-- Purpose: Authenticated cloud backup and synchronization layer.

-- 1. Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Deleted Records (Tombstones)
CREATE TABLE deleted_records (
    id TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    PRIMARY KEY (id, user_id, table_name)
);

ALTER TABLE deleted_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own deleted records" ON deleted_records
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Semesters
CREATE TABLE semesters (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own semesters" ON semesters
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Subjects
CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    has_theory BOOLEAN DEFAULT false,
    has_practical BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own subjects" ON subjects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Timetable Rules
CREATE TABLE timetable_rules (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    component TEXT NOT NULL,
    is_attendance_bearing BOOLEAN DEFAULT false,
    weight REAL DEFAULT 1,
    batch_constraint TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE timetable_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own timetable rules" ON timetable_rules
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Class Sessions
CREATE TABLE class_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    timetable_rule_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    component TEXT NOT NULL,
    weight REAL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own class sessions" ON class_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Attendance Records
CREATE TABLE attendance_records (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE UNIQUE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own attendance records" ON attendance_records
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7b. Week Off Days
CREATE TABLE week_off_days (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, semester_id, day_of_week)
);
ALTER TABLE week_off_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own week off days" ON week_off_days
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7c. Attendance Baselines
CREATE TABLE attendance_baselines (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    component TEXT NOT NULL,
    attended INTEGER NOT NULL DEFAULT 0,
    conducted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, subject_id, component)
);
ALTER TABLE attendance_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own attendance baselines" ON attendance_baselines
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. User Preferences
CREATE TABLE user_preferences (
    key TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (key, user_id)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- 9. Habits
CREATE TABLE habits (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    frequency_type TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    reminder_time TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own habits" ON habits
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Habit Entries
CREATE TABLE habit_entries (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(habit_id, date, user_id)
);
ALTER TABLE habit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own habit entries" ON habit_entries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_sessions_date ON class_sessions(user_id, date);
CREATE INDEX idx_attendance_status ON attendance_records(user_id, status);
CREATE INDEX idx_timetable_day ON timetable_rules(user_id, day_of_week);
