import { MutationNames } from '~types';

const hasMutationPermissions = async (operationName: string, userAddress: string): Promise<boolean> => {
  switch (operationName.toLowerCase()) {
    /*
     * Always allow, it's just updating cache, anybody can trigger it
     */
    case MutationNames.UpdateContributorsWithReputation: {
      return true;
      break;
    };
    default: {
      return false;
      break;
    }
  }
}

const addressCanExecuteMutation = async (
  operationNames: string[],
  userAddress: string
): Promise<boolean> => {
  if (!operationNames.length) {
    return false;
  }
  const canExecuteAllOperations = await Promise.all(operationNames.map(async (operationName) => await hasMutationPermissions(operationName, userAddress)));
  return canExecuteAllOperations.every((canExecute) => canExecute);
};

export default addressCanExecuteMutation;
