export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extremely_active';
export type GoalType = 'fat_loss' | 'maintenance' | 'muscle_gain' | 'recomposition';
export type PhysiologicalSex = 'female' | 'male' | 'unspecified';
export type TrainingType = 'none' | 'strength' | 'cardio' | 'mixed';
export type SafetyContext = 'none' | 'pregnancy' | 'lactation' | 'eating_disorder' | 'clinical';

export type Profile = {
  id: number;
  name?: string | null;
  birthDate?: string | null;
  currentWeightKg: number;
  heightCm: number;
  sex: PhysiologicalSex;
  activityLevel: ActivityLevel;
  goal: GoalType;
  trainingType: TrainingType;
  trainingFrequency: number;
  sessionDurationMinutes: number;
  targetRateKgPerWeek: number;
  safetyContext: SafetyContext;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileInput = Omit<Profile, 'id' | 'createdAt' | 'updatedAt' | 'onboardingCompleted' | 'onboardingCompletedAt'>;
