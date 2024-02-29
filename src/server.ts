import dotenv from "dotenv";
import express from "express";
import cors from "cors";

import routes from '~routes';

import { getStaticOrigin, isDevMode } from './helpers';
import ExpressSession from './ExpressSession';
import { operationExecutionHandler } from '~routes';
import { Headers } from "~types";

dotenv.config();

const proxyServerInstace = () => {
  const proxyServer = express();

  proxyServer.use(function (req, res, next) {
    // This is not ideal, but better than it was.
    // Get the last protocol in the chain, and if it's https, set the header to just https
    // if we're not in devmode
    const xForwardedHeaders = req.headers[Headers.ForwardedProto];
    if (!xForwardedHeaders || isDevMode()) {
      // If there weren't any headers, or we're in devmode, just return
      return next();
    }
    let xForwardedHeadersAsString = "";

    // So there were headers, and we're not in devmode.
    if (typeof xForwardedHeaders === "string") {
      xForwardedHeadersAsString = xForwardedHeaders;
    } else {
      xForwardedHeadersAsString = xForwardedHeaders.join(', ');
    }
    if (xForwardedHeadersAsString.split(', ').at(-1) === 'https'){
      req.headers[Headers.ForwardedProto] = 'https';
    }
    return next();
  });

  proxyServer.use(express.json({ limit: '1mb' }));

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
