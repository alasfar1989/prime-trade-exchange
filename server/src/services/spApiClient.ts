import axios, { type AxiosRequestConfig } from 'axios';
import { getAccessToken } from './spApiAuth.js';
import { env } from '../config/env.js';

const BASE_URL = 'https://sellingpartnerapi-na.amazon.com';

export async function spApiGet<T>(
  path: string,
  params?: Record<string, string>,
  injectMarketplace = true
): Promise<T> {
  const token = await getAccessToken();

  const config: AxiosRequestConfig = {
    method: 'GET',
    url: `${BASE_URL}${path}`,
    headers: {
      'x-amz-access-token': token,
      'Content-Type': 'application/json',
    },
    params: injectMarketplace
      ? { ...params, MarketplaceId: env.SP_API.MARKETPLACE_ID }
      : { ...params },
  };

  const res = await axios(config);
  return res.data;
}

export async function spApiPost<T>(
  path: string,
  body: unknown,
  injectMarketplace = false
): Promise<T> {
  const token = await getAccessToken();

  const config: AxiosRequestConfig = {
    method: 'POST',
    url: `${BASE_URL}${path}`,
    headers: {
      'x-amz-access-token': token,
      'Content-Type': 'application/json',
    },
    params: injectMarketplace ? { MarketplaceId: env.SP_API.MARKETPLACE_ID } : undefined,
    data: body,
  };

  const res = await axios(config);
  return res.data;
}
