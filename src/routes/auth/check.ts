import { Response, Request } from 'express-serve-static-core';

import { sendResponse, resetSession, getRemoteIpAddress, logger } from '~helpers';
import { HttpStatuses, ResponseTypes } from '~types';

export const handleCheck = async (request: Request, response: Response) => {
  try {
    const userAuthenticated = !!request.session.auth;
    const requestRemoteAddress = getRemoteIpAddress(request);

    logger(`Request to check authentication ip: ${requestRemoteAddress} address: ${request.session?.auth?.address} authenticated: ${userAuthenticated} cookie: ${request.headers.cookie}`)

    return sendResponse(response, request, {
      message: userAuthenticated ? 'authenticated' : 'not authenticated',
      type: ResponseTypes.Status,
      data: request.session?.auth?.address || '',
    }, userAuthenticated ? HttpStatuses.OK : HttpStatuses.FORBIDDEN)

  } catch (error: any) {

    resetSession(request);

    return request.session.save(() => sendResponse(response, request, {
      message: error.message.toLowerCase(),
      type: ResponseTypes.Error,
      data: '',
    }, HttpStatuses.SERVER_ERROR));
  }
};
