import dotenv from "dotenv";
import { fixRequestBody, Options } from "http-proxy-middleware";
import { Response, Request } from 'express-serve-static-core';
import { ClientRequest, IncomingMessage } from 'http';

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
} from '~types';

dotenv.config();

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
    const requestRemoteAddress = getRemoteIpAddress(request);
    // logger({ proxyReq, req, res });
    // logger(req.body);
    if (request.body.query) {
      const requestContainsMutation = JSON.stringify(request.body).includes('mutation');
      const operationName = request.body.operationName ? request.body.operationName : '';
      const variables = request.body.variables ? JSON.stringify(request.body.variables) : '';
      logger(`[${userAuthenticated ? `AUTHENTICATED ${request.session.auth?.address}` : 'UNAUTHENTICATED'}]`, requestContainsMutation ? 'mutation' : 'query', operationName, variables);
      if (requestContainsMutation) {
        if (operationName === 'UpdateContributorsWithReputation') {
          if (userAuthenticated) {
            return fixRequestBody(proxyRequest, request);
          }
        }
        logger('UNAUTHENTICATED! Request did not go through.');
        return sendResponse(response, {
          message: 'forbidden',
          type: ResponseTypes.Auth,
          data: '',
        }, HttpStatuses.FORBIDDEN);
      }
      return fixRequestBody(proxyRequest, request);
      // logger(req.body);
      // logger(req.headers);
      // const { definitions, ...rest } = gql`${req.body.query}`;
      // const requestContainsMutation = (definitions as any[]).some(({ operation }) => operation === 'mutation');
      // const operationNames = (definitions as any[]).map(({ name }) => {
      //   if (!!name?.kind) {
      //     return name.value;
      //   }
      //   return name;
      // });
      // logger(requestContainsMutation ? 'mutation' : 'query', operationNames.join(', '));
      // if (requestContainsMutation) {
      //   logger('-----------------------');
      //   logger(JSON.stringify(definitions));
      //   logger(req.body)
      //   logger('-----------------------');
      // }
    }
    logger(`GraphQL request malformed ip: ${requestRemoteAddress} address: ${request.session?.auth?.address} authenticated: ${userAuthenticated} cookie: ${request.headers.cookie} body: ${request.body ? JSON.stringify(request.body) : ''}`);
    return sendResponse(response, {
      message: 'malformed graphql request',
      type: ResponseTypes.Error,
      data: '',
    }, HttpStatuses.SERVER_ERROR);
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
