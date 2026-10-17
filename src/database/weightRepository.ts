import { getDatabase } from './database';
import { getActiveUserId } from './userRepository';

export type WeightEntry = { id: number; date: string; recordedAt: string; weightKg: number; notes?: string | null };
type WeightRow = { id: number; entry_date: string; recorded_at: string | null; weight_kg: number; notes: string | null };
const map = (row: WeightRow): WeightEntry => ({ id: row.id, date: row.entry_date, recordedAt: row.recorded_at ?? `${row.entry_date}T12:00:00.000Z`, weightKg: row.weight_kg, notes: row.notes });

export const listWeightEntries = async (startDate?: string, endDate?: string): Promise<WeightEntry[]> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return [];
  const rows = startDate && endDate
    ? await db.getAllAsync<WeightRow>('SELECT * FROM weight_entries WHERE user_id = ? AND entry_date >= ? AND entry_date <= ? ORDER BY entry_date ASC', userId, startDate, endDate)
    : await db.getAllAsync<WeightRow>('SELECT * FROM weight_entries WHERE user_id = ? ORDER BY entry_date ASC', userId);
  return rows.map(map);
};

export const saveWeightEntry = async (date: string, weightKg: number, notes?: string, recordedAt = new Date().toISOString()): Promise<void> => {
  if (weightKg <= 0) throw new Error('El peso debe ser mayor que cero');
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  await db.runAsync(
    `INSERT INTO weight_entries (user_id, entry_date, recorded_at, weight_kg, notes) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, entry_date) DO UPDATE SET recorded_at=excluded.recorded_at, weight_kg=excluded.weight_kg, notes=excluded.notes`,
    userId, date, recordedAt, weightKg, notes ?? null,
  );
};

export const updateWeightEntry = async (id: number, date: string, weightKg: number, notes?: string, recordedAt = new Date().toISOString()): Promise<void> => {
  if (weightKg <= 0) throw new Error('El peso debe ser mayor que cero');
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  await db.runAsync('UPDATE weight_entries SET entry_date = ?, recorded_at = ?, weight_kg = ?, notes = ? WHERE id = ? AND user_id = ?', date, recordedAt, weightKg, notes ?? null, id, userId);
};

export const deleteWeightEntry = async (id: number): Promise<void> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return;
  await db.runAsync('DELETE FROM weight_entries WHERE id = ? AND user_id = ?', id, userId);
};
