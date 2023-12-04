import { Request } from 'express-serve-static-core';

import { logger, detectOperation, tryFetchGraphqlQuery } from '~helpers';
import { MutationOperations } from '~types';
import { getColonyAction } from '~queries';

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
       * Always allow, it's just updating cache, anybody can trigger it
       */
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
