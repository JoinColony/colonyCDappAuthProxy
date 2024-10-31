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
  UpdateUserNotificationsData = 'updateNotificationsData',
  CreateTransaction = 'createTransaction',
  UpdateTransaction = 'updateTransaction',
  CreateUserTokens = 'createUserTokens',
  CreateUserNotificationsData = 'createUserNotificationsData',
  InitializeUser = 'initializeUser',
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
  /*
   * Expenditures
   */
  CreateExpenditureMetadata = 'createExpenditureMetadata',
  CreateStreamingPaymentMetadata = 'createStreamingPaymentMetadata',
  UpdateStreamingPaymentMetadata = 'updateStreamingPaymentMetadata',
  /*
   * Bridge / Crypto-to-fiat
   */
  BridgeXYZMutation = 'bridgeXYZMutation',
  BridgeCreateBankAccount = 'bridgeCreateBankAccount',
  BridgeUpdateBankAccount = 'bridgeUpdateBankAccount',
}

export enum QueryOperations {
  GetUserByAddress = 'getUserByAddress',
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

export enum ExpressServerMethods {
  Post = 'post',
  Get = 'get',
  Use = 'use',
}

export enum RequestMethods {
  Post = 'POST',
  Get = 'GET',
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

export interface RouteHandler {
  method: ExpressServerMethods;
  url: Urls;
  handler: RequestHandler;
}

export type UserRole = {
  id: string;
  role_0: boolean | null;
  role_1: boolean | null;
  role_2: boolean | null;
  role_3: boolean | null;
  role_5: boolean | null;
  role_6: boolean | null;
};
