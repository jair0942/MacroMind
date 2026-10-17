import type { ActivityLevel, GoalType, Profile, ProfileInput, PhysiologicalSex } from '@/src/types/profile';
import type { DailyGoal } from '@/src/types/nutrition';
import { getDatabase } from './database';
import { getActiveUserId } from './userRepository';

type ProfileRow = {
  id: number; user_id: number; name: string | null; birth_date: string | null; current_weight_kg: number; height_cm: number;
  sex: PhysiologicalSex; activity_level: ActivityLevel; goal: GoalType; training_type: Profile['trainingType']; training_frequency: number;
  session_duration_minutes: number; target_rate_kg_week: number; safety_context: Profile['safetyContext'];
  onboarding_completed?: number | boolean | null; onboarding_completed_at?: string | null;
  created_at: string; updated_at: string;
};

const mapProfile = (row: ProfileRow): Profile => ({
  id: row.id, name: row.name, birthDate: row.birth_date, currentWeightKg: row.current_weight_kg,
  heightCm: row.height_cm, sex: row.sex, activityLevel: row.activity_level, goal: row.goal,
  trainingType: row.training_type ?? 'none', trainingFrequency: row.training_frequency ?? 0,
  sessionDurationMinutes: row.session_duration_minutes ?? 0, targetRateKgPerWeek: row.target_rate_kg_week ?? 0,
  safetyContext: row.safety_context ?? 'none',
  onboardingCompleted: row.onboarding_completed === 1 || row.onboarding_completed === true ||
    (row.onboarding_completed === undefined && Boolean(row.birth_date) && row.current_weight_kg > 0 && row.height_cm > 0),
  onboardingCompletedAt: row.onboarding_completed_at ?? null,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

export const getProfile = async (): Promise<Profile | null> => {
  const userId = await getActiveUserId();
  return userId ? getProfileForUser(userId) : null;
};

export const getProfileForUser = async (userId: number): Promise<Profile | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ProfileRow>('SELECT * FROM profiles WHERE user_id = ?', userId);
  return row ? mapProfile(row) : null;
};

export const saveProfile = async (input: ProfileInput): Promise<Profile> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO profiles (user_id, name, birth_date, current_weight_kg, height_cm, sex, activity_level, goal, training_type, training_frequency, session_duration_minutes, target_rate_kg_week, safety_context, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET name=excluded.name, birth_date=excluded.birth_date,
       current_weight_kg=excluded.current_weight_kg, height_cm=excluded.height_cm, sex=excluded.sex,
       activity_level=excluded.activity_level, goal=excluded.goal, training_type=excluded.training_type,
       training_frequency=excluded.training_frequency, session_duration_minutes=excluded.session_duration_minutes,
       target_rate_kg_week=excluded.target_rate_kg_week, safety_context=excluded.safety_context, updated_at=excluded.updated_at`,
    userId, input.name ?? null, input.birthDate ?? null, input.currentWeightKg, input.heightCm, input.sex,
    input.activityLevel, input.goal, input.trainingType, input.trainingFrequency, input.sessionDurationMinutes,
    input.targetRateKgPerWeek, input.safetyContext, now, now,
  );
  await db.runAsync('UPDATE users SET display_name = COALESCE(NULLIF(?, \'\'), display_name), updated_at = ? WHERE id = ?', input.name?.trim() || null, now, userId);
  const profile = await getProfile();
  if (!profile) throw new Error('No se pudo guardar el perfil');
  return profile;
};

export const completeOnboarding = async (): Promise<Profile> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  const completedAt = new Date().toISOString();
  const result = await db.runAsync(
    `UPDATE profiles SET onboarding_completed = 1, onboarding_completed_at = ?, updated_at = ? WHERE user_id = ?`,
    completedAt, completedAt, userId,
  );
  if (result.changes === 0) throw new Error('Primero guarda los datos del perfil');
  const profile = await getProfile();
  if (!profile) throw new Error('No se pudo completar la configuración inicial');
  return profile;
};

export const resetOnboarding = async (): Promise<void> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return;
  await db.runAsync(
    `UPDATE profiles SET onboarding_completed = 0, onboarding_completed_at = NULL, updated_at = ? WHERE user_id = ?`,
    new Date().toISOString(), userId,
  );
};

export const getGoal = async (date: string): Promise<DailyGoal> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) return { date, calories: 2000, protein: 150, carbohydrates: 200, fat: 67 };
  const row = await db.getFirstAsync<{ id: number; goal_date: string; calories: number; protein: number; carbohydrates: number; fat: number }>(
    `SELECT * FROM daily_goals WHERE user_id = ? AND goal_date = ?
     UNION ALL SELECT * FROM daily_goals WHERE user_id = ? AND goal_date < ? ORDER BY goal_date DESC LIMIT 1`, userId, date, userId, date,
  );
  return row
    ? { id: row.id, date: row.goal_date, calories: row.calories, protein: row.protein, carbohydrates: row.carbohydrates, fat: row.fat }
    : { date, calories: 2000, protein: 150, carbohydrates: 200, fat: 67 };
};

export const saveGoal = async (goal: DailyGoal): Promise<void> => {
  const db = await getDatabase();
  const userId = await getActiveUserId();
  if (!userId) throw new Error('Primero crea o selecciona un usuario local.');
  await db.runAsync(
    `INSERT INTO daily_goals (user_id, goal_date, calories, protein, carbohydrates, fat) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, goal_date) DO UPDATE SET calories=excluded.calories, protein=excluded.protein,
       carbohydrates=excluded.carbohydrates, fat=excluded.fat`,
    userId, goal.date, goal.calories, goal.protein, goal.carbohydrates, goal.fat,
  );
};
