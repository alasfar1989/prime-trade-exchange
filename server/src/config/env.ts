import dotenv from 'dotenv';

// In production (Railway), env vars are injected. Locally, load from .env
dotenv.config();  // looks for .env in cwd
dotenv.config({ path: '../.env' }); // also try parent (project root)

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  PORT: parseInt(process.env.PORT || '3001'),
  API_KEY: process.env.API_KEY || '',
  SP_API: {
    CLIENT_ID: required('SP_API_CLIENT_ID'),
    CLIENT_SECRET: required('SP_API_CLIENT_SECRET'),
    REFRESH_TOKEN: required('SP_API_REFRESH_TOKEN'),
    MARKETPLACE_ID: required('SP_API_MARKETPLACE_ID'),
    SELLER_ID: required('SP_API_SELLER_ID'),
  },
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};
