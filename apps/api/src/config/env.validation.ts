import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  // Key for reversible at-rest encryption of secrets the API must return in
  // plaintext later (SNMP v3 auth/priv passwords) — see SecretCryptoService.
  // Distinct from JWT_SECRET on purpose: rotating one shouldn't force
  // rotating the other, and a JWT secret leak shouldn't also expose SNMP
  // credentials.
  SECRET_ENCRYPTION_KEY: z.string().min(16),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  AGENT_OFFLINE_THRESHOLD_SECONDS: z.coerce.number().default(120),
  // How often the scheduled sweep runs to flip stale agents/printers to
  // OFFLINE. Should be <= the threshold so status doesn't lag a full extra
  // cycle. Set to 0 to disable the scheduled sweep entirely.
  AGENT_OFFLINE_CHECK_INTERVAL_SECONDS: z.coerce.number().default(60),
  LOG_LEVEL: z.string().default('debug'),
});

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
