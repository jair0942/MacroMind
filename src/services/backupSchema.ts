import { z } from 'zod';

export const BackupSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]), exportedAt: z.string(),
  users: z.array(z.record(z.string(), z.unknown())).optional(),
  app_settings: z.array(z.record(z.string(), z.unknown())).optional(),
  profiles: z.array(z.record(z.string(), z.unknown())), daily_goals: z.array(z.record(z.string(), z.unknown())),
  foods: z.array(z.record(z.string(), z.unknown())), meals: z.array(z.record(z.string(), z.unknown())),
  meal_items: z.array(z.record(z.string(), z.unknown())), weight_entries: z.array(z.record(z.string(), z.unknown())),
});
export type BackupPayload = z.infer<typeof BackupSchema>;
