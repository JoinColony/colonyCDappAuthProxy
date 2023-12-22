import { Request } from 'express-serve-static-core';
import { ColonyRole } from '@colony/core';

import { logger, detectOperation, tryFetchGraphqlQuery } from '~helpers';
import { MutationOperations } from '~types';
import { getColonyAction, getColonyRole, getColonyTokens } from '~queries';

const hasMutationPermissions = async (
  operationName: string,
  request: Request,
): Promise<boolean> => {
  const userAddress = request.session.auth?.address || '';
  const { variables = '{}' } = detectOperation(request.body);

  try {
    switch (operationName) {
      /*
       * Users
       */
      case MutationOperations.CreateUniqueUser:
      case MutationOperations.UpdateUserProfile: {
        const {
          input: { id },
        } = JSON.parse(variables);
        return id?.toLowerCase() === userAddress?.toLowerCase();
      }
      case MutationOperations.CreateTransaction:
      case MutationOperations.UpdateTransaction: {
        const {
          input: { from },
        } = JSON.parse(variables);
        return from?.toLowerCase() === userAddress?.toLowerCase();
      }
      case MutationOperations.CreateUserTokens: {
        const {
          input: { userID },
        } = JSON.parse(variables);
        return userID?.toLowerCase() === userAddress?.toLowerCase();
      }
      /*
       * Colony
       */
      case MutationOperations.CreateColonyMetadata:
      case MutationOperations.UpdateColonyMetadata: {
        const {
          input: { id: colonyAddress },
        } = JSON.parse(variables);
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
        return contributorAddress?.toLowerCase() === userAddress?.toLowerCase();
      }
      case MutationOperations.UpdateColonyContributor: {
        const {
          input: { id: combinedContributorId },
        } = JSON.parse(variables);
        const [, contributorWalletAddress] = combinedContributorId.split('_');
        return (
          contributorWalletAddress?.toLowerCase() === userAddress?.toLowerCase()
        );
      }
      case MutationOperations.CreateColonyEtherealMetadata: {
        const {
          input: { initiatorAddress },
        } = JSON.parse(variables);
        return initiatorAddress?.toLowerCase() === userAddress?.toLowerCase();
      }
      /*
       * Domains
       */
      case MutationOperations.CreateDomain: {
        const {
          input: { colonyId: colonyAddress },
        } = JSON.parse(variables);
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
      case MutationOperations.CreateDomainMetadata:
      case MutationOperations.UpdateDomainMetadata: {
        const {
          input: { id: combinedId },
        } = JSON.parse(variables);
        try {
          const [colonyAddress] = combinedId.split('_');
          const data = await tryFetchGraphqlQuery(getColonyRole, {
            combinedId: `${colonyAddress}_1_${userAddress}_roles`,
          });
          return !!data[`role_${ColonyRole.Architecture}`];
        } catch (error) {
          // silent
          return false;
        }
      }
      /*
       * Actions, Mutations
       */
      case MutationOperations.CreateAnnotation:
      case MutationOperations.CreateColonyActionMetadata: {
        console.log({ operationName, variables });

        const {
          input: { id: actionId },
        } = JSON.parse(variables);

        console.log({ actionId });
        try {
          console.log('Fetching action data');
          const data = await tryFetchGraphqlQuery(getColonyAction, {
            actionId,
          });
          console.log('Action data fetched');
          console.log(
            'Allow?: ',
            data.initiatorAddress?.toLowerCase() === userAddress?.toLowerCase(),
          );
          return (
            data.initiatorAddress?.toLowerCase() === userAddress?.toLowerCase()
          );
        } catch (error) {
          console.error(error);
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
      /*
       * Always allow, it's just updating cache, anybody can trigger it
       */
      case MutationOperations.CreateColonyDecision:
      case MutationOperations.ValidateUserInvite:
      case MutationOperations.GetTokenFromEverywhere:
      case MutationOperations.UpdateContributorsWithReputation: {
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
