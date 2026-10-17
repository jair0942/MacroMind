export const positiveNumber = (value: string, fallback = 0): number => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
