import {
  GraphQLSchema,
  buildClientSchema,
  getIntrospectionQuery,
  IntrospectionQuery,
} from 'graphql';

import { graphqlRequest } from './helpers';

let schema: GraphQLSchema | null = null;

export const initSchema = async (): Promise<void> => {
  const introspectionQuery = getIntrospectionQuery();

  const result = await graphqlRequest(introspectionQuery);

  if (!result?.data) {
    throw new Error('Failed to fetch GraphQL schema: no data returned');
  }

  schema = buildClientSchema(result.data as IntrospectionQuery);
};

export const getSchema = (): GraphQLSchema | null => schema;
