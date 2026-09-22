import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().optional().default(''),
    REDIS_URL: z.string().optional().default('redis://localhost:6379'),
    JWT_SECRET: z.string().optional().default('development-jwt-secret-key-32-chars-minimum!'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().optional().default('development-jwt-refresh-secret-key-32-chars!'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    AGENT_OFFLINE_THRESHOLD_SECONDS: z.coerce.number().default(120),
    LOG_LEVEL: z.string().default('debug'),
  })
  .refine(
    (data) =>
      data.NODE_ENV !== 'production' ||
      (data.DATABASE_URL.length > 0 && data.JWT_SECRET.length >= 16 && data.JWT_REFRESH_SECRET.length >= 16),
    {
      message: 'DATABASE_URL, JWT_SECRET, and JWT_REFRESH_SECRET must be configured in production mode',
    },
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }
  return parsed.data;
}
