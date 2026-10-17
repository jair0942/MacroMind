import type { MacroTargets } from '@/src/types/nutrition';
import type { ActivityLevel, GoalType, Profile, PhysiologicalSex, SafetyContext } from '@/src/types/profile';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extremely_active: 1.9,
};

export type GoalPlan = {
  age: number | null;
  bmr: number | null;
  tdee: number | null;
  target: MacroTargets | null;
  restricted: boolean;
  explanation: string;
};

export const calculateAge = (birthDate: string, today = new Date()): number | null => {
  const birth = new Date(`${birthDate}T12:00:00`);
  if (!birthDate || Number.isNaN(birth.getTime()) || birth > today) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
};

export const calculateBmr = (weightKg: number, heightCm: number, age: number, sex: PhysiologicalSex): number | null => {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0 || sex === 'unspecified') return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
};

export const calculateTdee = (bmr: number, activity: ActivityLevel): number => Math.round(bmr * ACTIVITY_FACTORS[activity]);

export const isRestrictedContext = (age: number | null, context: SafetyContext): boolean => age !== null && age < 18 || context !== 'none';

export const targetCalories = (tdee: number, goal: GoalType, targetRateKgPerWeek = 0): number => {
  let adjustment = 0;
  if (goal === 'fat_loss') {
    const requested = targetRateKgPerWeek > 0 ? Math.round((targetRateKgPerWeek * 7700) / 7) : 350;
    adjustment = -Math.min(500, Math.max(150, requested));
  } else if (goal === 'muscle_gain') adjustment = 200;
  else if (goal === 'recomposition') adjustment = -100;
  return Math.max(1200, Math.round(tdee + adjustment));
};

export const macroTargets = (calories: number, weightKg: number, goal: GoalType, trainingType: Profile['trainingType'] = 'none'): MacroTargets => {
  const proteinFactor = goal === 'muscle_gain' || goal === 'recomposition' || trainingType === 'strength' || trainingType === 'mixed' ? 1.8 : goal === 'fat_loss' ? 1.6 : 1.4;
  const protein = Math.round(Math.max(1.4, proteinFactor) * weightKg);
  const minimumFat = Math.round(weightKg * 0.6);
  const fat = Math.max(minimumFat, Math.round((calories * 0.28) / 9));
  const carbohydrates = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbohydrates, fat };
};

export const calculateGoalPlan = (profile: Profile, today = new Date()): GoalPlan => {
  const age = profile.birthDate ? calculateAge(profile.birthDate, today) : null;
  const bmr = age === null ? null : calculateBmr(profile.currentWeightKg, profile.heightCm, age, profile.sex);
  const restricted = isRestrictedContext(age, profile.safetyContext);
  if (bmr === null || restricted) {
    return {
      age, bmr, tdee: null, target: null, restricted,
      explanation: restricted ? 'Por seguridad, este perfil requiere orientación profesional antes de crear metas restrictivas.' : 'Faltan fecha de nacimiento o sexo fisiológico para estimar el metabolismo basal.',
    };
  }
  const tdee = calculateTdee(bmr, profile.activityLevel);
  const calories = targetCalories(tdee, profile.goal, profile.targetRateKgPerWeek);
  return {
    age, bmr, tdee, target: macroTargets(calories, profile.currentWeightKg, profile.goal, profile.trainingType), restricted: false,
    explanation: profile.goal === 'recomposition' ? 'Se propone una ingesta cercana al mantenimiento, con prioridad al entrenamiento de fuerza, recuperación y proteínas.' : 'La meta es una estimación inicial y debe revisarse según la evolución real durante varias semanas.',
  };
};
