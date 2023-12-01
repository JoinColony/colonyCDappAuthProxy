import { Response, Request } from 'express-serve-static-core';

import { sendResponse } from '~helpers';
import { ResponseTypes } from '~types';

const handleHealthRoute = async (request: Request, response: Response) => sendResponse(response, {
  message: 'ok',
  type: ResponseTypes.Health,
  data: '',
})

export default handleHealthRoute;
