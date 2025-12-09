import { GraphQLSchema, print } from 'graphql';
import { wrapSchema, schemaFromExecutor } from '@graphql-tools/wrap';
import { AsyncExecutor } from '@graphql-tools/utils';
import { applyMiddleware } from 'graphql-middleware';

import { graphqlRequest } from './helpers';
import { permissions } from './permissions';

let schema: GraphQLSchema;

const createAppSyncExecutor = (): AsyncExecutor => {
  return async ({ document, variables, context }) => {
    const query = print(document);
    const userAddress = (context as { userAddress?: string } | undefined)
      ?.userAddress;
    const result = await graphqlRequest(query, variables, userAddress);
    return result;
  };
};

export const initSchema = async (): Promise<void> => {
  const executor = createAppSyncExecutor();
  const remoteSchema = await schemaFromExecutor(executor);

  const wrappedSchema = wrapSchema({
    schema: remoteSchema,
    executor,
  });

  schema = applyMiddleware(wrappedSchema, permissions);
};

export const getSchema = (): GraphQLSchema => schema;
