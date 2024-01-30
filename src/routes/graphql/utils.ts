export const getColonyAddressFromMutationId = (id: string) => {
  const regex = /0x[a-fA-F0-9]{40}/;
  return id.match(regex);
};
