import { Response, Request } from 'express-serve-static-core';

import { sendResponse, resetSession, getRemoteIpAddress, logger } from '~helpers';
import { HttpStatuses, ResponseTypes } from '~types';

export const handleDeauthRoute = async (request: Request, response: Response) => {
  try {
    const requestRemoteAddress = getRemoteIpAddress(request);
    if (request.session.auth) {
      const oldAddress = request.session.auth.address;
      logger(`Request to deauthenticate was successful ip: ${requestRemoteAddress} address: ${request.session?.auth?.address} cookie: ${request.headers.cookie}`)
      resetSession(request);
      return request.session.save(() => sendResponse(response, {
        message: 'deauthenticated',
        type: ResponseTypes.Auth,
        data: oldAddress || '',
      }));
    }
    logger(`Unauthentication user requested deauthentication ip: ${requestRemoteAddress} cookie: ${request.headers.cookie}`);
    return response.status(HttpStatuses.FORBIDDEN).json({ message: 'no deauthentication possible', type: ResponseTypes.Auth, data: '' });
  } catch (error: any) {
    resetSession(request);
    return request.session.save(() => sendResponse(response, {
      message: error.message.toLowerCase(),
      type: ResponseTypes.Error,
      data: '',
    }, HttpStatuses.SERVER_ERROR));
  }
};
