import { parse } from 'graphql';
import dotenv from "dotenv";
import { default as fetch, Request as NodeFetchRequst } from 'node-fetch';

import { Response as ExpressResponse, Request } from 'express-serve-static-core';
import { RequestError } from './RequestError';
import {
  OperationTypes,
  StaticOriginCallback,
  HttpStatuses,
  Response,
  Headers,
  ContentTypes,
  ServerMethods,
} from '~types';

dotenv.config();

const BLOCK_TIME = Number(process.env.DEFAULT_BLOCK_TIME) || 5000;

export const isDevMode = (): boolean => process.env.NODE_ENV !== 'prod';

export const detectOperation = (body: Record<string, any>): {
  operationType: OperationTypes,
  operations: string[],
  variables?: string,
} => {
  let isMutation = false;

  if (!body) {
    throw new RequestError('no body');
  }
  if (!body?.query) {
    throw new RequestError('graphql request malformed');
  }

  if (JSON.stringify(body).includes(OperationTypes.Mutation)) {
    isMutation = true;
  }

  let parsedQuery: any;
  try {
    parsedQuery = parse(body.query);
  } catch (error) {
    // silent
  }

  if (!parsedQuery) {
    throw new RequestError('graphql request malformed');
  }

  const [{ operation: operationType }] = parsedQuery.definitions || [{}];
  if (operationType === OperationTypes.Mutation) {
    isMutation = true;
  }

  const operationNames = parsedQuery.definitions[0].selectionSet.selections.map(
    (selection: any) => selection.name.value,
  );

  return {
    operationType: isMutation ? OperationTypes.Mutation : OperationTypes.Query,
    operations: operationNames,
    variables: body.variables ? JSON.stringify(body.variables) : undefined,
  };
};

export const getStaticOrigin = (origin?: string, callback?: StaticOriginCallback): string | undefined => {
  let isAllowedOrigin = false;
  if (isDevMode()) {
    if (origin?.includes('http://localhost') || origin?.includes('https://localhost') || origin?.includes('http://127') || origin?.includes('https://127')) {
      isAllowedOrigin = true;
    }
  };
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
  message?: Response,
  status: HttpStatuses = HttpStatuses.OK,
) => response.set({
  [Headers.AllowOrigin]: getStaticOrigin(request.headers.origin),
  [Headers.ContentType]: ContentTypes.Json,
  [Headers.PoweredBy]: 'Colony',
}).status(status).json(message);

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
  variables?: Record<string, any>
) => {
  const options = {
    method: ServerMethods.Post.toUpperCase(),
    headers: {
      [Headers.ApiKey]: process.env.APPSYNC_API_KEY || '',
      [Headers.ContentType]: ContentTypes.Json,
    },
    body: JSON.stringify({
      query: queryOrMutation,
      variables,
    }),
  };

  const request = new NodeFetchRequst(process.env.APPSYNC_API || '', options);

  let body;
  let response;

  try {
    response = await fetch(request);
    body = await response.json();
    return body;
  } catch (error) {
    /*
     * Something went wrong... obviously
     */
    console.error(error);
    return null;
  }
};

export const delay = async (timeout: number) => {
  return new Promise(resolve => {
    setTimeout(resolve, timeout);
  });
}

export const tryFetchGraphqlQuery = async (
  queryOrMutation: string,
  variables?: Record<string, any>,
  maxRetries: number = 3,
  blockTime: number = BLOCK_TIME
) => {
  let currentTry = 0;
  while (true) {
    const { data } = await graphqlRequest(queryOrMutation, variables);

    /*
     * @NOTE That this limits to only fetching one operation at a time
     */
    if (data[Object.keys(data)[0]]) {
      return data[Object.keys(data)[0]];
    }

    if (currentTry < maxRetries) {
      await delay(blockTime);
      currentTry += 1;
    } else {
      throw new Error('Could not fetch graphql data in time');
    }
  }
}
