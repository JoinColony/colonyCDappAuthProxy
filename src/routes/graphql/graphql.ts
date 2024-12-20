import dotenv from 'dotenv';
import { fixRequestBody, Options, RequestHandler } from 'http-proxy-middleware';
import { Response, Request, NextFunction } from 'express-serve-static-core';
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
  Urls,
  ServerMethods,
} from '~types';

import addressCanExecuteMutation from './mutations';
import addressCanExecuteQuery from './queries';

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

  const userAddress = request.session.auth?.address || '';
  const requestRemoteAddress = getRemoteIpAddress(request);

  try {
    response.locals.canExecuteMutation = await addressCanExecuteMutation(
      request,
    );
    response.locals.canExecuteQuery = await addressCanExecuteQuery(request);
    return nextFn();
  } catch (error: any) {
    logger(
      `${
        userAddress ? `auth-${userAddress}` : 'non-auth'
      } request malformed graphql ${
        request.body ? JSON.stringify(request.body) : ''
      } from ${requestRemoteAddress}`,
    );
    return sendResponse(response, request, error, HttpStatuses.SERVER_ERROR);
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
    try {
      if (request?.body?.query) {
        /*
         * Used for UI only, the real magic with detection happens in operationExecutionHandler
         */
        const { operationType, operations, variables } = detectOperation(
          request.body,
        );

        /*
         * Mutations need to be handled on a case by case basis
         * Some are allowed without auth (cache refresh ones)
         * Others based on if the user has the appropriate address and/or role
         */
        const canExecuteMutation =
          operationType === OperationTypes.Mutation &&
          response.locals.canExecuteMutation;

        /*
         * By default, all queries are allowed
         * However, some will not execute correctly if a user address is not provided
         */
        const canExecuteQuery =
          operationType === OperationTypes.Query &&
          response.locals.canExecuteQuery;

        const canExecute = canExecuteMutation || canExecuteQuery;

        logger(
          `${
            userAuthenticated ? `auth` : 'non-auth'
          } ${operationType} ${operations} ${JSON.stringify(variables).slice(
            0,
            500,
          )}${
            JSON.stringify(variables).length > 499
              ? ` [+${JSON.stringify(variables).length - 499} chars more]`
              : ''
          }${
            userAddress ? ` from ${userAddress}` : ''
          } at ${requestRemoteAddress} was ${
            canExecute
              ? '\x1b[32m ALLOWED \x1b[0m'
              : '\x1b[31m FORBIDDEN \x1b[0m'
          }`,
        );

        // allowed
        if (canExecute) {
          proxyRequest.setHeader(Headers.WalletAddress, userAddress);
          return fixRequestBody(proxyRequest, request);
        }

        // forbidden
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
      }

      /*
       * Malformed request
       */
      logger(
        `${userAuthenticated ? `auth` : 'non-auth'} request malformed graphql ${
          request.body ? JSON.stringify(request.body) : ''
        }${
          userAddress ? ` from ${userAddress}` : ''
        } at ${requestRemoteAddress}`,
      );
      return sendResponse(
        response,
        request,
        {
          message: 'malformed graphql request',
          type: ResponseTypes.Error,
          data: '',
        },
        HttpStatuses.SERVER_ERROR,
      );
    } catch (error: any) {
      /*
       * GraphQL error (comes from the AppSync endopoint)
       */
      logger(
        `${userAuthenticated ? `auth` : 'non-auth'} graphql proxy error ${
          error?.message
        } ${request.body ? JSON.stringify(request.body) : ''}${
          userAddress ? ` from ${userAddress}` : ''
        } at ${requestRemoteAddress}`,
      );
      return sendResponse(
        response,
        request,
        {
          message: 'graphql error',
          type: ResponseTypes.Error,
          data: error?.message || '',
        },
        HttpStatuses.SERVER_ERROR,
      );
    }
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
