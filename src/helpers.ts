import dotenv from 'dotenv';
import { default as fetch, Request as NodeFetchRequst } from 'node-fetch';

import {
  Response as ExpressResponse,
  Request,
} from 'express-serve-static-core';
import {
  StaticOriginCallback,
  HttpStatuses,
  ApiResponse,
  Headers,
  ContentTypes,
  ServerMethods,
} from '~types';

dotenv.config();

const BLOCK_TIME = Number(process.env.DEFAULT_BLOCK_TIME) * 1000 || 5000;

export const isDevMode = (): boolean => process.env.NODE_ENV !== 'prod';

export const getStaticOrigin = (
  origin?: string,
  callback?: StaticOriginCallback,
): string | undefined => {
  let isAllowedOrigin = false;
  if (isDevMode()) {
    if (
      origin?.includes('http://localhost') ||
      origin?.includes('https://localhost') ||
      origin?.includes('http://127') ||
      origin?.includes('https://127')
    ) {
      isAllowedOrigin = true;
    }
  }
  if (origin === process.env.ORIGIN_URL) {
    isAllowedOrigin = true;
  }
  if (callback && typeof callback === 'function') {
    callback(null, isAllowedOrigin ? origin : '');
  }
  return isAllowedOrigin ? origin : '';
};

export const sendResponse = (
  response: ExpressResponse,
  request: Request,
  message?: ApiResponse,
  status: HttpStatuses = HttpStatuses.OK,
) =>
  response
    .set({
      [Headers.AllowOrigin]: getStaticOrigin(request.headers.origin),
      [Headers.ContentType]: ContentTypes.Json,
      [Headers.PoweredBy]: 'Colony',
    })
    .status(status)
    .json(message);

export const getRemoteIpAddress = (request: Request): string =>
  typeof request.headers[Headers.ForwardedFor] === 'string'
    ? request.headers[Headers.ForwardedFor]
    : request.headers[Headers.ForwardedFor]?.join(';') ||
      request.ip ||
      request.ips.join(';') ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      '';

export const resetSession = (request: Request): void => {
  request.session.auth = undefined;
  request.session.nonce = undefined;
};

export const logger = (...args: any[]): void => {
  const isSilent = process.env.SILENT === 'true';
  if (!isSilent) {
    console.log(`${new Date().toISOString()}`, ...args);
  }
  return;
};

export const graphqlRequest = async (
  queryOrMutation: string,
  variables?: Record<string, unknown>,
  walletAddress?: string,
) => {
  const headers: Record<string, string> = {
    [Headers.ApiKey]: process.env.APPSYNC_API_KEY || '',
    [Headers.ContentType]: ContentTypes.Json,
  };

  if (walletAddress) {
    headers[Headers.WalletAddress] = walletAddress;
  }

  const options = {
    method: ServerMethods.Post.toUpperCase(),
    headers,
    body: JSON.stringify({
      query: queryOrMutation,
      variables,
    }),
  };

  const request = new NodeFetchRequst(process.env.APPSYNC_API || '', options);

  try {
    const response = await fetch(request);
    const body = await response.json();
    return body;
  } catch (error) {
    /*
     * Something went wrong... obviously
     */
    console.error(error);
    return null;
  }
};

const MAX_RETRIES = 3;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchWithRetry = async <T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await graphqlRequest(query, variables);
    if (result?.data) {
      const data = result.data;
      const value = data[Object.keys(data)[0]];
      if (value) {
        return value as T;
      }
    }
    if (attempt < MAX_RETRIES) {
      await delay(BLOCK_TIME);
    }
  }
  return null;
};
