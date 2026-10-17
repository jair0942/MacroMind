import type { IncomingMessage } from 'node:http';

const requests = new Map<string, { startedAt: number; count: number }>();
const positiveNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const max = positiveNumber(process.env.MAX_REQUESTS_PER_WINDOW, 20);
const windowMs = positiveNumber(process.env.RATE_WINDOW_MS, 300_000);
const nutritionMax = positiveNumber(process.env.NUTRITION_MAX_REQUESTS_PER_WINDOW, 10);
const nutritionWindowMs = positiveNumber(process.env.NUTRITION_RATE_WINDOW_MS, 60_000);
const trustProxy = process.env.TRUST_PROXY === 'true';

export const requestKey = (request: IncomingMessage): string => {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  }
  return request.socket.remoteAddress ?? 'unknown';
};

const allow = (key: string, limit: number, duration: number): boolean => {
  const now = Date.now(); const current = requests.get(key);
  if (!current || now - current.startedAt > duration) { requests.set(key, { startedAt: now, count: 1 }); return true; }
  if (current.count >= limit) return false;
  current.count += 1; return true;
};

export const allowRequest = (key: string): boolean => allow(`analysis:${key}`, max, windowMs);
export const allowNutritionRequest = (key: string): boolean => allow(`nutrition:${key}`, nutritionMax, nutritionWindowMs);
