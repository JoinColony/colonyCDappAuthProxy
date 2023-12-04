import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import gql from 'graphql-tag';

import routes from '~routes';
import { HttpStatuses } from '~types';

import { RequestError } from './RequestError';
import { detectOperation, getStaticOrigin, logger, isDevMode } from './helpers';
import ExpressSession from './ExpressSession';
import { operationExecutionHandler } from '~routes';

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
    resave: false,
    saveUninitialized: true,
    cookie: { secure: !isDevMode(), sameSite: true },
  }));

  proxyServer.set('trust proxy', true);

  /*
   * @NOTE Handle async GraphQL logic to decide if we allow a operation or not
   */
  proxyServer.use(operationExecutionHandler);

  /*
   * Initialize routes
   */
  routes.map(({ method, url, handler }) => proxyServer[method](url, handler));

  return proxyServer;
};

export default proxyServerInstace;
