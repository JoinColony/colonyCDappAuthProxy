import { Request } from 'express-serve-static-core';

import { logger, detectOperation } from '~helpers';
import { QueryOperations } from '~types';

const hasQueriesPermissions = async (
  operationName: string,
  request: Request,
): Promise<boolean> => {
  const userAddress = request.session.auth?.address;
  const { variables = '{}' } = detectOperation(request.body);

  try {
    switch (operationName) {
      case QueryOperations.GetUserByAddress: {
        return true;
      }
      // By default all queries are allowed
      default: {
        return true;
      }
    }
  } catch (error) {
    logger(
      `Error when attempting to check if user ${userAddress} can execute query ${operationName} with variables ${variables}`,
      error,
    );
    /*
     * If anything fails just prevent the query from executing
     */
    return false;
  }
};

const addressCanExecuteQuery = async (
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
          await hasQueriesPermissions(operationName, request),
      ),
    );
    return canExecuteAllOperations.every((canExecute) => canExecute);
  } catch (error) {
    /*
     * If anything fails just prevent the query from executing
     */
    return false;
  }
};

export default addressCanExecuteQuery;
