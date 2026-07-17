import dotenv from 'dotenv';

// In production (Railway), env vars are injected. Locally, load from .env
dotenv.config();  // looks for .env in cwd
dotenv.config({ path: '../.env' }); // also try parent (project root)

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

// Railway mangles env vars containing pipe (|) characters.
// If SP_API_REFRESH_TOKEN_B64 is set, decode it instead.
function getRefreshToken(): string {
  const b64 = process.env.SP_API_REFRESH_TOKEN_B64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf-8');
  return required('SP_API_REFRESH_TOKEN');
}

export const env = {
  PORT: parseInt(process.env.PORT || '3001'),
  API_KEY: process.env.API_KEY || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  SP_API: {
    CLIENT_ID: required('SP_API_CLIENT_ID'),
    CLIENT_SECRET: required('SP_API_CLIENT_SECRET'),
    REFRESH_TOKEN: getRefreshToken(),
    MARKETPLACE_ID: required('SP_API_MARKETPLACE_ID'),
    SELLER_ID: required('SP_API_SELLER_ID'),
  },
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};
