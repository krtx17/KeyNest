import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  APP_URL: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(16).default('development_jwt_access_secret_min_32_characters_ok'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development_jwt_refresh_secret_min_32_characters_ok'),
  KMS_MASTER_KEY: z.string().default('dev_kms_master_key_for_operational_encryption'),
  DATABASE_URL: z.string().default('vaultshare.sqlite'),
  USE_IN_MEMORY_DB: z.coerce.boolean().default(process.env.NODE_ENV === 'test'),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(5),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(60000),
  STEP_UP_TTL_SECONDS: z.coerce.number().default(120),

  // Backend Email Provider Configuration
  EMAIL_PROVIDER: z.enum(['resend', 'smtp', 'test', 'none']).default('none'),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('KeyNest <invites@keynest.app>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  API_PREFIX: process.env.API_PREFIX,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  APP_URL: process.env.APP_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  KMS_MASTER_KEY: process.env.KMS_MASTER_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  USE_IN_MEMORY_DB: process.env.USE_IN_MEMORY_DB !== undefined ? process.env.USE_IN_MEMORY_DB === 'true' : process.env.NODE_ENV === 'test',
  RATE_LIMIT_LOGIN_MAX: process.env.RATE_LIMIT_LOGIN_MAX,
  RATE_LIMIT_LOGIN_WINDOW_MS: process.env.RATE_LIMIT_LOGIN_WINDOW_MS,
  STEP_UP_TTL_SECONDS: process.env.STEP_UP_TTL_SECONDS,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : process.env.NODE_ENV === 'test' ? 'test' : 'none'),
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
});
