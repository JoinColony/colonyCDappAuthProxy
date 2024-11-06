import { Request } from 'express-serve-static-core';

import { logger, detectOperation } from '~helpers';
import { QueryOperations } from '~types';

const hasQueryPermissions = async (
  operationName: string,
  request: Request,
): Promise<boolean> => {
  const userAddress = request.session.auth?.address;
  const { variables = '{}' } = detectOperation(request.body);

  try {
    switch (operationName) {
      /*
       * GetUserNotificationsHMAC will fail if no userAddress is provided
       */
      case QueryOperations.GetUserNotificationsHMAC: {
        if (!userAddress) {
          return false;
        }

        return true;
      }
      default: {
        // By default all queries are permitted
        return true;
      }
    }
  } catch (error) {
    logger(
      `Error when attempting to check if user ${userAddress} can execute query ${operationName} with variables ${variables}`,
      error,
    );
    // By default all queries are permitted
    return true;
  }
};

const addressCanExecuteQuery = async (request: Request): Promise<boolean> => {
  try {
    const { operations } = detectOperation(request.body);

    if (!operations.length) {
      return true;
    }
    const canExecuteAllOperations = await Promise.all(
      operations.map(
        async (operationName) =>
          await hasQueryPermissions(operationName, request),
      ),
    );
    return canExecuteAllOperations.every((canExecute) => canExecute);
  } catch (error) {
    /*
     * If anything fails still allow the query to execute as by default all queries are permitted
     */
    return true;
  }
};

export default addressCanExecuteQuery;
