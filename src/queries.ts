export const getColonyAction = /* GraphQL */ `
  query GetColonyAction($actionId: ID!) {
    getColonyAction(id: $actionId) {
      id
      initiatorAddress
    }
  }
`;

export const getColonyRole = /* GraphQL */ `
  query GetUserRolesInColony($combinedId: ID!) {
    getColonyRole(id: $combinedId) {
      role_0
      role_1
      role_2
      role_3
      role_5
      role_6
    }
  }
`;

export const getAllColonyRoles = /* GraphQL */ `
  query GetAllColonyRoles($targetAddress: ID!, $colonyAddress: ID!) {
    getRoleByTargetAddressAndColony(
      targetAddress: $targetAddress
      colonyAddress: { eq: $colonyAddress }
    ) {
      items {
        id
        role_0
        role_1
        role_2
        role_3
        role_5
        role_6
      }
    }
  }
`;

export const getColonyTokens = /* GraphQL */ `
  query GetColonyFromToken($tokenColonyId: ID!) {
    getColonyTokens(id: $tokenColonyId) {
      colonyID
    }
  }
`;

export const getStreamingPayment = /* GraphQL */ `
  query GetStreamingPayment($streamingPaymentId: ID!) {
    getStreamingPayment(id: $streamingPaymentId) {
      id
      nativeDomainId
    }
  }
`;
