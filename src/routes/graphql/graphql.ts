import { Response, Request } from 'express-serve-static-core';
import { graphql } from 'graphql';

import { getStaticOrigin, getRemoteIpAddress, logger } from '~helpers';
import { HttpStatuses, ContentTypes, Headers } from '~types';
import { getSchema } from '../../schema';

export const handleGraphQL = async (request: Request, response: Response) => {
  const userAddress = request.session.auth?.address;
  const userAuthenticated = !!request.session.auth;
  const requestRemoteAddress = getRemoteIpAddress(request);

  const schema = getSchema();

  const { query, variables, operationName } = request.body;

  try {
    const result = await graphql({
      schema,
      source: query,
      variableValues: variables,
      operationName,
      contextValue: {
        userAddress,
      },
    });

    const hasErrors = result.errors && result.errors.length > 0;

    logger(
      `${userAuthenticated ? 'auth' : 'non-auth'} request${
        userAddress ? ` from ${userAddress}` : ''
      } at ${requestRemoteAddress} ${
        hasErrors ? '\x1b[31m ERROR \x1b[0m' : '\x1b[32m OK \x1b[0m'
      }`,
    );

    return response
      .set({
        [Headers.AllowOrigin]: getStaticOrigin(request.headers.origin),
        [Headers.ContentType]: ContentTypes.Json,
        [Headers.PoweredBy]: 'Colony',
      })
      .status(HttpStatuses.OK)
      .json(result);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'GraphQL execution error';

    logger(
      `${userAuthenticated ? 'auth' : 'non-auth'} request${
        userAddress ? ` from ${userAddress}` : ''
      } at ${requestRemoteAddress} \x1b[31m EXCEPTION \x1b[0m: ${message}`,
    );

    return response
      .set({
        [Headers.AllowOrigin]: getStaticOrigin(request.headers.origin),
        [Headers.ContentType]: ContentTypes.Json,
        [Headers.PoweredBy]: 'Colony',
      })
      .status(HttpStatuses.SERVER_ERROR)
      .json({ errors: [{ message }] });
  }
};
