import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import gql from 'graphql-tag';

import routes from '~routes';
import { RequestError } from './RequestError';
import { detectOperation, getStaticOrigin, logger } from './helpers';
import { HttpStatuses, Urls, ServerMethods } from '~types';
import ExpressSession from './ExpressSession';

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
   * Initialize routes
   */
  routes.map(({ method, url, handler }) => proxyServer[method](url, handler));

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

      logger('-----')
      logger('- body')
      logger(req.body);
      if (req.body.query) {
        const graphqlDocument = gql`${req.body.query}`;
        logger('- query');
        logger(gql`${req.body.query}`);
        logger('- definitions');
        logger(graphqlDocument.definitions);
        logger('-');
      }

      const { operationType, operations, variables } = detectOperation(req.body);
      logger('Operation: ', operationType, operations, variables);

      logger('----->')
      return res.sendStatus(HttpStatuses.OK);
    } catch (requestError: RequestError | any) {
      logger('GraphQL request malformed', req.body ? JSON.stringify(req.body) : '');
      return res.status(HttpStatuses.SERVER_ERROR).json(requestError.response);
    }
  });

  return proxyServer;
};

export default proxyServerInstace;
