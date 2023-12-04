import { Response, Request } from 'express-serve-static-core';
import { generateNonce } from 'siwe';

import { sendResponse } from '~helpers';
import { ResponseTypes } from '~types';

export const handleNonceRoute = async (request: Request, response: Response) => {
  const nonce = generateNonce();
  return sendResponse(response, request, {
    message: 'generated',
    type: ResponseTypes.Nonce,
    data: nonce || '',
  });
};
