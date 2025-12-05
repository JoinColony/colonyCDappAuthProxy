import { ColonyRole, Id } from '@colony/core';

import { tryFetchGraphqlQuery } from './helpers';
import {
  getColonyAction,
  getColonyRole,
  getColonyTokens,
  getStreamingPayment,
  getTransaction,
  getAllColonyRoles,
} from './queries';
import { UserRole } from './types';

export type AuthContext = {
  userAddress: string | undefined;
  variables: Record<string, unknown>;
  path: string[];
};

export type FieldRule =
  | true
  | false
  | ((ctx: AuthContext) => boolean | Promise<boolean>);

// TypeRules can be:
// - true: all fields allowed
// - false: all fields blocked
// - { field: rule }: field-level rules, missing = blocked
export type TypeRules = true | false | Record<string, FieldRule>;

export type PathRules = Record<string, FieldRule>;

export interface RulesConfig {
  types: Record<string, TypeRules>;
  paths: PathRules;
}

// ============================================================
// HELPERS
// ============================================================

// Helper to check if a field in input matches userAddress
const isOwnUser =
  (field: string = 'id') =>
  (ctx: AuthContext): boolean => {
    const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
    const value = (input[field] ?? ctx.variables[field]) as string | undefined;
    return !!(
      ctx.userAddress &&
      value &&
      value.toLowerCase() === ctx.userAddress.toLowerCase()
    );
  };

// Helper to require authentication
const requiresAuth = (ctx: AuthContext): boolean => !!ctx.userAddress;

// Helper to check if user has a specific role in a colony (root domain)
const hasColonyRole =
  (colonyField: string, role: ColonyRole) =>
  async (ctx: AuthContext): Promise<boolean> => {
    const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
    const colonyAddress = input[colonyField] as string | undefined;
    if (!ctx.userAddress || !colonyAddress) return false;
    try {
      const data = await tryFetchGraphqlQuery(getColonyRole, {
        combinedId: `${colonyAddress}_1_${ctx.userAddress}_roles`,
      });
      return !!data[`role_${role}`];
    } catch {
      return false;
    }
  };

// Helper to check if user is the initiator of an action
const isActionInitiator =
  (actionField: string = 'id') =>
  async (ctx: AuthContext): Promise<boolean> => {
    const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
    const actionId = input[actionField] as string | undefined;
    if (!ctx.userAddress || !actionId) return false;
    try {
      const data = await tryFetchGraphqlQuery(getColonyAction, { actionId });
      return (
        data.initiatorAddress?.toLowerCase() === ctx.userAddress.toLowerCase()
      );
    } catch {
      return false;
    }
  };

