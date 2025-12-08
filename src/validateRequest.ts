import {
  DocumentNode,
  GraphQLSchema,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { RulesConfig, AuthContext, FieldRule } from './rules';
import { logger } from './helpers';

interface FragmentSpreadInfo {
  atPath: string[];
  inFragment: string | null;
}

/**
 * Collects where each fragment is spread in the document.
 * Tracks the path at the spread location and whether it's inside another fragment.
 */
function collectFragmentSpreads(
  document: DocumentNode,
): Map<string, FragmentSpreadInfo[]> {
  const spreads = new Map<string, FragmentSpreadInfo[]>();
  let currentFragment: string | null = null;
  const path: string[] = [];

  visit(document, {
    OperationDefinition: {
      enter() {
        currentFragment = null;
      },
    },
    FragmentDefinition: {
      enter(node) {
        currentFragment = node.name.value;
      },
      leave() {
        currentFragment = null;
      },
    },
    Field: {
      enter(node) {
        path.push(node.name.value);
      },
      leave() {
        path.pop();
      },
    },
    FragmentSpread(node) {
      const name = node.name.value;
      if (!spreads.has(name)) {
        spreads.set(name, []);
      }
      spreads.get(name)!.push({
        atPath: [...path],
        inFragment: currentFragment,
      });
    },
  });

  return spreads;
}

/**
 * Resolves the full paths where a fragment's fields should be validated.
 * Handles nested fragments by recursively resolving parent fragment contexts.
 */
function resolveFragmentContexts(
  spreads: Map<string, FragmentSpreadInfo[]>,
): Map<string, string[][]> {
  const resolved = new Map<string, string[][]>();

  function resolvePaths(
    fragmentName: string,
    visited: Set<string>,
  ): string[][] {
    if (visited.has(fragmentName)) return []; // Prevent cycles
    visited.add(fragmentName);

    const fragmentSpreads = spreads.get(fragmentName) || [];
    const paths: string[][] = [];

    for (const spread of fragmentSpreads) {
      if (spread.inFragment === null) {
        // Spread directly in operation
        paths.push(spread.atPath);
      } else {
        // Spread inside another fragment - resolve parent paths first
        const parentPaths = resolvePaths(spread.inFragment, new Set(visited));
        for (const parentPath of parentPaths) {
          paths.push([...parentPath, ...spread.atPath]);
        }
      }
    }

    return paths;
  }

  for (const fragmentName of spreads.keys()) {
    resolved.set(fragmentName, resolvePaths(fragmentName, new Set()));
  }

  return resolved;
}

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

  logger('[validateRequest] Starting validation');

  // Build fragment context map (handles nested fragments)
  const fragmentSpreads = collectFragmentSpreads(document);
  const fragmentContexts = resolveFragmentContexts(fragmentSpreads);

  const path: string[] = [];
  let activeFragment: string | null = null;

  visit(
    document,
    visitWithTypeInfo(typeInfo, {
      FragmentDefinition: {
        enter(node) {
          activeFragment = node.name.value;
        },
        leave() {
          activeFragment = null;
        },
      },
      Field: {
        enter(node) {
          const parentType = typeInfo.getParentType();
          const fieldName = node.name.value;

          console.log('Entering Field:', {
            fieldName,
            parentType: parentType?.name,
          });

          path.push(fieldName);

          if (fieldName === '__typename') return;
          if (!parentType) return;

          const typeName = parentType.name;
          const key = `${typeName}.${fieldName}`;

          // Build full paths including fragment spread context
          let fullPaths: string[][];
          if (activeFragment) {
            const contexts = fragmentContexts.get(activeFragment) || [[]];
            fullPaths = contexts.map((ctx) => [...ctx, ...path]);
          } else {
            fullPaths = [[...path]];
          }

          console.log({ fullPaths, activeFragment });

          // Validate against each full path
          // If fragment is spread in multiple places, all must pass
          for (const currentPath of fullPaths) {
            const ctxWithPath: AuthContext = { ...ctx, path: currentPath };
            const pathString = currentPath.join('.');
            const parentPath = currentPath.slice(0, -1).join('.');

            // 1. Check path rules (exact → parent)
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
                logger(
                  `[validateRequest] BLOCKED by path rule: ${matchedPath}`,
                );
                allowed = false;
              } else if (pathRule === true) {
                // Allowed
              } else {
                pendingChecks.push({
                  key: `path:${matchedPath}`,
                  check: () => Promise.resolve(pathRule(ctxWithPath)),
                });
              }
              continue; // Path rule handled this path, skip type check
            }

            // 2. Check type rules
            const typeRules = rules.types[typeName];

            if (typeRules === true) {
              logger(`[validateRequest] ${key} - type allows all fields`);
              continue;
            }

            if (typeRules === false) {
              logger(
                `[validateRequest] BLOCKED: ${key} - type blocks all fields`,
              );
              allowed = false;
              continue;
            }

            if (typeof typeRules === 'object' && typeRules !== null) {
              const fieldRule = typeRules[fieldName];

              if (fieldRule === undefined) {
                logger(
                  `[validateRequest] BLOCKED: ${key} - not in allowed list`,
                );
                allowed = false;
                continue;
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
              continue;
            }

            // No rules for this type = BLOCKED
            logger(`[validateRequest] BLOCKED: ${key} - no rules for type`);
            allowed = false;
          }
        },
        leave(node) {
          console.log('Leaving Field:', { fieldName: node.name.value });
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
