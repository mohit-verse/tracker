import { getDatabase, withTransaction } from './index';
import { Habit, HabitEntry } from '../types';
import { enqueueOutboxOperation } from './outbox';

export async function getHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(`SELECT * FROM habits ORDER BY created_at DESC`);
}

export async function getHabit(id: string): Promise<Habit | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Habit>(`SELECT * FROM habits WHERE id = ?`, [id]);
}

export async function createHabit(habit: Habit): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.runAsync(
      `INSERT INTO habits (id, name, icon, color, frequency_type, target_count, start_date, reminder_time, reminder_enabled, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [habit.id, habit.name, habit.icon || null, habit.color || null, habit.frequency_type, habit.target_count, habit.start_date, habit.reminder_time || null, habit.reminder_enabled ? 1 : 0, habit.created_at, habit.updated_at]
    );
    await enqueueOutboxOperation(tx, 'INSERT', 'habits', habit.id);
  });
}

export async function updateHabit(habit: Habit): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.runAsync(
      `UPDATE habits SET name = ?, icon = ?, color = ?, frequency_type = ?, target_count = ?, start_date = ?, reminder_time = ?, reminder_enabled = ?, updated_at = ? WHERE id = ?`,
      [habit.name, habit.icon || null, habit.color || null, habit.frequency_type, habit.target_count, habit.start_date, habit.reminder_time || null, habit.reminder_enabled ? 1 : 0, habit.updated_at, habit.id]
    );
    await enqueueOutboxOperation(tx, 'UPDATE', 'habits', habit.id);
  });
}

export async function deleteHabit(id: string): Promise<void> {
  await withTransaction(async (tx) => {
    const now = new Date().toISOString();
    await tx.runAsync(`DELETE FROM habits WHERE id = ?`, [id]);
    await tx.runAsync(`INSERT OR REPLACE INTO deleted_records (id, table_name, deleted_at) VALUES (?, 'habits', ?)`, [id, now]);
    await enqueueOutboxOperation(tx, 'DELETE', 'habits', id);
  });
}

export async function getHabitEntries(date: string): Promise<HabitEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<HabitEntry>(`SELECT * FROM habit_entries WHERE date = ?`, [date]);
}

export async function getHabitEntriesByHabit(habitId: string): Promise<HabitEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<HabitEntry>(`SELECT * FROM habit_entries WHERE habit_id = ? ORDER BY date DESC`, [habitId]);
}

export async function toggleHabitEntry(habitId: string, date: string, isChecked: boolean, id: string, timestamp: string): Promise<void> {
  await withTransaction(async (tx) => {
    if (isChecked) {
      await tx.runAsync(
        `INSERT INTO habit_entries (id, habit_id, date, count, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)
         ON CONFLICT(habit_id, date) DO UPDATE SET count = 1, updated_at = ?`,
        [id, habitId, date, timestamp, timestamp, timestamp]
      );
      // SQLite UNIQUE constraint is on user_id, habit_id, date in Supabase but just habit_id, date in SQLite.
      // Wait, SQLite has UNIQUE(habit_id, date)
      // We must query the actual assigned ID for the outbox if it updated an existing one, or just use the passed `id`.
      const entry = await tx.getFirstAsync(`SELECT id FROM habit_entries WHERE habit_id = ? AND date = ?`, [habitId, date]) as { id: string } | null;
      if (entry) {
        await enqueueOutboxOperation(tx, 'INSERT', 'habit_entries', entry.id);
      }
    } else {
      const entry = await tx.getFirstAsync(`SELECT id FROM habit_entries WHERE habit_id = ? AND date = ?`, [habitId, date]) as { id: string } | null;
      if (entry) {
        await tx.runAsync(`DELETE FROM habit_entries WHERE id = ?`, [entry.id]);
        await tx.runAsync(`INSERT OR REPLACE INTO deleted_records (id, table_name, deleted_at) VALUES (?, 'habit_entries', ?)`, [entry.id, timestamp]);
        await enqueueOutboxOperation(tx, 'DELETE', 'habit_entries', entry.id);
      }
    }
  });
}
