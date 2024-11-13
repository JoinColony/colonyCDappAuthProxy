import { Request } from 'express-serve-static-core';
import { ColonyRole, Id } from '@colony/core';

import { logger, detectOperation, tryFetchGraphqlQuery } from '~helpers';
import { MutationOperations, UserRole } from '~types';
import {
  getAllColonyRoles,
  getColonyAction,
  getColonyRole,
  getColonyTokens,
  getStreamingPayment,
  getTransaction,
} from '~queries';

let callCount = 0;

function occasionallyFail() {
  callCount = (callCount + 1) % 3;
  return callCount !== 0;
}

const hasMutationPermissions = async (
  operationName: string,
  request: Request,
): Promise<boolean> => {
  const userAddress = request.session.auth?.address;
  const { variables = '{}' } = detectOperation(request.body);

  try {
    switch (operationName) {
      /*
       * Users
       */
      case MutationOperations.CreateUniqueUser:
      case MutationOperations.UpdateUserProfile:
      case MutationOperations.CreateUserNotificationsData: {
        const {
          input: { id },
        } = JSON.parse(variables);
        return userAddress && id && id.toLowerCase() === userAddress.toLowerCase();
      }
      case MutationOperations.InitializeUser: {
        // This is always allowed as the actual check is happening in the lambda
        return true;
      }
      case MutationOperations.UpdateUserNotificationsData: {
        const {
          input: { userAddress: mutationUserAddress },
        } = JSON.parse(variables);

        return (
          userAddress?.toLowerCase() === mutationUserAddress?.toLowerCase()
        );
      }
      case MutationOperations.CreateTransaction: {
        const {
          input: { from },
        } = JSON.parse(variables);
        return userAddress && from && from.toLowerCase() === userAddress.toLowerCase() && occasionallyFail();
      }
      case MutationOperations.UpdateTransaction: {
        const {
          input: { id, from },
        } = JSON.parse(variables);

        try {
          const data = await tryFetchGraphqlQuery(getTransaction, {
            transactionId: id,
          });

          // A user should only be allowed to update transactions made by them.
          return (
            from && userAddress &&
            from.toLowerCase() === userAddress.toLowerCase() && // The logged in user is the same as the "from" in the mutation
            data.from && data.from.toLowerCase() === userAddress.toLowerCase() && // The logged in user is the same as the "from" in the fetched transaction
            occasionallyFail()
          );
        } catch (error) {
          // silent
          return false;
        }
      }
      case MutationOperations.CreateUserTokens: {
        const {
          input: { userID },
        } = JSON.parse(variables);
        return userID && userAddress && userID.toLowerCase() === userAddress.toLowerCase();
      }
      /*
       * Colony
       */
      case MutationOperations.UpdateColonyMetadata: {
        const {
          input: { id: colonyAddress },
        } = JSON.parse(variables);
        if (!userAddress) {
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
        const {
          input: { contributorAddress },
        } = JSON.parse(variables);
        return contributorAddress && userAddress && contributorAddress.toLowerCase() === userAddress.toLowerCase();
      }
      case MutationOperations.UpdateColonyContributor: {
        const {
          input: { id: combinedContributorId },
        } = JSON.parse(variables);
        const [, contributorWalletAddress] = combinedContributorId.split('_');
        return (
        contributorWalletAddress && userAddress &&
          contributorWalletAddress.toLowerCase() === userAddress.toLowerCase()
        );
      }
      case MutationOperations.CreateColonyEtherealMetadata: {
        const {
          input: { initiatorAddress },
        } = JSON.parse(variables);
        return initiatorAddress && userAddress && initiatorAddress?.toLowerCase() === userAddress?.toLowerCase();
      }
      /*
       * Domains
       */
      case MutationOperations.CreateDomain: {
        const {
          input: { colonyId: colonyAddress },
        } = JSON.parse(variables);
        try {
          if (!userAddress) {
            return false;
          }
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
        return false;
      }
      /*
       * Actions, Mutations
       */
      case MutationOperations.CreateColonyActionMetadata: {
        const {
          input: { id: actionId },
        } = JSON.parse(variables);
        try {
          const data = await tryFetchGraphqlQuery(getColonyAction, {
            actionId,
          });
          return (
            data.initiatorAddress && userAddress &&
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
        const {
          input: { colonyID: colonyAddress },
        } = JSON.parse(variables);
        try {
          if (!userAddress) {
            return false;
          }
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
        const {
          input: { id: tokenColonyId },
        } = JSON.parse(variables);
        try {
          if (!userAddress) {
            return false;
          }
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
        const {
          input: { id: streamingPaymentId },
        } = JSON.parse(variables);
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
      case MutationOperations.CreateDomainMetadata: {
        return occasionallyFail();
      }
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
      `Error when attempting to check if user ${userAddress} can execute mutation ${operationName} with variables ${variables}`,
      error,
    );
    /*
     * If anything fails just prevent the mutation from executing
     */
    return false;
  }
};

const addressCanExecuteMutation = async (
  request: Request,
): Promise<boolean> => {
  try {
    const { operations } = detectOperation(request.body);

    if (!operations.length) {
      return false;
    }
    const canExecuteAllOperations = await Promise.all(
      operations.map(
        async (operationName) =>
          await hasMutationPermissions(operationName, request),
      ),
    );
    return canExecuteAllOperations.every((canExecute) => canExecute);
  } catch (error) {
    /*
     * If anything fails just prevent the mutation from executing
     */
    return false;
  }
};

export default addressCanExecuteMutation;
