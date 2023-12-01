import dotenv from "dotenv";
import express from "express";
import { createProxyMiddleware, fixRequestBody, responseInterceptor } from "http-proxy-middleware";
import cors from "cors";
import { generateNonce, SiweMessage } from 'siwe';
import gql from 'graphql-tag';

import { handleHealthRoute } from '~routes';
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
  RequestMethods,
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

  proxyServer[RequestMethods.Get](Urls.Health, handleHealthRoute);

  proxyServer.get(
    Urls.Nonce,
    async (req, res) => {
      req.session.nonce = generateNonce();
      return sendResponse(res, {
        message: 'generated',
        type: ResponseTypes.Nonce,
        data: req.session.nonce || '',
      });
    },
  );

  proxyServer.post(
    Urls.Auth,
    async (req, res) => {
      try {
        if (!req.body.message) {
          return sendResponse(res, {
            message: 'expected message object as body',
            type: ResponseTypes.Error,
            data: '',
          }, HttpStatuses.UNPROCESSABLE)
        }

        let SIWEObject = new SiweMessage(req.body.message);
        const { data: message } = await SIWEObject.verify({ signature: req.body.signature, nonce: req.session.nonce });

        req.session.auth = message;
        req.session.cookie.expires = new Date(message?.expirationTime || new Date(Date.now() + 3600000));

        console.log(`User ${message.address} was authenticated successfully.`, { message, signature: req.body.signature, nonce: req.session.nonce, cookie: req.session.cookie });

        return req.session.save(() => sendResponse(res, {
          message: 'authenticated',
          type: ResponseTypes.Auth,
          data: message.address || '',
        }));

      } catch (e: any) {
        resetSession(req);
        return req.session.save(() => sendResponse(res, {
          message: e.message.toLowerCase(),
          type: ResponseTypes.Error,
          data: '',
        }, HttpStatuses.SERVER_ERROR));
      }
    },
  );

  proxyServer.post(
    Urls.DeAuth,
    async (req, res) => {
      try {
        const requestRemoteAddress = getRemoteIpAddress(req);
        if (req.session.auth) {
          const oldAddress = req.session.auth.address;
          console.log(`Request to deauthenticate was successful ip: ${requestRemoteAddress} address: ${req.session?.auth?.address} cookie: ${req.headers.cookie}`)
          resetSession(req);
          return req.session.save(() => sendResponse(res, {
            message: 'deauthenticated',
            type: ResponseTypes.Auth,
            data: oldAddress || '',
          }));
        }
        console.log(`Unauthentication user requested deauthentication ip: ${requestRemoteAddress} cookie: ${req.headers.cookie}`);
        return res.status(HttpStatuses.FORBIDDEN).json({ message: 'no deauthentication possible', type: ResponseTypes.Auth, data: '' });
      } catch (e: any) {
        resetSession(req);
        return req.session.save(() => sendResponse(res, {
          message: e.message.toLowerCase(),
          type: ResponseTypes.Error,
          data: '',
        }, HttpStatuses.SERVER_ERROR));
      }
    },
  );

  proxyServer.get(
    Urls.Check,
    async (req, res) => {
      try {
        const userAuthenticated = !!req.session.auth;
        const requestRemoteAddress = getRemoteIpAddress(req);

        console.log(`Request to check authentication ip: ${requestRemoteAddress} address: ${req.session?.auth?.address} authenticated: ${userAuthenticated} cookie: ${req.headers.cookie}`)

        return sendResponse(res, {
          message: userAuthenticated ? 'authenticated' : 'not authenticated',
          type: ResponseTypes.Status,
          data: req.session?.auth?.address || '',
        }, userAuthenticated ? HttpStatuses.OK : HttpStatuses.FORBIDDEN)
      } catch (e: any) {
        resetSession(req);
        return req.session.save(() => sendResponse(res, {
          message: e.message.toLowerCase(),
          type: ResponseTypes.Error,
          data: '',
        }, HttpStatuses.SERVER_ERROR));
      }
    },
  );

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

  proxyServer.use(Urls.GraphQL, createProxyMiddleware({
    target: process.env.APPSYNC_API,
    changeOrigin: true,
    headers: {
      [Headers.ApiKey]: process.env.APPSYNC_API_KEY || '',
      [Headers.ContentType]: ContentTypes.Json,
    },
    pathRewrite: { '^/graphql': '' },
    onProxyReq: (proxyReq, req, res) => {
      const userAuthenticated = !!req.session.auth;
      const requestRemoteAddress = getRemoteIpAddress(req);
      // console.log({ proxyReq, req, res });
      // console.log(req.body);
      if (req.body.query) {
        const requestContainsMutation = JSON.stringify(req.body).includes('mutation');
        const operationName = req.body.operationName ? req.body.operationName : '';
        const variables = req.body.variables ? JSON.stringify(req.body.variables) : '';
        console.log(`[${userAuthenticated ? `AUTHENTICATED ${req.session.auth?.address}` : 'UNAUTHENTICATED'}]`, requestContainsMutation ? 'mutation' : 'query', operationName, variables);
        if (requestContainsMutation) {
          if (operationName === 'UpdateContributorsWithReputation') {
            if (userAuthenticated) {
              return fixRequestBody(proxyReq, req);
            }
          }
          console.log('UNAUTHENTICATED! Request did not go through.');
          return sendResponse(res, {
            message: 'forbidden',
            type: ResponseTypes.Auth,
            data: '',
          }, HttpStatuses.FORBIDDEN);
        }
        return fixRequestBody(proxyReq, req);
        // console.log(req.body);
        // console.log(req.headers);
        // const { definitions, ...rest } = gql`${req.body.query}`;
        // const requestContainsMutation = (definitions as any[]).some(({ operation }) => operation === 'mutation');
        // const operationNames = (definitions as any[]).map(({ name }) => {
        //   if (!!name?.kind) {
        //     return name.value;
        //   }
        //   return name;
        // });
        // console.log(requestContainsMutation ? 'mutation' : 'query', operationNames.join(', '));
        // if (requestContainsMutation) {
        //   console.log('-----------------------');
        //   console.log(JSON.stringify(definitions));
        //   console.log(req.body)
        //   console.log('-----------------------');
        // }
      }
      console.log(`GraphQL request malformed ip: ${requestRemoteAddress} address: ${req.session?.auth?.address} authenticated: ${userAuthenticated} cookie: ${req.headers.cookie} body: ${req.body ? JSON.stringify(req.body) : ''}`);
      return sendResponse(res, {
        message: 'malformed graphql request',
        type: ResponseTypes.Error,
        data: '',
      }, HttpStatuses.SERVER_ERROR);
    },
    // selfHandleResponse: true,
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers[Headers.AllowOrigin] = getStaticOrigin(req.headers.origin);
      proxyRes.headers[Headers.PoweredBy] = 'Colony';
    },
  }));

  return proxyServer;
};

export default proxyServerInstace;
