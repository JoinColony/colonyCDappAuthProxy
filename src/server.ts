import dotenv from "dotenv";
import express from "express";
import cors from "cors";

import routes from '~routes';

import { getStaticOrigin, isDevMode } from './helpers';
import ExpressSession from './ExpressSession';
import { operationExecutionHandler } from '~routes';

dotenv.config();

const proxyServerInstace = () => {
  const proxyServer = express();

  proxyServer.use(function (req, res, next) {
    // FIXME WOW THIS IS BAD
    if (!isDevMode()){
      req.headers['x-forwarded-proto'] = 'https';
    }
    next();
  });

  proxyServer.use(express.json());

  proxyServer.use(cors({
    origin: getStaticOrigin,
    credentials: true,
  }));

  proxyServer.set('trust proxy', true);

  proxyServer.use(ExpressSession({
    name: process.env.COOKIE_NAME,
    secret: process.env.COOKIE_SECRET || 'pleasechangemebeforegoingintoproduction',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: !isDevMode(), sameSite: true },
  }));

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
