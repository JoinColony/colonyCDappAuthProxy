import { Response, ResponseTypes } from '~types';

export class RequestError extends Error {
  response: Response;

  constructor(message: string, data: string | number | boolean | string[] | number[] | boolean[] = '') {
    super(message);
    this.name = 'RequestError';
    this.response = {
      message,
      type: ResponseTypes.Error,
      data,
    };
  }
}
