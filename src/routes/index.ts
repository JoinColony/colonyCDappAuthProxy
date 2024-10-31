import { createProxyMiddleware } from "http-proxy-middleware";

import { RouteHandler, ExpressServerMethods, Urls } from '~types';

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
    method: ExpressServerMethods.Get,
    url: Urls.Health,
    handler: handleHealthRoute,
  },
  /*
   * Auth
   */
  {
    method: ExpressServerMethods.Get,
    url: Urls.Nonce,
    handler: handleNonceRoute,
  },
  {
    method: ExpressServerMethods.Post,
    url: Urls.Auth,
    handler: handleAuthRoute,
  },
  {
    method: ExpressServerMethods.Post,
    url: Urls.DeAuth,
    handler: handleDeauthRoute,
  },
  {
    method: ExpressServerMethods.Get,
    url: Urls.Check,
    handler: handleCheck,
  },
  /*
   * GraphQL
   */
  {
    method: ExpressServerMethods.Use,
    url: Urls.GraphQL,
    handler: createProxyMiddleware(graphQlProxyRouteHandler),
  },
];

export default routes;
