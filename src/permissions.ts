import { shield, rule, allow, deny, and } from 'graphql-shield';
import { Path } from 'graphql/jsutils/Path';
import { FieldNode, GraphQLResolveInfo, ValueNode } from 'graphql';
import { ColonyRole, Id } from '@colony/core';

import { fetchWithRetry } from './helpers';
import {
  getAllColonyRoles,
  getColonyAction,
  getColonyRole,
  getColonyTokens,
  getStreamingPayment,
  getTransaction,
} from './queries';
import { UserRole } from '~types';

const getPathArray = (path: Path | undefined): (string | number)[] => {
  const segments: (string | number)[] = [];
  let current = path;
  while (current) {
    segments.unshift(current.key);
    current = current.prev;
  }
  return segments;
};

const getRootFieldNode = (
  info: GraphQLResolveInfo,
  rootField: string | number,
): FieldNode | undefined => {
  for (const selection of info.operation.selectionSet.selections) {
    if (selection.kind === 'Field' && selection.name.value === rootField) {
      return selection;
    }
  }
  return undefined;
};

const resolveValue = (
  node: ValueNode,
  variables: Record<string, unknown>,
): unknown => {
  switch (node.kind) {
    case 'Variable':
      return variables[node.name.value];
    case 'IntValue':
      return parseInt(node.value, 10);
    case 'FloatValue':
      return parseFloat(node.value);
    case 'StringValue':
    case 'BooleanValue':
    case 'EnumValue':
      return node.value;
    case 'NullValue':
      return null;
    case 'ListValue':
      return node.values.map((v) => resolveValue(v, variables));
    case 'ObjectValue':
      return Object.fromEntries(
        node.fields.map((f) => [
          f.name.value,
          resolveValue(f.value, variables),
        ]),
      );
  }
};

const getRootFieldArgs = (
  info: GraphQLResolveInfo,
  rootFieldNode: FieldNode,
): Record<string, unknown> => {
  const args: Record<string, unknown> = {};
  for (const arg of rootFieldNode.arguments ?? []) {
    args[arg.name.value] = resolveValue(arg.value, info.variableValues);
  }
  return args;
};

const getByPath = (obj: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
};

const isAuthenticated = rule()((_parent, _args, ctx) => {
  return Boolean(ctx.userAddress);
});

const matchesUserAddress = (path: string) =>
  rule()((_parent, args, ctx) => {
    if (!ctx.userAddress) {
      return false;
    }
    const value = getByPath(args, path);
    return String(value).toLowerCase() === ctx.userAddress.toLowerCase();
  });

const ownsTransaction = rule()(async (_parent, args, ctx) => {
  if (!ctx.userAddress) {
    return false;
  }
  const { id } = args.input as { id: string };
  const transaction = await fetchWithRetry<{ from: string }>(getTransaction, {
    transactionId: id,
  });
  return transaction?.from?.toLowerCase() === ctx.userAddress.toLowerCase();
});

const isOwnContributor = rule()((_parent, args, ctx) => {
  if (!ctx.userAddress) {
    return false;
  }
  const { id } = args.input as { id: string };
  const [, contributorAddress] = id.split('_');
  return contributorAddress?.toLowerCase() === ctx.userAddress.toLowerCase();
});

const hasColonyRole = (colonyAddressPath: string, role: ColonyRole) =>
  rule()(async (_parent, args, ctx) => {
    if (!ctx.userAddress) {
      return false;
    }
    const colonyAddress = getByPath(args, colonyAddressPath);
    if (!colonyAddress) {
      return false;
    }
    const combinedId = `${colonyAddress}_1_${ctx.userAddress}_roles`;
    const data = await fetchWithRetry<UserRole>(getColonyRole, {
      combinedId,
    });
    return !!data?.[`role_${role}` as keyof UserRole];
  });

const inputAllowsOnly = (allowedFields: string[]) =>
  rule()((_parent, args) => {
    const input = args.input as Record<string, unknown>;
    const providedFields = Object.keys(input).filter((key) => key !== 'id');
    return providedFields.every((field) => allowedFields.includes(field));
  });

const canDeleteColonyTokens = rule()(async (_parent, args, ctx) => {
  if (!ctx.userAddress) {
    return false;
  }
  const { id } = args.input as { id: string };
  const tokenData = await fetchWithRetry<{ colonyID: string }>(
    getColonyTokens,
    { tokenColonyId: id },
  );
  if (!tokenData?.colonyID) {
    return false;
  }
  const combinedId = `${tokenData.colonyID}_1_${ctx.userAddress}_roles`;
  const data = await fetchWithRetry<UserRole>(getColonyRole, { combinedId });
  return !!data?.[`role_${ColonyRole.Root}`];
});

const isActionInitiator = rule()(async (_parent, args, ctx) => {
  if (!ctx.userAddress) {
    return false;
  }
  const { id } = args.input as { id: string };
  const action = await fetchWithRetry<{ initiatorAddress: string }>(
    getColonyAction,
    { actionId: id },
  );
  return (
    action?.initiatorAddress?.toLowerCase() === ctx.userAddress.toLowerCase()
  );
});

