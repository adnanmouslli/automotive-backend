import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL || '',
  ssl: process.env.DATABASE_SSL === 'true',
}));

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  name: 'NestJS API',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expirationTime: parseInt(process.env.JWT_EXPIRATION_TIME || '3600', 10),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
}));
