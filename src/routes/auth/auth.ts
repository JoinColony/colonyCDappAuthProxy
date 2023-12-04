import { Response, Request } from 'express-serve-static-core';
import { SiweMessage } from 'siwe';
import dotenv from "dotenv";

import { sendResponse, resetSession, logger } from '~helpers';
import { HttpStatuses, ResponseTypes } from '~types';

dotenv.config();

const defaultCookieExpiration = Number(process.env.COOKIE_EXPIRATION || 3600);

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
    const { data: message } = await SIWEObject.verify({ signature: request.body.signature });

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
