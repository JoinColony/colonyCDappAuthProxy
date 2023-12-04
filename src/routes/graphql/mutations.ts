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
        const { input: { id }} = JSON.parse(variables);
        return id === userAddress;
      }
      case MutationOperations.CreateTransaction:
      case MutationOperations.UpdateTransaction: {
        const { input: { from } } = JSON.parse(variables);
        return from === userAddress;
      }
      case MutationOperations.CreateUserTokens: {
        const { input: { userID } } = JSON.parse(variables);
        return userID === userAddress;
      }
      /*
       * Colony
       */
      case MutationOperations.CreateUniqueColony: {
        const { input: { userId } } = JSON.parse(variables);
        return userId === userAddress;
      }
      case MutationOperations.CreateColonyMetadata:
      case MutationOperations.UpdateColonyMetadata: {
        const { input: { id: colonyAddress } } = JSON.parse(variables);
        const data = await tryFetchGraphqlQuery(
          getColonyRole,
          { combinedId: `${colonyAddress}_1_${userAddress}_roles` },
        );
        return !!data[`role_${ColonyRole.Root}`];
      }
      /*
       * Domains
       */
      case MutationOperations.CreateDomainMetadata:
      case MutationOperations.UpdateDomainMetadata: {
        const { input: { id: combinedId } } = JSON.parse(variables);
        const colonyAddress = combinedId.split('_')[0];
        const data = await tryFetchGraphqlQuery(
          getColonyRole,
          { combinedId: `${colonyAddress}_1_${userAddress}_roles` },
        );
        return !!data[`role_${ColonyRole.Architecture}`];
      }
      /*
       * Actions, Mutations
       */
      case MutationOperations.CreateAnnotation:
      case MutationOperations.CreateColonyActionMetadata: {
        const { input: { id: actionId } } = JSON.parse(variables);
        const data = await tryFetchGraphqlQuery(getColonyAction, { actionId });
        return data.initiatorAddress === userAddress;
      }
      /*
       * Tokens
       */
      case MutationOperations.CreateColonyTokens: {
        const { input: { colonyID: colonyAddress } } = JSON.parse(variables);
        const data = await tryFetchGraphqlQuery(
          getColonyRole,
          { combinedId: `${colonyAddress}_1_${userAddress}_roles` },
        );
        return !!data[`role_${ColonyRole.Root}`];
      }
      case MutationOperations.DeleteColonyTokens: {
        const { input: { id: tokenColonyId } } = JSON.parse(variables);
        const tokenData = await tryFetchGraphqlQuery(getColonyTokens, { tokenColonyId });

        if (tokenData?.colonyID) {
          const data = await tryFetchGraphqlQuery(
            getColonyRole,
            { combinedId: `${tokenData.colonyID}_1_${userAddress}_roles` },
          );
          return !!data[`role_${ColonyRole.Root}`];
        }
        return false;
      }
      /*
       * Always allow, it's just updating cache, anybody can trigger it
       */
      case MutationOperations.GetTokenFromEverywhere:
      case MutationOperations.UpdateContributorsWithReputation: {
        return true;
      };
      default: {
        return false;
      }
    }
  } catch (error) {
    logger(`Error when attempting to check if user ${userAddress} can execute mutation ${operationName} with variables ${variables}`, error);
    /*
     * If anything fails just prevent the mutation from executing
     */
    return false;
  }
}

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
        async (operationName) => await hasMutationPermissions(
          operationName,
          request,
        ),
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
