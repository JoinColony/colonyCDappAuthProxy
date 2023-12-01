import { Response, Request } from 'express-serve-static-core';
import { generateNonce } from 'siwe';

import { sendResponse } from '~helpers';
import { ResponseTypes } from '~types';

export const handleNonceRoute = async (request: Request, response: Response) => {
  request.session.nonce = generateNonce();
  return sendResponse(response, {
    message: 'generated',
    type: ResponseTypes.Nonce,
    data: request.session.nonce || '',
  });
};
