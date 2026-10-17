export type Nutrition = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber?: number | null;
};

export type DailyGoal = {
  id?: number;
  date: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};

export type DailySummary = Nutrition & {
  goal: DailyGoal;
};

export type MacroTargets = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
};
