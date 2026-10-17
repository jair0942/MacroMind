export const config = {
  analysisApiUrl: process.env.EXPO_PUBLIC_ANALYSIS_API_URL ?? '',
  demoMode: (process.env.EXPO_PUBLIC_DEMO_MODE ?? 'true') !== 'false',
  requestTimeoutMs: 45_000,
} as const;
