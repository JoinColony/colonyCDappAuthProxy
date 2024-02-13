import dotenv from 'dotenv';
import { Options } from 'http-proxy-middleware';
import { Response, Request } from 'express-serve-static-core';
import { IncomingMessage } from 'http';

// Needs to be ignored since it doesn't have types and TS goe crazy
//@ts-ignore
import modifyResponse from 'node-http-proxy-json';

import { logger } from '~helpers';
import { ContentTypes, Headers,} from '~types';
import { ExternalUrls } from '~constants';

dotenv.config();

export const segmentProjectsProxyRouteHandler: Options = {
  target: ExternalUrls.SegmentCDN,
  changeOrigin: true,
  headers: {
    [Headers.ContentType]: ContentTypes.Json,
  },
  // path includes the api key, which is the index used to access
  // the project settings
  pathRewrite: () => `/v1/projects/${process.env.SEGMENT_WRITE_KEY}/settings`,
  onProxyRes: (proxyResponse: IncomingMessage, request: Request, response: Response) => {
    modifyResponse(response, proxyResponse, (body: Record<string, any>) => {
      if (body) {
        // Don't return the API key to the client
        // so that it doesn't get exposed
        delete body.integrations['Segment.io'].apiKey;
      }
      return body;
    });
    logger(`Forwarded SEGMENT settings for project ${process.env.SEGMENT_WRITE_KEY}`);
  },
  logProvider: () => ({
    log: logger,
    info: logger,
    error: logger,
    warn: logger,
    debug: logger,
  }),
};
