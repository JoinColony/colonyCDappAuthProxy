import dotenv from "dotenv";
import { fixRequestBody, Options } from "http-proxy-middleware";
import { Response, Request } from 'express-serve-static-core';
import { ClientRequest, IncomingMessage } from 'http';

import {
  getStaticOrigin,
  sendResponse,
  getRemoteIpAddress,
  logger,
  detectOperation,
} from '~helpers';
import {
  ResponseTypes,
  HttpStatuses,
  ContentTypes,
  Headers,
  OperationTypes,
} from '~types';

import addressCanExecuteMutation from './mutations';

dotenv.config();

export const graphQlProxyRouteHandler: Options = {
  target: process.env.APPSYNC_API,
  changeOrigin: true,
  headers: {
    [Headers.ApiKey]: process.env.APPSYNC_API_KEY || '',
    [Headers.ContentType]: ContentTypes.Json,
  },
  pathRewrite: { '^/graphql': '' },
  onProxyReq: async (
    proxyRequest: ClientRequest,
    request: Request,
    response: Response,
  ) => {
    const userAuthenticated = !!request.session.auth;
    const userAddress = request.session.auth?.address || '';
    const requestRemoteAddress = getRemoteIpAddress(request);
    try {
      if (request?.body?.query) {
        const { operationType, operations, variables } = detectOperation(request.body);

        logger(`${userAuthenticated ? `auth-${userAddress}` : 'non-auth'} ${operationType} ${operations} ${JSON.stringify(variables)} from ${requestRemoteAddress}`);

        /*
         * Allow all queries
         */
        if (operationType === OperationTypes.Query) {
          return fixRequestBody(proxyRequest, request);
        }

        /*
         * Mutations need to be handled on a case by case basis
         * Some are allowed without auth (cache refresh ones)
         * Others based on if the user has the appropriate address and/or role
         */
        const canExecute = await addressCanExecuteMutation(operations, userAddress);

        // allowed
        if (canExecute) {
          return fixRequestBody(proxyRequest, request);
        }

        // not allowed
        return sendResponse(response, request, {
          message: 'forbidden',
          type: ResponseTypes.Auth,
          data: '',
        }, HttpStatuses.FORBIDDEN);
      }
      logger(`${userAuthenticated ? `auth-${userAddress}` : 'non-auth'} request malformed graphql ${request.body ? JSON.stringify(request.body) : ''} from ${requestRemoteAddress}`);
      return sendResponse(response, request, {
        message: 'malformed graphql request',
        type: ResponseTypes.Error,
        data: '',
      }, HttpStatuses.SERVER_ERROR);
    } catch (error: any) {
      logger(`${userAuthenticated ? `auth-${userAddress}` : 'non-auth'} graphql proxy error ${error?.message} ${request.body ? JSON.stringify(request.body) : ''} from ${requestRemoteAddress}`);
      return sendResponse(response, request, {
        message: 'graphql error',
        type: ResponseTypes.Error,
        data: error?.message || '',
      }, HttpStatuses.SERVER_ERROR);
    }
  },
  // selfHandleResponse: true,
  onProxyRes: (
    proxyResponse: IncomingMessage,
    request: Request,
  ) => {
    proxyResponse.headers[Headers.AllowOrigin] = getStaticOrigin(request.headers.origin);
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
