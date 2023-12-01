import gql from 'graphql-tag';
import { Response as ExpressResponse, Request } from 'express-serve-static-core';

import { RequestError } from './RequestError';
import {
  OperationTypes,
  StaticOriginCallback,
  HttpStatuses,
  Response,
  Headers,
} from '~types';

export const isDevMode = (): boolean => process.env.NODE_ENV !== 'prod';

export const detectOperation = (body: Record<string, any>): {
  operationType: OperationTypes,
  operations: string[],
  variables?: string,
} => {
  let isMutation = false;

  if (!body) {
    throw new RequestError('no body');
  }
  if (!body?.query) {
    throw new RequestError('graphql request malformed');
  }

  if (JSON.stringify(body).includes(OperationTypes.Mutation)) {
    isMutation = true;
  }

  const graphqlDocument = gql`${body.query}`;

  graphqlDocument.definitions.map((definition: any) => {
    if (definition.operation === OperationTypes.Mutation) {
      isMutation = true;
    }
  });

  const operations = graphqlDocument.definitions.map((definition: any) => {
    return definition.selectionSet.selections.map((selection: any) => selection?.name?.value);
  }).flat();

  return {
    operationType: isMutation ? OperationTypes.Mutation : OperationTypes.Query,
    operations,
    variables: body.variables ? JSON.stringify(body.variables) : undefined,
  };
};

export const getStaticOrigin = (origin?: string, callback?: StaticOriginCallback): string | undefined => {
  let isAllowedOrigin = false;
  if (isDevMode()) {
    if (origin?.includes('http://localhost') || origin?.includes('https://localhost') || origin?.includes('http://127') || origin?.includes('https://127')) {
      isAllowedOrigin = true;
    }
  };
  if (origin === process.env.ORIGIN_URL) {
    isAllowedOrigin = true;
  }
  if (callback && typeof callback === 'function') {
    callback(null, isAllowedOrigin ? origin : '');
  }
  return isAllowedOrigin ? origin : '';
};

export const sendResponse = (
  response: ExpressResponse,
  request: Request,
  message?: Response,
  status: HttpStatuses = HttpStatuses.OK,
) => response.set({
  [Headers.AllowOrigin]: getStaticOrigin(request.headers.origin),
  [Headers.ContentType]: 'application/json',
  [Headers.PoweredBy]: 'Colony',
}).status(status).json(message);

export const getRemoteIpAddress = (request: Request): string =>
  typeof request.headers[Headers.ForwardedFor] === 'string'
    ? request.headers[Headers.ForwardedFor]
    : request.headers[Headers.ForwardedFor]?.join(';') ||
  request.ip ||
  request.ips.join(';') ||
  request.connection.remoteAddress ||
  request.socket.remoteAddress ||
  '';

export const resetSession = (request: Request): void => {
  request.session.auth = undefined;
  request.session.nonce = undefined;
  request.session.save();
};

export const logger = (...args: any[]): void => {
  const isSilent = process.env.SILENT === 'true';
  if (!isSilent) {
    console.log(`${new Date().toISOString()}`, ...args);
  }
  return;
};
