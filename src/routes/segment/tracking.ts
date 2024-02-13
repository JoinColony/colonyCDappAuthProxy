import dotenv from 'dotenv';
import { Response, Request } from 'express-serve-static-core';
import { default as fetch, Request as NodeFetchRequst } from 'node-fetch';

import { sendResponse, logger } from '~helpers';
import {
  RequestMethods,
  ContentTypes,
  Headers,
  ResponseTypes,
  StreamEvent,
  Encoding,
} from '~types';
import { ExternalUrls } from '~constants';

dotenv.config();

// Handles all tracking endpoints: identify, track, page, screen, group, alias
export const handleSegmentTracking = async (request: Request, response: Response) => {
  request.on(StreamEvent.Readable, () => {
    const { 0: path } = request.params;
    const data = request.read();
    if (data) {
      const payload = JSON.parse(data.toString(Encoding.Utf8));
      payload.writeKey = process.env.SEGMENT_WRITE_KEY;

      const forwardRequest = new NodeFetchRequst(
        `${ExternalUrls.SegmentAPI}/${path}`,
        {
          method: RequestMethods.Post,
          headers: {
            [Headers.ContentType]: ContentTypes.Json,
          },
          body: JSON.stringify(payload),
        }
      );

      fetch(forwardRequest);

      logger(
        `Forwarded SEGMENT "${payload.type}" event ${
          payload.type === 'identify' ? `for user ${payload.userId}` : ''
        }${
          payload.type === 'group' ? `for colony ${payload.groupId}` : ''
        }${
          payload.type === 'track' ? `"${payload.event}"` : ''
        }`,
      );
    }
  });

  // We don't really need or care about the response from segment so we can
  // just make the client happy
  return sendResponse(response, request, {
    message: 'ok',
    type: ResponseTypes.UIEvent,
    data: '',
  });
};
