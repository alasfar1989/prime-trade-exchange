import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (parent of server/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

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
