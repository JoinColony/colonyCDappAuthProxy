import { logger } from '~helpers';
import { ParsedOperation, QueryOperations } from '~types';

const hasQueryPermission = (
  field: string,
  userAddress: string | undefined,
): boolean => {
  switch (field) {
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
};

const addressCanExecuteQuery = async (
  parsedOperation: ParsedOperation,
  userAddress: string | undefined,
): Promise<boolean> => {
  const { field, variables } = parsedOperation;

  try {
    return hasQueryPermission(field, userAddress);
  } catch (error) {
    logger(
      `Error when attempting to check if user ${userAddress} can execute query ${field} with variables ${JSON.stringify(
        variables,
      )}`,
      error,
    );
    /*
     * If anything fails still allow the query to execute as by default all queries are permitted
     */
    return true;
  }
};

export default addressCanExecuteQuery;
