import dotenv from 'dotenv';
import { Options } from 'http-proxy-middleware';
import { Response, Request } from 'express-serve-static-core';
import { IncomingMessage, ClientRequest } from 'http';

// Needs to be ignored since it doesn't have types and TS goe crazy
//@ts-ignore
import modifyResponse from 'node-http-proxy-json';

import { logger, getStaticOrigin, sendResponse } from '~helpers';
import { ContentTypes, Headers, HttpStatuses, ResponseTypes } from '~types';
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
  onProxyReq: (proxyRequest: ClientRequest) => {
    if (!process.env.SEGMENT_WRITE_KEY) {
      proxyRequest.abort();
    }
  },
  onProxyRes: (proxyResponse: IncomingMessage, request: Request, response: Response) => {
    proxyResponse.headers[Headers.AllowOrigin] = getStaticOrigin(
      request.headers.origin,
    );
    proxyResponse.headers[Headers.PoweredBy] = 'Colony';

    if (proxyResponse.statusCode !== HttpStatuses.OK) {
      logger(`Could not proxy SEGMENT settings for project "${process.env.SEGMENT_WRITE_KEY}". The service will not function until this can be retrieved`);
      return sendResponse(response, request, {
        message: 'Cannot fetch project',
        type: ResponseTypes.Error,
        data: '',
      }, HttpStatuses.BAD_REQUEST);
    }

    modifyResponse(response, proxyResponse, (body: Record<string, any>) => {
      try {
        if (body) {
          // Don't return the API key to the client
          // so that it doesn't get exposed
          delete body.integrations['Segment.io'].apiKey;
        }
      } catch (error) {
        proxyResponse.destroy();
      }
      return body;
    });
    logger(`Proxied SEGMENT settings for project "${process.env.SEGMENT_WRITE_KEY}"`);
  },
  logProvider: () => ({
    log: logger,
    info: logger,
    error: logger,
    warn: logger,
    debug: logger,
  }),
};
