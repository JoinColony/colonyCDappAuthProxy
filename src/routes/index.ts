import { createProxyMiddleware } from "http-proxy-middleware";
import { default as fetch, Request as NodeFetchRequst } from 'node-fetch';

import { RouteHandler, ServerMethods, Urls } from '~types';

import { handleHealthRoute } from './health';
import {
  handleNonceRoute,
  handleAuthRoute,
  handleDeauthRoute,
  handleCheck,
} from './auth';
import { graphQlProxyRouteHandler, operationExecutionHandler } from './graphql';
import { segmentProjectsProxyRouteHandler } from './segment';

import {
  ContentTypes,
  Headers,
} from '~types';

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
  /*
   * Segment
   */
  {
    method: ServerMethods.Get,
    url: Urls.SegmentProjects,
    handler: createProxyMiddleware(segmentProjectsProxyRouteHandler),
  },
  {
    method: ServerMethods.Post,
    url: Urls.SegmentTrack,
    handler: async (req, res) => {
      req.on('readable', () => {
        const { 0: path } = req.params;
        const data = req.read();
        if (data) {
          const payload = JSON.parse(data.toString('utf8'));
          payload.writeKey = 'x21qJNImACGnCDOBqfUGBEUJSgExPrmZ';
          const forwardRequest = new NodeFetchRequst(
            `https://api.segment.io/v1/${path}`,
            {
              method: ServerMethods.Post.toUpperCase(),
              headers: {
                [Headers.ContentType]: ContentTypes.Json,
              },
              body: JSON.stringify(payload),
            }
          );
          fetch(forwardRequest);
        }
      });
      return res.status(200).json({ message: 'ok' });
    },

  },
];

export default routes;
