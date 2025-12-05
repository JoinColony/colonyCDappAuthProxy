import {
  DocumentNode,
  GraphQLSchema,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { RulesConfig, AuthContext, FieldRule } from './rules';
import { logger } from './helpers';

export async function validateRequest(
  document: DocumentNode,
  schema: GraphQLSchema,
  rules: RulesConfig,
  ctx: Omit<AuthContext, 'path'>,
): Promise<boolean> {
  let allowed = true;
  const pendingChecks: Array<{
    key: string;
    check: () => Promise<boolean>;
  }> = [];
  const typeInfo = new TypeInfo(schema);
  const path: string[] = [];

  logger('[validateRequest] Starting validation');

  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const fieldName = node.name.value;

          path.push(fieldName);

          if (!parentType) return;

          const typeName = parentType.name;
          const key = `${typeName}.${fieldName}`;
          const currentPath = [...path];
          const pathString = currentPath.join('.');
          const ctxWithPath: AuthContext = { ...ctx, path: currentPath };

          // 1. Check path rules (exact → parent)
          const parentPath = currentPath.slice(0, -1).join('.');
          const pathRule: FieldRule | undefined =
            rules.paths[pathString] ?? rules.paths[parentPath];
          const matchedPath =
            rules.paths[pathString] !== undefined ? pathString : parentPath;

          if (pathRule !== undefined) {
            logger(
              `[validateRequest] ${key} (path: ${pathString}) - PATH RULE (${matchedPath}): ${
                typeof pathRule === 'function' ? 'function' : pathRule
              }`,
            );

            if (pathRule === false) {
              logger(`[validateRequest] BLOCKED by path rule: ${matchedPath}`);
              allowed = false;
            } else if (pathRule === true) {
              // Allowed
            } else {
              pendingChecks.push({
                key: `path:${matchedPath}`,
                check: () => Promise.resolve(pathRule(ctxWithPath)),
              });
            }
            return;
          }

          // 2. Check type rules
          const typeRules = rules.types[typeName];

          // Type: true = all fields allowed
          if (typeRules === true) {
            logger(`[validateRequest] ${key} - type allows all fields`);
            return;
          }

          // Type: false = all fields blocked
          if (typeRules === false) {
            logger(
              `[validateRequest] BLOCKED: ${key} - type blocks all fields`,
            );
            allowed = false;
            return;
          }

          // Type: { field: rule } = check specific field
          if (typeof typeRules === 'object' && typeRules !== null) {
            const fieldRule = typeRules[fieldName];

            if (fieldRule === undefined) {
              logger(`[validateRequest] BLOCKED: ${key} - not in allowed list`);
              allowed = false;
              return;
            }

            logger(
              `[validateRequest] ${key} - type rule: ${
                typeof fieldRule === 'function' ? 'function' : fieldRule
              }`,
            );

            if (fieldRule === false) {
              logger(`[validateRequest] BLOCKED: ${key} - rule is false`);
              allowed = false;
            } else if (fieldRule === true) {
              // Allowed
            } else {
              pendingChecks.push({
                key,
                check: () => Promise.resolve(fieldRule(ctxWithPath)),
              });
            }
            return;
          }

          // No rules for this type = BLOCKED
          logger(`[validateRequest] BLOCKED: ${key} - no rules for type`);
          allowed = false;
        },
        leave() {
          path.pop();
        },
      },
    }),
  );

  if (!allowed) {
    logger('[validateRequest] Blocked during field traversal');
    return false;
  }

  if (pendingChecks.length === 0) {
    logger('[validateRequest] All checks passed');
    return true;
  }

  logger(
    `[validateRequest] Running ${pendingChecks.length} async checks in parallel`,
  );

  const results = await Promise.all(
    pendingChecks.map(async ({ key, check }) => {
      const result = await check();
      logger(
        `[validateRequest] Async check ${key}: ${
          result ? 'ALLOWED' : 'BLOCKED'
        }`,
      );
      return result;
    }),
  );

  const allPassed = results.every(Boolean);
  logger(
    `[validateRequest] ${
      allPassed ? 'All checks passed' : 'Some checks failed'
    }`,
  );
  return allPassed;
}
