import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDatabase } from '@/src/database/database';
import { BackupSchema, type BackupPayload } from './backupSchema';

export const buildBackup = async (): Promise<BackupPayload> => {
  const db = await getDatabase();
  return {
    version: 2, exportedAt: new Date().toISOString(),
    users: await db.getAllAsync('SELECT * FROM users'), app_settings: await db.getAllAsync('SELECT * FROM app_settings'),
    profiles: await db.getAllAsync('SELECT * FROM profiles'), daily_goals: await db.getAllAsync('SELECT * FROM daily_goals'),
    foods: await db.getAllAsync('SELECT * FROM foods'), meals: await db.getAllAsync('SELECT * FROM meals'),
    meal_items: await db.getAllAsync('SELECT * FROM meal_items'), weight_entries: await db.getAllAsync('SELECT * FROM weight_entries'),
  } as BackupPayload;
};

export const exportBackup = async (): Promise<string> => {
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error('No hay un directorio temporal disponible');
  const uri = `${directory}macromind-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(await buildBackup(), null, 2));
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Exportar respaldo MacroMind' });
  return uri;
};

export const validateBackup = (value: unknown): BackupPayload => {
  const result = BackupSchema.safeParse(value);
  if (!result.success) throw new Error('El archivo de respaldo no es válido o no pertenece a MacroMind');
  return result.data;
};

export const importBackup = async (payload: BackupPayload, replaceExisting: boolean): Promise<void> => {
  const data = validateBackup(payload);
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    if (replaceExisting) {
      await db.execAsync('DELETE FROM meal_items; DELETE FROM meals; DELETE FROM foods; DELETE FROM daily_goals; DELETE FROM weight_entries; DELETE FROM profiles; DELETE FROM users; DELETE FROM app_settings;');
    }
    const importedUsers = data.users ?? [];
    if (importedUsers.length > 0) {
      for (const row of importedUsers) {
        if (typeof row.username === 'string' && typeof row.password_salt === 'string' && typeof row.password_hash === 'string') {
          await db.runAsync('INSERT OR REPLACE INTO users (id, display_name, username, password_salt, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', row.id as number, row.display_name as string, row.username, row.password_salt, row.password_hash, row.created_at as string, row.updated_at as string);
        } else {
          await db.runAsync('INSERT OR REPLACE INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)', row.id as number, row.display_name as string, row.created_at as string, row.updated_at as string);
        }
      }
    } else {
      await db.runAsync('INSERT OR IGNORE INTO users (id, display_name, created_at, updated_at) VALUES (?, ?, ?, ?)', 1, 'Usuario principal', new Date().toISOString(), new Date().toISOString());
    }
    for (const row of data.app_settings ?? []) await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', row.key as string, row.value as string);
    for (const row of data.profiles) {
      const legacyProfileIsComplete = Boolean(row.birth_date) && Number(row.current_weight_kg) > 0 && Number(row.height_cm) > 0;
      const onboardingCompleted = typeof row.onboarding_completed === 'number' ? row.onboarding_completed : legacyProfileIsComplete ? 1 : 0;
      await db.runAsync(`INSERT OR REPLACE INTO profiles (id, user_id, name, birth_date, current_weight_kg, height_cm, sex, activity_level, goal, training_type, training_frequency, session_duration_minutes, target_rate_kg_week, safety_context, created_at, updated_at, onboarding_completed, onboarding_completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row.id as number, (row.user_id as number | undefined) ?? 1, row.name as string | null, row.birth_date as string | null, row.current_weight_kg as number, row.height_cm as number, row.sex as string, row.activity_level as string, row.goal as string, row.training_type as string ?? 'none', row.training_frequency as number ?? 0, row.session_duration_minutes as number ?? 0, row.target_rate_kg_week as number ?? 0, row.safety_context as string ?? 'none', row.created_at as string, row.updated_at as string, onboardingCompleted, row.onboarding_completed_at as string | null ?? null);
    }
    for (const row of data.daily_goals) await db.runAsync(`INSERT OR REPLACE INTO daily_goals (id, user_id, goal_date, calories, protein, carbohydrates, fat) VALUES (?, ?, ?, ?, ?, ?, ?)`, row.id as number, (row.user_id as number | undefined) ?? 1, row.goal_date as string, row.calories as number, row.protein as number, row.carbohydrates as number, row.fat as number);
    for (const row of data.foods) await db.runAsync(`INSERT OR REPLACE INTO foods (id, name, normalized_name, calories_per_100g, protein_per_100g, carbohydrates_per_100g, fat_per_100g, fiber_per_100g, source, verified, source_id, barcode, preparation_state, data_quality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row.id as number, row.name as string, row.normalized_name as string, row.calories_per_100g as number, row.protein_per_100g as number, row.carbohydrates_per_100g as number, row.fat_per_100g as number, row.fiber_per_100g as number | null, row.source as string, row.verified as number, row.source_id as string | null ?? null, row.barcode as string | null ?? null, row.preparation_state as string ?? 'unknown', row.data_quality as string ?? 'complete');
    for (const row of data.meals) await db.runAsync(`INSERT OR REPLACE INTO meals (id, user_id, recorded_at, meal_type, image_uri, notes, analysis_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, row.id as number, (row.user_id as number | undefined) ?? 1, row.recorded_at as string, row.meal_type as string, row.image_uri as string | null, row.notes as string | null, row.analysis_status as string, row.created_at as string);
    for (const row of data.meal_items) await db.runAsync(`INSERT OR REPLACE INTO meal_items (id, meal_id, food_id, name, grams, calories, protein, carbohydrates, fat, estimation_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row.id as number, row.meal_id as number, row.food_id as number | null, row.name as string, row.grams as number, row.calories as number, row.protein as number, row.carbohydrates as number, row.fat as number, row.estimation_method as string, row.notes as string | null);
    for (const row of data.weight_entries) await db.runAsync(`INSERT OR REPLACE INTO weight_entries (id, user_id, entry_date, recorded_at, weight_kg, notes) VALUES (?, ?, ?, ?, ?, ?)`, row.id as number, (row.user_id as number | undefined) ?? 1, row.entry_date as string, (row.recorded_at as string | null) ?? `${row.entry_date as string}T12:00:00.000Z`, row.weight_kg as number, row.notes as string | null);
  });
};
