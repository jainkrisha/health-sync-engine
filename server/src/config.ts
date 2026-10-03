import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/healthsync'),
  jwtSecret: required('JWT_SECRET', isProduction ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  allowOpenRegistration: (process.env.ALLOW_OPEN_REGISTRATION ?? 'true') === 'true',
  /** Vector clock id the server uses when a reviewer or the REST API writes. */
  serverClientId: 'server',
};
