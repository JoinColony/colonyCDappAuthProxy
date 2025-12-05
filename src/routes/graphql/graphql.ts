import dotenv from 'dotenv';
import { fixRequestBody, Options, RequestHandler } from 'http-proxy-middleware';
import { Response, Request, NextFunction } from 'express-serve-static-core';
import { ClientRequest, IncomingMessage } from 'http';
import { parse } from 'graphql';

import {
  getStaticOrigin,
  sendResponse,
  getRemoteIpAddress,
  logger,
} from '~helpers';
import {
  ResponseTypes,
  HttpStatuses,
  ContentTypes,
  Headers,
  Urls,
  ServerMethods,
} from '~types';
import { validateRequest } from '../../validateRequest';
import { rules } from '../../rules';
import { getSchema } from '../../schema';

dotenv.config();

export const operationExecutionHandler: RequestHandler = async (
  request: Request,
  response: Response,
  nextFn: NextFunction,
) => {
  // short circut early
  if (
    request.path !== Urls.GraphQL ||
    request.method !== ServerMethods.Post.toUpperCase()
  ) {
    return nextFn();
  }

  const userAddress = request.session.auth?.address;
  const requestRemoteAddress = getRemoteIpAddress(request);

  try {
    const schema = getSchema();
    if (!schema) {
      throw new Error('Schema not initialized');
    }

    const document = parse(request.body.query);
    const ctx = {
      userAddress,
      variables: request.body.variables ?? {},
    };

    /*
     * @NOTE Handle async GraphQL logic to decide if we allow an operation or not
     */
    response.locals.canExecute = await validateRequest(
      document,
      schema,
      rules,
      ctx,
    );
    return nextFn();
  } catch (error: any) {
    logger(
      `${
        userAddress ? `auth-${userAddress}` : 'non-auth'
      } request malformed graphql ${
        request.body ? JSON.stringify(request.body) : ''
      } from ${requestRemoteAddress}`,
    );
    return sendResponse(
      response,
      request,
      {
        message: error?.message || 'graphql parsing error',
        type: ResponseTypes.Error,
        data: '',
      },
      HttpStatuses.SERVER_ERROR,
    );
  }
};

export const graphQlProxyRouteHandler: Options = {
  target: process.env.APPSYNC_API,
  changeOrigin: true,
  headers: {
    [Headers.ApiKey]: process.env.APPSYNC_API_KEY || '',
    [Headers.ContentType]: ContentTypes.Json,
  },
  pathRewrite: { '^/graphql': '' },
  onProxyReq: (
    proxyRequest: ClientRequest,
    request: Request,
    response: Response,
  ) => {
    const userAuthenticated = !!request.session.auth;
    const userAddress = request.session.auth?.address || '';
    const requestRemoteAddress = getRemoteIpAddress(request);

    const canExecute = response.locals.canExecute;

    logger(
      `${userAuthenticated ? 'auth' : 'non-auth'} request${
        userAddress ? ` from ${userAddress}` : ''
      } at ${requestRemoteAddress} was ${
        canExecute ? '\x1b[32m ALLOWED \x1b[0m' : '\x1b[31m FORBIDDEN \x1b[0m'
      }`,
    );

    // Allowed
    if (canExecute) {
      proxyRequest.setHeader(Headers.WalletAddress, userAddress);
      return fixRequestBody(proxyRequest, request);
    }

    // Forbidden
    return sendResponse(
      response,
      request,
      {
        message: 'forbidden',
        type: ResponseTypes.Auth,
        data: '',
      },
      HttpStatuses.FORBIDDEN,
    );
  },
  // selfHandleResponse: true,
  onProxyRes: (proxyResponse: IncomingMessage, request: Request) => {
    proxyResponse.headers[Headers.AllowOrigin] = getStaticOrigin(
      request.headers.origin,
    );
    proxyResponse.headers[Headers.PoweredBy] = 'Colony';
  },
  logProvider: () => ({
    log: logger,
    info: logger,
    error: logger,
    warn: logger,
    debug: logger,
  }),
};
