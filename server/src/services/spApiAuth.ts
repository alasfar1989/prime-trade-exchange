import axios from 'axios';
import { env } from '../config/env.js';

const TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

let cachedToken: string | null = null;
let expiresAt = 0;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < expiresAt - BUFFER_MS) {
    return cachedToken;
  }

  try {
    const res = await axios.post(TOKEN_URL, new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: env.SP_API.REFRESH_TOKEN,
      client_id: env.SP_API.CLIENT_ID,
      client_secret: env.SP_API.CLIENT_SECRET,
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    cachedToken = res.data.access_token;
    expiresAt = Date.now() + res.data.expires_in * 1000;

    console.log('SP-API access token refreshed, expires in', res.data.expires_in, 'seconds');
    return cachedToken!;
  } catch (err: any) {
    const errData = err.response?.data || err.message;
    console.error('SP-API token exchange failed:', JSON.stringify(errData));
    console.error('Client ID prefix:', env.SP_API.CLIENT_ID.substring(0, 30) + '...');
    console.error('Refresh token prefix:', env.SP_API.REFRESH_TOKEN.substring(0, 20) + '...');
    throw err;
  }
}

export function isTokenValid(): boolean {
  return !!cachedToken && Date.now() < expiresAt - BUFFER_MS;
}
