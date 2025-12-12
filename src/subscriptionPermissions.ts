import { parse, visit, visitWithTypeInfo, TypeInfo } from 'graphql';

import { getSchema } from './schema';
import { logger } from '~helpers';

const allowedSubscriptions = [
  'onCreateColonyActionMetadata',
  'onUpdateColony',
  'onCreateColonyContributor',
  'onUpdateColonyContributor',
];

const blockedFields: Record<string, string[]> = {
  Profile: ['email'],
  User: [
    'bridgeCustomerId',
    'privateBetaInviteCode',
    'userPrivateBetaInviteCodeId',
  ],
  Colony: ['colonyMemberInvite', 'colonyMemberInviteCode'],
};

export const validateSubscription = (query: string): boolean => {
  let document;
  try {
    document = parse(query);
  } catch {
    logger('Subscription rejected: Invalid query');
    return false;
  }

  // Check if the subscription is allowed
  for (const def of document.definitions) {
    if (def.kind !== 'OperationDefinition') continue;

    if (def.operation !== 'subscription') {
      logger('Subscription rejected: Non-subscription operation in document');
      return false;
    }

    const firstField = def.selectionSet.selections[0];
    if (!firstField || firstField.kind !== 'Field') {
      logger('Subscription rejected: No field selected');
      return false;
    }

    const subscriptionName = firstField.name.value;
    if (!allowedSubscriptions.includes(subscriptionName)) {
      logger('Subscription rejected:', subscriptionName);
      return false;
    }
  }

  // Check for blocked fields
  const typeInfo = new TypeInfo(getSchema());
  let blocked = false;

  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter(node) {
          const parentType = typeInfo.getParentType();
          if (!parentType) return;

          const blockedList = blockedFields[parentType.name];
          if (blockedList?.includes(node.name.value)) {
            logger(
              'Subscription rejected due to blocked field:',
              `${parentType.name}.${node.name.value}`,
            );
            blocked = true;
            return false;
          }
        },
      },
    }),
  );

  return !blocked;
};
