import { shield, rule, allow } from 'graphql-shield';
import { Path } from 'graphql/jsutils/Path';
import { FieldNode, GraphQLResolveInfo, ValueNode } from 'graphql';

const getPathArray = (path: Path | undefined): (string | number)[] => {
  const segments: (string | number)[] = [];
  let current = path;
  while (current) {
    segments.unshift(current.key);
    current = current.prev;
  }
  return segments;
};

const getRootFieldNode = (
  info: GraphQLResolveInfo,
  rootField: string | number,
): FieldNode | undefined => {
  for (const selection of info.operation.selectionSet.selections) {
    if (selection.kind === 'Field' && selection.name.value === rootField) {
      return selection;
    }
  }
  return undefined;
};

const resolveValue = (
  node: ValueNode,
  variables: Record<string, unknown>,
): unknown => {
  switch (node.kind) {
    case 'Variable':
      return variables[node.name.value];
    case 'IntValue':
      return parseInt(node.value, 10);
    case 'FloatValue':
      return parseFloat(node.value);
    case 'StringValue':
      return node.value;
    case 'BooleanValue':
      return node.value;
    case 'NullValue':
      return null;
    case 'EnumValue':
      return node.value;
    case 'ListValue':
      return node.values.map((v) => resolveValue(v, variables));
    case 'ObjectValue':
      return Object.fromEntries(
        node.fields.map((f) => [
          f.name.value,
          resolveValue(f.value, variables),
        ]),
      );
  }
};

const getRootFieldArgs = (
  info: GraphQLResolveInfo,
  rootFieldNode: FieldNode,
): Record<string, unknown> => {
  const args: Record<string, unknown> = {};
  for (const arg of rootFieldNode.arguments ?? []) {
    args[arg.name.value] = resolveValue(arg.value, info.variableValues);
  }
  return args;
};

const canAccessEmail = rule()((parent, args, ctx, info) => {
  const pathArray = getPathArray(info.path);
  const rootField = pathArray[0];
  const rootFieldNode = getRootFieldNode(info, rootField);
  const rootArgs = rootFieldNode ? getRootFieldArgs(info, rootFieldNode) : {};

  if (!ctx.userAddress || rootField !== 'getUserByAddress') {
    return false;
  }

  return String(rootArgs.id).toLowerCase() === ctx.userAddress.toLowerCase();
});

export const permissions = shield(
  {
    Profile: {
      email: canAccessEmail,
    },
  },
  {
    fallbackRule: allow,
    allowExternalErrors: true,
  },
);
