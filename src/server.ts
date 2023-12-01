import dotenv from "dotenv";
import express from "express";
import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import cors from "cors";
import gql from 'graphql-tag';

import {
  handleHealthRoute,
  handleNonceRoute,
  handleAuthRoute,
  handleDeauthRoute,
  handleCheck,
  graphQlProxyRouteHandler,
 } from '~routes';
import ExpressSession from './ExpressSession';
import { RequestError } from './RequestError';
import {
  detectOperation,
  getStaticOrigin,
  sendResponse,
  getRemoteIpAddress,
  resetSession,
} from './helpers';
import {
  ResponseTypes,
  HttpStatuses,
  Urls,
  ContentTypes,
  Headers,
  ServerMethods,
} from '~types';

dotenv.config();

const proxyServerInstace = () => {
  const proxyServer = express();

  proxyServer.use(express.json());

  proxyServer.use(cors({
    origin: getStaticOrigin,
    credentials: true,
  }));

  proxyServer.use(ExpressSession({
    name: process.env.COOKIE_NAME,
    secret: process.env.COOKIE_SECRET || 'pleasechangemebeforegoingintoproduction',
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false, sameSite: true },
  }));

  proxyServer.set('trust proxy', true);

  /*
   * Server Health
   */
  proxyServer[ServerMethods.Get](Urls.Health, handleHealthRoute);

  /*
   * Auth
   */
  proxyServer[ServerMethods.Get](Urls.Nonce, handleNonceRoute);
  proxyServer[ServerMethods.Post](Urls.Auth, handleAuthRoute);
  proxyServer[ServerMethods.Post](Urls.DeAuth, handleDeauthRoute);
  proxyServer[ServerMethods.Get](Urls.Check, handleCheck);

  /*
   * GraphQL
   */
  proxyServer[ServerMethods.Use](Urls.GraphQL, createProxyMiddleware(graphQlProxyRouteHandler));

  // proxyServer.use((req, res, next) => {
  //   const userAuthenticated = req.session.auth;
  //   if (!userAuthenticated) {
  //     return res.status(HttpStatuses.FORBIDDEN).json({ error: 'Forbidden' });
  //   }
  //   return next();
  // });

  proxyServer.post('/test', async (req: any, res: any) => {
    try {
      // verbose

      console.log('-----')
      console.log('- body')
      console.log(req.body);
      if (req.body.query) {
        const graphqlDocument = gql`${req.body.query}`;
        console.log('- query');
        console.log(gql`${req.body.query}`);
        console.log('- definitions');
        console.log(graphqlDocument.definitions);
        console.log('-');
      }

      const { operationType, operations, variables } = detectOperation(req.body);
      console.log('Operation: ', operationType, operations, variables);

      console.log('----->')
      return res.sendStatus(HttpStatuses.OK);
    } catch (requestError: RequestError | any) {
      console.log('GraphQL request malformed', req.body ? JSON.stringify(req.body) : '');
      return res.status(HttpStatuses.SERVER_ERROR).json(requestError.response);
    }
  });

  return proxyServer;
};

export default proxyServerInstace;