export const rules: RulesConfig = {
  // ============================================================
  // TYPE RULES
  // ============================================================
  types: {
    Query: {
      getTokenFromEverywhere: true,
      getUserReputation: true,
      getUserTokenBalance: true,
      getMotionState: true,
      getVoterRewards: true,
      getMotionTimeoutPeriods: true,
      getSafeTransactionStatus: true,
      getDomainBalance: true,
      cacheAllDomainBalance: true,
      searchColonyContributors: true,
      searchColonyActions: true,
      getProfile: true,
      getToken: true,
      listTokens: true,
      getContributorReputation: true,
      getColonyContributor: true,
      getColony: true,
      listColonies: true,
      getColonyMemberInvite: true,
      getColonyMetadata: true,
      getTransaction: true,
      getUser: true,
      listUsers: true,
      getDomain: true,
      getDomainMetadata: true,
      getColonyFundsClaim: true,
      getVoterRewardsHistory: true,
      getMotionMessage: true,
      listMotionMessages: true,
      getMultiSigUserSignature: true,
      getColonyMultiSig: true,
      listColonyMultiSigs: true,
      getColonyMotion: true,
      listColonyMotions: true,
      getColonyExtension: true,
      getCurrentVersion: true,
      listCurrentVersions: true,
      getCurrentNetworkInverseFee: true,
      getColonyAction: true,
      listColonyActions: true,
      getColonyActionMetadata: true,
      listColonyActionMetadata: true,
      getColonyDecision: true,
      getColonyRole: true,
      getColonyHistoricRole: true,

      getExpenditure: true,
      listExpenditures: true,
      getExpenditureMetadata: true,
      listExpenditureMetadata: true,
      getStreamingPayment: true,
      listStreamingPayments: true,
      getStreamingPaymentMetadata: true,
      listStreamingPaymentMetadata: true,
      getAnnotation: true,
      getReputationMiningCycleMetadata: true,
      getPrivateBetaInviteCode: true,
      getSafeTransaction: true,
      getSafeTransactionData: true,
      getExtensionInstallationsCount: true,
      listExtensionInstallationsCounts: true,
      getUserStake: true,
      getColonyTokens: true,
      listColonyTokens: true,
      getUserTokens: true,
      listUserTokens: true,
      tokenExhangeRateByTokenId: true,
      cacheTotalBalanceByColonyAddress: true,
      getProfileByUsername: true,
      getTokenByAddress: true,
      getTokensByType: true,
      getUserReputationInColony: true,
      getContributorsByAddress: true,
      getContributorsByColony: true,
      getColonyByAddress: true,
      getColonyByName: true,
      getColoniesByNativeTokenId: true,
      getColonyByType: true,
      getTransactionsByUser: true,
      getTransactionsByUserAndGroup: true,
      getUserByAddress: true,
      getLiquidationAddressesByUserAddress: true,
      getUserByLiquidationAddress: true,
      getDomainsByColony: true,
      getDomainByNativeSkillId: true,
      getFundsClaimsByColony: true,
      getUserVoterRewards: true,
      getMotionVoterRewards: true,
      getMotionMessageByMotionId: true,
      getMultiSigUserSignatureByMultiSigId: true,
      getMultiSigByColonyAddress: true,
      getMultiSigByTransactionHash: true,
      getMultiSigByExpenditureId: true,
      getMotionByTransactionHash: true,
      getMotionByExpenditureId: true,
      getExtensionByColonyAndHash: true,
      getExtensionsByHash: true,
      getCurrentVersionByKey: true,
      getActionsByColony: true,
      getColonyActionByMotionId: true,
      getColonyActionByMultiSigId: true,
      getActionByExpenditureId: true,
      getColonyDecisionByActionId: true,
      getColonyDecisionByColonyAddress: true,
      getRoleByDomainAndColony: true,
      getRoleByTargetAddressAndColony: true,
      getRoleByColony: true,
      getColonyHistoricRoleByDate: true,
      getExpendituresByColony: true,
      getExpendituresByNativeFundingPotIdAndColony: true,
      getUserStakes: true,

      // Requires authentication
      bridgeCheckKYC: requiresAuth,
      bridgeGetDrainsHistory: requiresAuth,
      bridgeGetUserLiquidationAddress: requiresAuth,
      bridgeGetGatewayFee: requiresAuth,
      getUserNotificationsHMAC: requiresAuth,
      getLiquidationAddress: requiresAuth,

      // Blocked
      getNotificationsData: false,
      listNotificationsData: false,
      getUserByBridgeCustomerId: false,
      listPrivateBetaInviteCodes: false,
      listProfiles: false,
      listColonyRoles: false,
      listColonyHistoricRoles: false,
      listDomainMetadata: false,
      getCacheTotalBalance: false,
      listCacheTotalBalances: false,
      getTokenExchangeRate: false,
      listTokenExchangeRates: false,
      listColonyMemberInvites: false,
      listLiquidationAddresses: false,
      listReputationMiningCycleMetadata: false,
      getIngestorStats: false,
      listIngestorStats: false,
      listSafeTransactionData: false,
      listVoterRewardsHistories: false,
      listColonyMetadata: false,
      listContributorReputations: false,
      listColonyContributors: false,
      listTransactions: false,
      listDomains: false,
      listColonyFundsClaims: false,
      getContractEvent: false,
      listContractEvents: false,
      listColonyExtensions: false,
      listMultiSigUserSignatures: false,
      listUserStakes: false,
      listAnnotations: false,
      listSafeTransactions: false,
      listColonyDecisions: false,
      listCurrentNetworkInverseFees: false,
    },

    Mutation: {
      createUniqueUser: isOwnUser(),
      updateProfile: isOwnUser(),
      createUserNotificationsData: isOwnUser(),
      updateNotificationsData: isOwnUser('userAddress'),
      createTransaction: isOwnUser('from'),
      updateTransaction: async (ctx) => {
        const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
        const id = input.id as string | undefined;
        const from = input.from as string | undefined;
        if (!ctx.userAddress || !id || !from) return false;
        if (from.toLowerCase() !== ctx.userAddress.toLowerCase()) return false;
        try {
          const data = await tryFetchGraphqlQuery(getTransaction, {
            transactionId: id,
          });
          return data.from?.toLowerCase() === ctx.userAddress.toLowerCase();
        } catch {
          return false;
        }
      },
      createUserTokens: isOwnUser('userID'),
      createColonyContributor: isOwnUser('contributorAddress'),
      updateColonyContributor: (ctx) => {
        const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
        const combinedId = input.id as string | undefined;
        if (!combinedId || !ctx.userAddress) return false;
        const [, contributorAddress] = combinedId.split('_');
        return (
          contributorAddress?.toLowerCase() === ctx.userAddress.toLowerCase()
        );
      },
      createColonyEtherealMetadata: isOwnUser('initiatorAddress'),

      initializeUser: requiresAuth,
      createColonyMetadata: requiresAuth,
      createDomainMetadata: requiresAuth,
      updateDomainMetadata: requiresAuth,
      createExpenditureMetadata: requiresAuth,
      createStreamingPaymentMetadata: requiresAuth,
      createAnnotation: requiresAuth,
      createColonyDecision: requiresAuth,
      bridgeXYZMutation: requiresAuth,
      bridgeCreateBankAccount: requiresAuth,
      bridgeUpdateBankAccount: requiresAuth,

      updateColonyMetadata: hasColonyRole('id', ColonyRole.Root),
      createDomain: hasColonyRole('colonyId', ColonyRole.Architecture),
      createColonyTokens: hasColonyRole('colonyID', ColonyRole.Root),
      deleteColonyTokens: async (ctx) => {
        const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
        const tokenColonyId = input.id as string | undefined;
        if (!ctx.userAddress || !tokenColonyId) return false;
        try {
          const tokenData = await tryFetchGraphqlQuery(getColonyTokens, {
            tokenColonyId,
          });
          if (!tokenData?.colonyID) return false;
          const roleData = await tryFetchGraphqlQuery(getColonyRole, {
            combinedId: `${tokenData.colonyID}_1_${ctx.userAddress}_roles`,
          });
          return !!roleData[`role_${ColonyRole.Root}`];
        } catch {
          return false;
        }
      },
      createColonyActionMetadata: isActionInitiator(),
      updateColonyAction: isActionInitiator(),
      updateStreamingPaymentMetadata: async (ctx) => {
        const input = (ctx.variables.input ?? {}) as Record<string, unknown>;
        const streamingPaymentId = input.id as string | undefined;
        if (!ctx.userAddress || !streamingPaymentId) return false;
        try {
          const { nativeDomainId } = await tryFetchGraphqlQuery(
            getStreamingPayment,
            { streamingPaymentId },
          );
          const [colonyAddress] = streamingPaymentId.split('_');
          const { items: userRoles }: { items: UserRole[] } =
            await tryFetchGraphqlQuery(getAllColonyRoles, {
              targetAddress: ctx.userAddress,
              colonyAddress,
            });
          return userRoles.some((item) => {
            const [, roleDomainId] = item.id.split('_');
            const matchesDomain =
              roleDomainId === String(nativeDomainId) ||
              roleDomainId === String(Id.RootDomain);
            const hasRole = !!item[`role_${ColonyRole.Administration}`];
            return matchesDomain && hasRole;
          });
        } catch {
          return false;
        }
      },

      validateUserInvite: true,
      getTokenFromEverywhere: true,
      updateContributorsWithReputation: true,
    },

    User: {
      id: true,
      tokens: true,
      profileId: true,
      profile: true,
      roles: true,
      transactionHistory: true,
      liquidationAddresses: true,
      createdAt: true,
      updatedAt: true,
    },
    Profile: {
      id: true,
      avatar: true,
      thumbnail: true,
      displayName: true,
      displayNameChanged: true,
      bio: true,
      location: true,
      website: true,
      meta: true,
    },
    Colony: true,
    ColonyMetadata: true,
    Domain: true,
    DomainMetadata: true,
    Token: true,
    Transaction: true,
    ColonyAction: true,
    ColonyActionMetadata: true,
    ColonyMotion: true,
    ColonyMultiSig: true,
    ColonyExtension: true,
    ColonyContributor: true,
    ContributorReputation: true,
    Expenditure: true,
    ExpenditureMetadata: true,
    StreamingPayment: true,
    StreamingPaymentMetadata: true,
    Annotation: true,
    ColonyDecision: true,
    ColonyRole: true,
    ColonyHistoricRole: true,
    ColonyFundsClaim: true,
    ColonyMemberInvite: true,
    ColonyTokens: true,
    UserTokens: true,
    UserStake: true,
    VoterRewardsHistory: true,
    MotionMessage: true,
    MultiSigUserSignature: true,
    ContractEvent: true,
    CurrentVersion: true,
    CurrentNetworkInverseFee: true,
    IngestorStats: true,
    ReputationMiningCycleMetadata: true,
    PrivateBetaInviteCode: true,
    SafeTransaction: true,
    SafeTransactionData: true,
    ExtensionInstallationsCount: true,
    TokenExchangeRate: true,
    CacheTotalBalance: true,
    LiquidationAddress: true,

    // Connection types
    ModelColonyConnection: true,
    ModelUserConnection: true,
    ModelTokenConnection: true,
    ModelDomainConnection: true,
    ModelColonyActionConnection: true,
    ModelColonyContributorConnection: true,
    ModelTransactionConnection: true,
    ModelProfileConnection: true,
    ModelColonyRoleConnection: true,
    ModelExpenditureConnection: true,
    ModelStreamingPaymentConnection: true,
    ModelColonyMotionConnection: true,
    ModelColonyMultiSigConnection: true,
    ModelColonyExtensionConnection: true,
    ModelAnnotationConnection: true,
    ModelColonyDecisionConnection: true,
    ModelColonyFundsClaimConnection: true,
    ModelVoterRewardsHistoryConnection: true,
    ModelMotionMessageConnection: true,
    ModelMultiSigUserSignatureConnection: true,
    ModelContractEventConnection: true,
    ModelColonyMemberInviteConnection: true,
    ModelColonyMetadataConnection: true,
    ModelDomainMetadataConnection: true,
    ModelColonyActionMetadataConnection: true,
    ModelColonyHistoricRoleConnection: true,
    ModelIngestorStatsConnection: true,
    ModelExpenditureMetadataConnection: true,
    ModelStreamingPaymentMetadataConnection: true,
    ModelReputationMiningCycleMetadataConnection: true,
    ModelPrivateBetaInviteCodeConnection: true,
    ModelSafeTransactionConnection: true,
    ModelSafeTransactionDataConnection: true,
    ModelExtensionInstallationsCountConnection: true,
    ModelUserStakeConnection: true,
    ModelColonyTokensConnection: true,
    ModelUserTokensConnection: true,
    ModelTokenExchangeRateConnection: true,
    ModelCacheTotalBalanceConnection: true,
    ModelContributorReputationConnection: true,
    ModelCurrentVersionConnection: true,
    ModelCurrentNetworkInverseFeeConnection: true,
    ModelColonyMultiSigFilterInput: true,
    SearchableColonyContributorConnection: true,
    SearchableColonyActionConnection: true,

    NotificationsData: false,
  },

  // ============================================================
  // PATH RULES (overrides)
  // Check exact path, then parent path
  // ============================================================
  paths: {
    'getUserByAddress.bridgeCustomerId': isOwnUser(),
    'getUserByAddress.notificationsData': isOwnUser(),
    'getUserByAddress.privateBetaInviteCode': isOwnUser(),
    'getUserByAddress.profile.email': isOwnUser(),
  },
};
