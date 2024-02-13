import { RequestHandler } from 'http-proxy-middleware';

export enum OperationTypes {
  Query = 'query',
  Mutation = 'mutation',
}

export enum DefinitionTypes {
  Operation = 'OperationDefinition',
  Fragment = 'FragmentDefinition',
}

export enum MutationOperations {
  /*
   * User
   */
  CreateUniqueUser = 'createUniqueUser',
  UpdateUserProfile = 'updateProfile',
  CreateTransaction = 'createTransaction',
  UpdateTransaction = 'updateTransaction',
  CreateUserTokens = 'createUserTokens',
  /*
   * Colony
   */
  CreateColonyMetadata = 'createColonyMetadata',
  UpdateColonyMetadata = 'updateColonyMetadata',
  ValidateUserInvite = 'validateUserInvite',
  CreateColonyContributor = 'createColonyContributor',
  UpdateColonyContributor = 'updateColonyContributor',
  UpdateContributorsWithReputation = 'updateContributorsWithReputation',
  CreateColonyEtherealMetadata = 'createColonyEtherealMetadata',
  /*
   * Domains
   */
  CreateDomain = 'createDomain',
  CreateDomainMetadata = 'createDomainMetadata',
  UpdateDomainMetadata = 'updateDomainMetadata',
  /*
   * Actions, Mutations
   */
  CreateColonyActionMetadata = 'createColonyActionMetadata',
  CreateAnnotation = 'createAnnotation',
  CreateColonyDecision = 'createColonyDecision',
  /*
   * Tokens
   */
  GetTokenFromEverywhere = 'getTokenFromEverywhere',
  CreateColonyTokens = 'createColonyTokens',
  DeleteColonyTokens = 'deleteColonyTokens',
}

export enum HttpStatuses {
  OK = 200,
  BAD_REQUEST = 400,
  FORBIDDEN = 403,
  SERVER_ERROR = 500,
  UNPROCESSABLE = 422,
}

export enum ResponseTypes {
  Nonce = 'nonce',
  Health = 'health',
  Error = 'error',
  Auth = 'authentication',
  Status = 'status',
  UIEvent = 'ui-event',
}

export type Response = {
  message: string;
  type: ResponseTypes;
  data?: string | number | boolean | string[] | number[] | boolean[];
};

export enum Urls {
  GraphQL = '/graphql',
  Health = '/health',
  Nonce = '/nonce',
  Auth = '/auth',
  DeAuth = '/deauth',
  Check = '/check',
  SegmentProjects = '/ui-events/v1/projects/*',
  SegmentTrack = '/ui-events/*',
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
  ForwardedProto = 'x-forwarded-proto',
  ApiKey = 'x-api-key',
  PoweredBy = 'X-Powered-By',
  WalletAddress = 'x-wallet-address',
}

export type StaticOrigin =
  | boolean
  | string
  | RegExp
  | (boolean | string | RegExp)[];
export type StaticOriginCallback = (
  err: Error | null,
  origin?: StaticOrigin | undefined,
) => void;

export enum ExpressServerMethods {
  Post = 'post',
  Get = 'get',
  Use = 'use',
}

export enum RequestMethods {
  Post = 'POST',
  Get = 'GET',
}

export interface RouteHandler {
  method: ExpressServerMethods;
  url: Urls;
  handler: RequestHandler;
}

// These should really be defined by the "stream" module
// But I couldn't for the life of me find either the exported types
// or where they are defined
export enum StreamEvent {
  Close = 'close',
  Data = 'data',
  End = 'end',
  Error = 'error',
  Pause = 'pause',
  Readable = 'readable',
  Resume = 'resume',
}

export enum Encoding {
  Utf8 = 'utf8',
}
