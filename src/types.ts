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
  RemoveMemberFromColonyWhitelist = "removeMemberFromColonyWhitelist",
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
  /*
   * Expenditures
   */
  CreateExpenditureMetadata = 'createExpenditureMetadata',
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

export enum ServerMethods {
  Post = 'post',
  Get = 'get',
  Use = 'use',
}

export interface RouteHandler {
  method: ServerMethods;
  url: Urls;
  handler: RequestHandler;
}
