export const getColonyAction = /* GraphQL */ `
  query GetColonyAction($actionId: ID!) {
    getColonyAction(id: $actionId) {
      id
      initiatorAddress
    }
  }
`;
