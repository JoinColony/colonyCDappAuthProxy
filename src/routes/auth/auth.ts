import { Response, Request } from 'express-serve-static-core';
import { SiweMessage } from 'siwe';

import { sendResponse, resetSession, logger } from '~helpers';
import { HttpStatuses, ResponseTypes } from '~types';

export const handleAuthRoute = async (request: Request, response: Response) => {
  try {
    if (!request.body.message) {
      return sendResponse(response, request, {
        message: 'expected message object as body',
        type: ResponseTypes.Error,
        data: '',
      }, HttpStatuses.UNPROCESSABLE)
    }

    let SIWEObject = new SiweMessage(request.body.message);
    const { data: message } = await SIWEObject.verify({ signature: request.body.signature, nonce: request.session.nonce });

    resetSession(request);
    request.session.auth = message;
    request.session.cookie.expires = new Date(message?.expirationTime || new Date(Date.now() + 3600000));
    request.session.cookie.httpOnly = false; // read the cookie in the frontend

    logger(`User ${message.address} was authenticated successfully.`, { message, signature: request.body.signature, nonce: request.session.nonce, cookie: request.session.cookie });

    return request.session.save(() => sendResponse(response, request, {
      message: 'authenticated',
      type: ResponseTypes.Auth,
      data: message.address || '',
    }));

  } catch (error: any) {

    resetSession(request);
    return request.session.save(() => sendResponse(response, request, {
      message: 'could not authenticate',
      type: ResponseTypes.Error,
      data: error?.message || '',
    }, HttpStatuses.SERVER_ERROR));

  }
};
