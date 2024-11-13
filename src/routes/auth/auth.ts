import { Response, Request } from 'express-serve-static-core';
import { SiweMessage } from 'siwe';
import dotenv from "dotenv";

import { sendResponse, resetSession, logger } from '~helpers';
import { HttpStatuses, ResponseTypes } from '~types';

dotenv.config();

const defaultCookieExpiration = Number(process.env.COOKIE_EXPIRATION || 3600);

let callCount = 0;

function occasionallyFail() {
  callCount = (callCount + 1) % 3;
  return callCount !== 0;
}

export const handleAuthRoute = async (request: Request, response: Response) => {
  if (!occasionallyFail()) {
    resetSession(request);
    return request.session.save(() =>
      sendResponse(
        response,
        request,
        {
          message: 'could not authenticate',
          type: ResponseTypes.Error,
          data: '',
        },
        HttpStatuses.SERVER_ERROR,
      ),
    );
  }
  try {
    if (!request.body.message) {
      return sendResponse(response, request, {
        message: 'expected message object as body',
        type: ResponseTypes.Error,
        data: '',
      }, HttpStatuses.UNPROCESSABLE)
    }

    let SIWEObject = new SiweMessage(request.body.message);
    if (!request.session.nonce) {
      return sendResponse(response, request, {
        message: 'No nonce found in session. Please request a nonce first.',
        type: ResponseTypes.Error,
        data: '',
      }, HttpStatuses.UNPROCESSABLE);
    }
    const { data: message } = await SIWEObject.verify({ signature: request.body.signature, nonce: request.session.nonce });

    request.session.auth = message;
    request.session.cookie.expires = new Date(Date.now() + (defaultCookieExpiration * 1000));
    request.session.cookie.httpOnly = true;

    logger(`User ${message.address} was authenticated successfully.`);

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
