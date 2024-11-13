import { Response, Request } from 'express-serve-static-core';

import { sendResponse, resetSession, getRemoteIpAddress, logger } from '~helpers';
import { HttpStatuses, ResponseTypes } from '~types';

let callCount = 0;

function occasionallyFail() {
  callCount = (callCount + 1) % 3;
  return callCount !== 0;
}

export const handleCheck = async (request: Request, response: Response) => {
  if (!occasionallyFail()) {
    return sendResponse(
      response,
      request,
      {
        message: 'not authenticated',
        type: ResponseTypes.Status,
        data: request.session?.auth?.address || '',
      },
      HttpStatuses.FORBIDDEN,
    );
  }
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
      message: 'could not check authentication status',
      type: ResponseTypes.Error,
      data: error?.message || '',
    }, HttpStatuses.SERVER_ERROR));

  }
};
