import { shield, rule, allow, deny, and } from 'graphql-shield';
import { Path } from 'graphql/jsutils/Path';
import { FieldNode, GraphQLResolveInfo, ValueNode } from 'graphql';
import { ColonyRole } from '@colony/core';

import { fetchWithRetry } from './helpers';
import { getColonyRole, getTransaction } from './queries';
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
      return node.value;
    case 'BooleanValue':
      return node.value;
    case 'NullValue':
      return null;
    case 'EnumValue':
      return node.value;
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
  const input = args.input as Record<string, unknown>;
  const transaction = await fetchWithRetry<{ from: string }>(getTransaction, {
    transactionId: input.id,
  });
  return transaction?.from?.toLowerCase() === ctx.userAddress.toLowerCase();
});

const isOwnContributor = rule()((_parent, args, ctx) => {
  if (!ctx.userAddress) {
    return false;
  }
  const input = args.input as Record<string, unknown>;
  const [, contributorAddress] = String(input.id).split('_');
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

const canAccessEmail = rule()((_parent, _args, ctx, info) => {
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

  if (rootField === 'updateProfile') {
    const input = rootArgs.input as Record<string, unknown>;
    return String(input.id).toLowerCase() === ctx.userAddress.toLowerCase();
  }

  return false;
});

export const permissions = shield(
  {
    Query: {},
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

      initializeUser: isAuthenticated,
      createColonyMetadata: isAuthenticated,
      createDomainMetadata: isAuthenticated,
      updateDomainMetadata: isAuthenticated,
      createExpenditureMetadata: isAuthenticated,
      createStreamingPaymentMetadata: isAuthenticated,
      createAnnotation: isAuthenticated,
      createColonyDecision: isAuthenticated,
      bridgeXYZMutation: isAuthenticated,
      bridgeCreateBankAccount: isAuthenticated,
      bridgeUpdateBankAccount: isAuthenticated,
    },
    Profile: {
      email: canAccessEmail,
    },
  },
  {
    fallbackRule: allow,
    allowExternalErrors: true,
  },
);
