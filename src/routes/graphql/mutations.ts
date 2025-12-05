import { ColonyRole, Id } from '@colony/core';

import { logger, tryFetchGraphqlQuery } from '~helpers';
import { MutationOperations, ParsedOperation, UserRole } from '~types';
import {
  getAllColonyRoles,
  getColonyAction,
  getColonyRole,
  getColonyTokens,
  getStreamingPayment,
  getTransaction,
} from '~queries';

const hasMutationPermission = async (
  field: string,
  variables: Record<string, unknown>,
  userAddress: string | undefined,
): Promise<boolean> => {
  const input = (variables.input ?? {}) as Record<string, unknown>;

  try {
    switch (field) {
      /*
       * Users
       */
      case MutationOperations.CreateUniqueUser:
      case MutationOperations.UpdateUserProfile:
      case MutationOperations.CreateUserNotificationsData: {
        const id = input.id as string | undefined;
        return !!(
          userAddress &&
          id &&
          id.toLowerCase() === userAddress.toLowerCase()
        );
      }
      case MutationOperations.InitializeUser: {
        // This is always allowed as the actual check is happening in the lambda
        return true;
      }
      case MutationOperations.UpdateUserNotificationsData: {
        const mutationUserAddress = input.userAddress as string | undefined;
        return (
          userAddress?.toLowerCase() === mutationUserAddress?.toLowerCase()
        );
      }
      case MutationOperations.CreateTransaction: {
        const from = input.from as string | undefined;
        return !!(
          userAddress &&
          from &&
          from.toLowerCase() === userAddress.toLowerCase()
        );
      }
      case MutationOperations.UpdateTransaction: {
        const id = input.id as string | undefined;
        const from = input.from as string | undefined;

        try {
          const data = await tryFetchGraphqlQuery(getTransaction, {
            transactionId: id,
          });

          // A user should only be allowed to update transactions made by them.
          return !!(
            (
              from &&
              userAddress &&
              from.toLowerCase() === userAddress.toLowerCase() && // The logged in user is the same as the "from" in the mutation
              data.from &&
              data.from.toLowerCase() === userAddress.toLowerCase()
            ) // The logged in user is the same as the "from" in the fetched transaction
          );
        } catch (error) {
          // silent
          return false;
        }
      }
      case MutationOperations.CreateUserTokens: {
        const userID = input.userID as string | undefined;
        return !!(
          userID &&
          userAddress &&
          userID.toLowerCase() === userAddress.toLowerCase()
        );
      }
      /*
       * Colony
       */
      case MutationOperations.UpdateColonyMetadata: {
        const colonyAddress = input.id as string | undefined;
        if (!userAddress || !colonyAddress) {
          return false;
        }
        try {
          const data = await tryFetchGraphqlQuery(getColonyRole, {
            combinedId: `${colonyAddress}_1_${userAddress}_roles`,
          });
          return !!data[`role_${ColonyRole.Root}`];
        } catch (error) {
          // silent
          return false;
        }
      }
      case MutationOperations.CreateColonyContributor: {
        const contributorAddress = input.contributorAddress as
          | string
          | undefined;
        return !!(
          contributorAddress &&
          userAddress &&
          contributorAddress.toLowerCase() === userAddress.toLowerCase()
        );
      }
      case MutationOperations.UpdateColonyContributor: {
        const combinedContributorId = input.id as string | undefined;
        if (!combinedContributorId || !userAddress) {
          return false;
        }
        const [, contributorWalletAddress] = combinedContributorId.split('_');
        return !!(
          contributorWalletAddress &&
          contributorWalletAddress.toLowerCase() === userAddress.toLowerCase()
        );
      }
      case MutationOperations.CreateColonyEtherealMetadata: {
        const initiatorAddress = input.initiatorAddress as string | undefined;
        return !!(
          initiatorAddress &&
          userAddress &&
          initiatorAddress.toLowerCase() === userAddress.toLowerCase()
        );
      }
      /*
       * Domains
       */
      case MutationOperations.CreateDomain: {
        const colonyAddress = input.colonyId as string | undefined;
        if (!userAddress || !colonyAddress) {
          return false;
        }
        try {
          const data = await tryFetchGraphqlQuery(getColonyRole, {
            combinedId: `${colonyAddress}_1_${userAddress}_roles`,
          });
          return !!data[`role_${ColonyRole.Architecture}`];
        } catch (error) {
          // silent
          return false;
        }
      }
      case MutationOperations.UpdateDomainMetadata: {
        return true;
      }
      /*
       * Actions, Mutations
       */
      case MutationOperations.CreateColonyActionMetadata:
      case MutationOperations.UpdateColonyAction: {
        const actionId = input.id as string | undefined;
        if (!actionId || !userAddress) {
          return false;
        }
        try {
          const data = await tryFetchGraphqlQuery(getColonyAction, {
            actionId,
          });
          return !!(
            data.initiatorAddress &&
            data.initiatorAddress.toLowerCase() === userAddress.toLowerCase()
          );
        } catch (error) {
          // silent
          return false;
        }
      }
      /*
       * Tokens
       */
      case MutationOperations.CreateColonyTokens: {
        const colonyAddress = input.colonyID as string | undefined;
        if (!userAddress || !colonyAddress) {
          return false;
        }
        try {
          const data = await tryFetchGraphqlQuery(getColonyRole, {
            combinedId: `${colonyAddress}_1_${userAddress}_roles`,
          });
          return !!data[`role_${ColonyRole.Root}`];
        } catch (error) {
          // silent
          return false;
        }
      }
      case MutationOperations.DeleteColonyTokens: {
        const tokenColonyId = input.id as string | undefined;
        if (!userAddress || !tokenColonyId) {
          return false;
        }
        try {
          const tokenData = await tryFetchGraphqlQuery(getColonyTokens, {
            tokenColonyId,
          });

          if (tokenData?.colonyID) {
            const data = await tryFetchGraphqlQuery(getColonyRole, {
              combinedId: `${tokenData.colonyID}_1_${userAddress}_roles`,
            });
            return !!data[`role_${ColonyRole.Root}`];
          }
          return false;
        } catch (error) {
          // silent
          return false;
        }
      }
      /**
       * Expenditures
       */
      case MutationOperations.CreateExpenditureMetadata:
      case MutationOperations.CreateStreamingPaymentMetadata:
      case MutationOperations.CreateAnnotation: {
        return true;
      }
      case MutationOperations.UpdateStreamingPaymentMetadata: {
        const streamingPaymentId = input.id as string | undefined;
        if (!streamingPaymentId || !userAddress) {
          return false;
        }
        try {
          // We need to check if the user has permissions in the domain the streaming payment was created in or the root domain
          const { nativeDomainId } = await tryFetchGraphqlQuery(
            getStreamingPayment,
            {
              streamingPaymentId,
            },
          );
          const [colonyAddress] = streamingPaymentId.split('_');

          const { items: userRoles }: { items: UserRole[] } =
            await tryFetchGraphqlQuery(getAllColonyRoles, {
              targetAddress: userAddress,
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
        } catch (error) {
          // silent
          return false;
        }
      }
      /**
       * Metadata can be created as part of the motion process, so we need to allow
       * those mutations even for users with no permissions
       */
      case MutationOperations.CreateColonyMetadata:
      case MutationOperations.CreateDomainMetadata:
      /*
       * Always allow, it's just updating cache, anybody can trigger it
       */
      case MutationOperations.CreateColonyDecision:
      case MutationOperations.ValidateUserInvite:
      case MutationOperations.GetTokenFromEverywhere:
      case MutationOperations.UpdateContributorsWithReputation: {
        return true;
      }
      /*
       * Bridge XYZ mutation, always allow
       */
      case MutationOperations.BridgeXYZMutation:
      case MutationOperations.BridgeCreateBankAccount:
      case MutationOperations.BridgeUpdateBankAccount: {
        return true;
      }
      default: {
        return false;
      }
    }
  } catch (error) {
    logger(
      `Error when attempting to check if user ${userAddress} can execute mutation ${field} with variables ${JSON.stringify(
        variables,
      )}`,
      error,
    );
    /*
     * If anything fails just prevent the mutation from executing
     */
    return false;
  }
};

const addressCanExecuteMutation = async (
  parsedOperation: ParsedOperation,
  userAddress: string | undefined,
): Promise<boolean> => {
  const { field, variables } = parsedOperation;

  try {
    return await hasMutationPermission(field, variables ?? {}, userAddress);
  } catch (error) {
    /*
     * If anything fails just prevent the mutation from executing
     */
    return false;
  }
};

export default addressCanExecuteMutation;
