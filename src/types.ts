export enum OperationTypes {
  Query = 'query',
  Mutation = 'mutation',
}

export enum MutationOperations {
  UpdateContributorsWithReputation = 'updateContributorsWithReputation',
}

export const WhiteListedMutationOperations = [
  MutationOperations.UpdateContributorsWithReputation,
];

export enum HttpStatuses {
  OK = 200,
  BAD_REQUEST = 400,
  FORBIDDEN = 403,
  SERVER_ERROR = 500,
  UNPROCESSABLE = 422,
};

export enum ResponseTypes {
  Nonce = 'nonce',
  Health = 'health',
  Error = 'error',
  Auth = 'authentication',
  Status = 'status',
}

export type Response = {
  message: string;
  type: ResponseTypes;
  data?: string | number | boolean | string[] | number[] | boolean[];
}

export enum Urls {
  GraphQL = '/graphql',
  Health = '/health',
  Nonce = '/nonce',
  Auth = '/auth',
  DeAuth = '/deauth',
  Check = '/check',
}

export enum ContentTypes {
  Json = 'application/json',
  Plaintext = 'text/plain',
}

export enum Headers {
  AllowOrigin = 'Access-Control-Allow-Origin',
  ContentType = 'Content-Type',
  Cookie = 'Cookie',
  SetCookie = 'Set-Cookie',
  ForwardedFor = 'x-forwarded-for',
  ApiKey = 'x-api-key',
  PoweredBy = 'X-Powered-By',
}

export type StaticOrigin = boolean | string | RegExp | (boolean | string | RegExp)[];
export type StaticOriginCallback = (err: Error | null, origin?: StaticOrigin | undefined) => void;

export enum RequestMethods {
  Post = 'post',
  Get = 'get',
  Use = 'use',
}
