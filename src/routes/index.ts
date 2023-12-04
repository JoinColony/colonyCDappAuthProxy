import { createProxyMiddleware } from "http-proxy-middleware";

import { RouteHandler, ServerMethods, Urls } from '~types';

import { handleHealthRoute } from './health';
import {
  handleNonceRoute,
  handleAuthRoute,
  handleDeauthRoute,
  handleCheck,
} from './auth';
import { graphQlProxyRouteHandler, operationExecutionHandler } from './graphql';

export { operationExecutionHandler };

const routes: RouteHandler[] = [
  /*
   * Server Health
   */
  {
    method: ServerMethods.Get,
    url: Urls.Health,
    handler: handleHealthRoute,
  },
  /*
   * Auth
   */
  {
    method: ServerMethods.Get,
    url: Urls.Nonce,
    handler: handleNonceRoute,
  },
  {
    method: ServerMethods.Post,
    url: Urls.Auth,
    handler: handleAuthRoute,
  },
  {
    method: ServerMethods.Post,
    url: Urls.DeAuth,
    handler: handleDeauthRoute,
  },
  {
    method: ServerMethods.Get,
    url: Urls.Check,
    handler: handleCheck,
  },
  /*
   * GraphQL
   */
  {
    method: ServerMethods.Use,
    url: Urls.GraphQL,
    handler: createProxyMiddleware(graphQlProxyRouteHandler),
  },
];

export default routes;