const canUpdateStreamingPaymentMetadata = rule()(async (_parent, args, ctx) => {
  if (!ctx.userAddress) {
    return false;
  }
  const { id: streamingPaymentId } = args.input as { id: string };
  const streamingPayment = await fetchWithRetry<{ nativeDomainId: number }>(
    getStreamingPayment,
    { streamingPaymentId },
  );
  if (!streamingPayment) {
    return false;
  }
  const [colonyAddress] = streamingPaymentId.split('_');
  const rolesData = await fetchWithRetry<{ items: UserRole[] }>(
    getAllColonyRoles,
    { targetAddress: ctx.userAddress, colonyAddress },
  );
  if (!rolesData?.items) {
    return false;
  }
  return rolesData.items.some((item) => {
    const [, roleDomainId] = item.id.split('_');
    const matchesDomain =
      roleDomainId === String(streamingPayment.nativeDomainId) ||
      roleDomainId === String(Id.RootDomain);
    const hasRole = !!item[`role_${ColonyRole.Administration}`];
    return matchesDomain && hasRole;
  });
});

const isOwnUser = rule()((_parent, _args, ctx, info) => {
  if (!ctx.userAddress) {
    return false;
  }

  const pathArray = getPathArray(info.path);
  const rootField = pathArray[0];
  const rootFieldNode = getRootFieldNode(info, rootField);
  const rootArgs = rootFieldNode ? getRootFieldArgs(info, rootFieldNode) : {};

  if (rootField === 'getUserByAddress') {
    return String(rootArgs.id).toLowerCase() === ctx.userAddress.toLowerCase();
  }

  return false;
});

export const permissions = shield(
  {
    Query: {
      '*': deny,

      bridgeCheckKYC: isAuthenticated,
      bridgeGetDrainsHistory: isAuthenticated,
      bridgeGetUserLiquidationAddress: isAuthenticated,
      getProfileByEmail: isAuthenticated,
      getUserNotificationsHMAC: isAuthenticated,

      bridgeGetGatewayFee: allow,
      cacheTotalBalanceByColonyAddress: allow,
      getActionsByColony: allow,
      getColoniesByNativeTokenId: allow,
      getColony: allow,
      getColonyAction: allow,
      getColonyActionByMotionId: allow,
      getColonyByAddress: allow,
      getColonyByName: allow,
      getColonyByType: allow,
      getColonyContributor: allow,
      getColonyDecisionByColonyAddress: allow,
      getColonyHistoricRole: allow,
      getColonyMemberInvite: allow,
      getColonyMotion: allow,
      getContributorsByAddress: allow,
      getCurrentVersionByKey: allow,
      getDomainBalance: allow,
      getExpenditure: allow,
      getExtensionByColonyAndHash: allow,
      getExtensionInstallationsCount: allow,
      getMotionByTransactionHash: allow,
      getMotionState: allow,
      getMotionTimeoutPeriods: allow,
      getPrivateBetaInviteCode: allow,
      getProfileByUsername: allow,
      getReputationMiningCycleMetadata: allow,
      getRoleByDomainAndColony: allow,
      getSafeTransactionStatus: allow,
      getTokenByAddress: allow,
      getTokenFromEverywhere: allow,
      getTransaction: allow,
      getTransactionsByUser: allow,
      getTransactionsByUserAndGroup: allow,
      getUserByAddress: allow,
      getUserByLiquidationAddress: allow,
      getUserReputation: allow,
      getUserStakes: allow,
      getUserTokenBalance: allow,
      getVoterRewards: allow,
      listCurrentNetworkInverseFees: allow,
      listCurrentVersions: allow,
      listTokens: allow,
      listUsers: allow,
      searchColonyActions: allow,
      searchColonyContributors: allow,
    },
    Mutation: {
      '*': deny,

      validateUserInvite: allow,
      updateContributorsWithReputation: allow,

      updateProfile: and(
        matchesUserAddress('input.id'),
        inputAllowsOnly(['hasCompletedKYCFlow', 'preferredCurrency']),
      ),
      createUniqueUser: matchesUserAddress('input.id'),
      createUserNotificationsData: matchesUserAddress('input.id'),
      updateNotificationsData: matchesUserAddress('input.userAddress'),
      createTransaction: matchesUserAddress('input.from'),
      updateTransaction: ownsTransaction,
      createUserTokens: matchesUserAddress('input.userID'),
      createColonyContributor: matchesUserAddress('input.contributorAddress'),
      updateColonyContributor: isOwnContributor,
      createColonyEtherealMetadata: matchesUserAddress(
        'input.initiatorAddress',
      ),
      updateColonyMetadata: hasColonyRole('input.id', ColonyRole.Root),
      createColonyTokens: hasColonyRole('input.colonyID', ColonyRole.Root),
      deleteColonyTokens: canDeleteColonyTokens,
      createColonyActionMetadata: isActionInitiator,
      initializeUser: isAuthenticated,
      createColonyMetadata: isAuthenticated,
      createDomainMetadata: isAuthenticated,
      updateDomainMetadata: isAuthenticated,
      createExpenditureMetadata: isAuthenticated,
      createStreamingPaymentMetadata: isAuthenticated,
      updateStreamingPaymentMetadata: canUpdateStreamingPaymentMetadata,
      createAnnotation: isAuthenticated,
      createColonyDecision: isAuthenticated,
      bridgeXYZMutation: isAuthenticated,
      bridgeCreateBankAccount: isAuthenticated,
      bridgeUpdateBankAccount: isAuthenticated,
    },
    Profile: {
      email: isOwnUser,
    },
    User: {
      bridgeCustomerId: isOwnUser,
      privateBetaInviteCode: isOwnUser,
    },
    Colony: {
      colonyMemberInvite: deny,
    },
  },
  {
    fallbackRule: allow,
    allowExternalErrors: true,
  },
);
