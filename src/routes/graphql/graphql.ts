import dotenv from 'dotenv';
import { fixRequestBody, Options, RequestHandler } from 'http-proxy-middleware';
import { Response, Request, NextFunction } from 'express-serve-static-core';
import { ClientRequest, IncomingMessage } from 'http';
// Needs to be ignored since it doesn't have types and TS goe crazy
//@ts-ignore
import modifyResponse from 'node-http-proxy-json';
import { parse, visit, print } from 'graphql';
//@ts-ignore
import jt from '@tsmx/json-traverse';

import {
  getStaticOrigin,
  sendResponse,
  getRemoteIpAddress,
  logger,
  detectOperation,
} from '~helpers';
import {
  ResponseTypes,
  HttpStatuses,
  ContentTypes,
  Headers,
  OperationTypes,
  Urls,
  ServerMethods,
} from '~types';

import addressCanExecuteMutation from './mutations';
import addressCanExecuteQuery from './queries';

dotenv.config();

export const operationExecutionHandler: RequestHandler = async (
  request: Request,
  response: Response,
  nextFn: NextFunction,
) => {
  // short circut early
  if (
    request.path !== Urls.GraphQL ||
    request.method !== ServerMethods.Post.toUpperCase()
  ) {
    return nextFn();
  }

  const userAddress = request.session.auth?.address || '';
  const requestRemoteAddress = getRemoteIpAddress(request);

  try {
    const canExecuteMutation = await addressCanExecuteMutation(request);
    const canExecuteQuery = await addressCanExecuteQuery(request);

    response.locals.canExecute = canExecuteMutation || canExecuteQuery;
    response.locals.requestSanitation = {};
    response.locals.aliases = {};

    // @ts-ignore
    // console.log(request.body?.query);
    // request.body.query = request.body.query.replace('email', '');
    // console.log(request.body.query);
    // console.log(parse(request.body.query));
    // const edited = visit(parse(request.body.query), {
    //   enter(node, key, parent, path, acestors) {
    //     console.log(node.kind);
    //     // @ts-ignore
    //     console.log(node.name);
    //     // console.log('enter');
    //     // console.log('enter', node);
    //     // console.log(node.kind);
    //     // @ts-ignore
    //     // console.log(node.name);
    //     // @ts-ignore
    //     // console.log(node.value);'
    //     /**
    //      * getUser: { abc: { aliased: email }}
    //      *
    //      */
    //     /**
    //      * requestSanitation: {
    //      *   'getUser.abc.aliased': 'email'
    //      * }
    //      *
    //      * INSIDE RESPONSE:
    //      * Fields to delete per type: {
    //      *   'Profile': [{
    //      *    field: 'email',
    //      *    condition: (value) => value !== userAddress
    //      *  }]
    //      * }
    //      *
    //      * ['getUser', 'abc', 'aliased']
    //      * const aliasOrRealName = requestSanitation[['getUser', 'abc', 'aliased'].join('.)] ?? jsonKey;
    //      *
    //      *
    //      * rules[Profile] - do they have aliasOrRealName inside? If they do, delete that field
    //      */
    //     // @ts-ignore
    //     if (node.alias) {
    //       // if (node.kind === 'Field') {
    //       //   let key = '';
    //       //   if (node?.name?.value === 'email') {
    //       //     key = 'email';
    //       //   }
    //       //   if (node?.name?.value === 'profile') {
    //       //     key = 'profile';
    //       //   }
    //       //   response.locals.requestSanitation = {
    //       //     ...response.locals.requestSanitation,
    //       //     [key]: {
    //       //       name: node.name.value,
    //       //       // @ts-ignore
    //       //       alias: node.alias.value,
    //       //       path: [...acestors as Array<any>].filter(name => name?.kind === 'Field').map((entry: any) => {
    //       //         return entry?.alias?.value || entry?.name?.value || 'unknown';
    //       //       }),
    //       //     },
    //       //   };
    //       // }
    //       const path = [...acestors as Array<any>].filter(name => name?.kind === 'Field').map((entry: any) => {
    //         return entry?.alias?.value || entry?.name?.value || 'unknown';
    //       });
    //       response.locals.requestSanitation = {
    //         ...response.locals.requestSanitation,
    //         // @ts-ignore
    //         [node.name.value]: [...path, node.alias.value].join('.'),
    //       };

    //       // @ts-ignore
    //       const aliasPath = [...path, node.alias.value ?? node.name.value].join('.');
    //       response.locals.aliases = {
    //         ...response.locals.aliases,
    //         // @ts-ignore
    //         [aliasPath]: node.name.value,
    //       }
    //     }
    //     // if (node.kind === 'Field' && node?.name?.value === 'email') {
    //     //   response.locals.requestSanitation = {
    //     //     ...response.locals.requestSanitation,
    //     //     email: {
    //     //       name: node.name.value,
    //     //       // @ts-ignore
    //     //       alias: node.alias.value,
    //     //       // path:
    //     //     },
    //     //   };
    //     // }
    //     // if (node.kind === 'Field' && node.name.value === 'profile') {
    //     //   response.locals.requestSanitation = {
    //     //     ...response.locals.requestSanitation,
    //     //     profile: {
    //     //       name: node.name.value,
    //     //       // @ts-ignore
    //     //       alias: node.alias.value,
    //     //       // path:
    //     //     },
    //     //   };
    //     // }
    //     if (node.kind === 'SelectionSet') {
    //       // console.log(node);
    //       return {
    //         ...node,
    //         selections: [
    //           ...node.selections,
    //           {
    //             kind: 'Field',
    //             name: {
    //               kind: 'Name',
    //               value: '__typename'
    //             }
    //           }
    //         ]
    //       };
    //     }
    //     // @ts-ignore
    //     // if (node.alias) {
    //     //   // @ts-ignore
    //     //   console.log(node?.alias?.value, node?.name?.value);
    //     //   // console.log({ key, path, parent, acestors });
    //       // console.log([...acestors as Array<any>].filter(name => name?.kind === 'Field').map((entry: any) => {
    //       //   return entry?.alias?.value || entry?.name?.value || 'unknown';
    //       // }));
    //     // }
    //   },
    //   // leave(node) {
    //   //   console.log('leave');
    //   //   // console.log('leave', node);
    //   //   // console.log(node.kind);
    //   //   // @ts-ignore
    //   //   console.log(node.name);
    //   //   // @ts-ignore
    //   //   console.log(node.value);
    //   // }
    // });
    // // console.log(print(edited));
    // request.body.query = print(edited);

    // console.log(JSON.stringify(request.body, null, 2));

    return nextFn();
  } catch (error: any) {
    logger(
      `${
        userAddress ? `auth-${userAddress}` : 'non-auth'
      } request malformed graphql ${
        request.body ? JSON.stringify(request.body) : ''
      } from ${requestRemoteAddress}`,
    );
    return sendResponse(response, request, error, HttpStatuses.SERVER_ERROR);
  }
};

export const graphQlProxyRouteHandler: Options = {
  target: process.env.APPSYNC_API,
  changeOrigin: true,
  headers: {
    [Headers.ApiKey]: process.env.APPSYNC_API_KEY || '',
    [Headers.ContentType]: ContentTypes.Json,
  },
  pathRewrite: { '^/graphql': '' },
  onProxyReq: (
    proxyRequest: ClientRequest,
    request: Request,
    response: Response,
  ) => {
    const userAuthenticated = !!request.session.auth;
    const userAddress = request.session.auth?.address || '';
    const requestRemoteAddress = getRemoteIpAddress(request);
    try {
      if (request?.body?.query) {
        /*
         * Used for UI only, the real magic with detection happens in operationExecutionHandler
         */
        const { operationType, operations, variables = {} } = detectOperation(
          request.body,
        );

        /*
         * Queries are (mostly, some are restricted) all allowed, while mutations need to be handled on a case by case basis
         * Some are allowed without auth (cache refresh ones)
         * Others based on if the user has the appropriate address and/or role
         */
        const canExecute = response.locals.canExecute;

        logger(
          `${
            userAuthenticated ? `auth` : 'non-auth'
          } ${operationType} ${operations} ${JSON.stringify(variables).slice(
            0,
            500,
          )}${
            JSON.stringify(variables).length > 499
              ? ` [+${JSON.stringify(variables).length - 499} chars more]`
              : ''
          }${
            userAddress ? ` from ${userAddress}` : ''
          } at ${requestRemoteAddress} was ${
            canExecute
              ? '\x1b[32m ALLOWED \x1b[0m'
              : '\x1b[31m FORBIDDEN \x1b[0m'
          }`,
        );

        // allowed
        if (canExecute) {
          proxyRequest.setHeader(Headers.WalletAddress, userAddress);
          return fixRequestBody(proxyRequest, request);
        }

        // forbidden
        return sendResponse(
          response,
          request,
          {
            message: 'forbidden',
            type: ResponseTypes.Auth,
            data: '',
          },
          HttpStatuses.FORBIDDEN,
        );
      }

      /*
       * Malformed request
       */
      logger(
        `${userAuthenticated ? `auth` : 'non-auth'} request malformed graphql ${
          request.body ? JSON.stringify(request.body) : ''
        }${
          userAddress ? ` from ${userAddress}` : ''
        } at ${requestRemoteAddress}`,
      );
      return sendResponse(
        response,
        request,
        {
          message: 'malformed graphql request',
          type: ResponseTypes.Error,
          data: '',
        },
        HttpStatuses.SERVER_ERROR,
      );
    } catch (error: any) {
      /*
       * GraphQL error (comes from the AppSync endopoint)
       */
      logger(
        `${userAuthenticated ? `auth` : 'non-auth'} graphql proxy error ${
          error?.message
        } ${request.body ? JSON.stringify(request.body) : ''}${
          userAddress ? ` from ${userAddress}` : ''
        } at ${requestRemoteAddress}`,
      );
      return sendResponse(
        response,
        request,
        {
          message: 'graphql error',
          type: ResponseTypes.Error,
          data: error?.message || '',
        },
        HttpStatuses.SERVER_ERROR,
      );
    }
  },
  // selfHandleResponse: true,
  onProxyRes: (proxyResponse: IncomingMessage, request: Request, response: Response) => {
    proxyResponse.headers[Headers.AllowOrigin] = getStaticOrigin(
      request.headers.origin,
    );

    console.log('requestSanitization', response.locals.requestSanitation);
    console.log('aliases', response.locals.aliases);

    proxyResponse.headers[Headers.PoweredBy] = 'Colony';
//     modifyResponse(response, proxyResponse, (body: Record<string, any>) => {
//       try {
//         if (body) {
//           // Don't return the API key to the client
//           // so that it doesn't get exposed
//           // delete body.integrations['Segment.io'].apiKey;
//           // console.log({body: JSON.stringify(body, null, 2)});
//           // delete body.getUser.abc.
//           const modifiedBody = { ...body };
//           // console.log(modifiedBody);
//           const callbacks = {
//             processValue: (key: any, value: any, level: any, path: any, isObjectRoot: any, isArrayElement: any, cbSetValue: any) => {
//               // console.log({ key, value, isObjectRoot, level, path });
//               // ['data', 'getUser', 'profile', 'metadata', '__typename']
//               // { data: { getUser: { profile }}}

//               console.log({key})

//               const config =  {
//                  'Profile': [{
//                   field: 'email',
//                   deleteIf: (value: any) => !value?.id || value?.id !== request.session.auth?.address
//                  }]
//                }

//               // const realFieldName = response.locals.requestSanitation[path] ?? key;
//               // const parentTypename = <<PARENT>>.__typename;

//               // const matchingRule = config[parentTypename];
//               // if(matchingRule && matchingRule.includes(realFieldName)) {
//               //   delete <<PARENT>>[key]
//               // }

//               // console.log({ })
//               /**
//                * profile1: profile {
//                *  alias1: email
//                * }
//                *
//                * profile2: profile {
//                *  alias2: email
//                * }
//                */

//               try {
// // @ts-ignore
// const matchingConfig = config[value?.__typename];

// if(matchingConfig) {
//   for(const property of Object.keys(value)) {
//     const realFieldName = response.locals.aliases[[...(path.filter((segment: any) => segment !== 'data')), key, property].join('.')] ?? property;

//     const matchingRule = matchingConfig.find((rule: any) => rule.field === realFieldName);

//     console.log({realFieldName, matchingRule, deleteIf: matchingRule?.deleteIf(value)})

//     if(matchingRule && matchingRule.deleteIf(value)) {
//       console.log('delete email')
//         delete value[property];
//     }
//   }
// }
//               } catch(error) {
//                 console.error(error)
//               }


//               // if(value?.__typename === 'Profile') {

//               //   const hasAccessToPrivateData = !!value?.id && value?.id === request.session.auth?.address;


//               //   for(const property of Object.keys(value)) {
//               //     console.log('alias path: ', [...path, key, property].join('.'))
//               //     const realFieldName = response.locals.aliases[[...(path.filter((segment: any) => segment !== 'data')), key, property].join('.')] ?? property;
//               //     console.log({property, realFieldName})
//               //     const profileConfig = config['Profile'];


//               //     if(profileConfig.includes(realFieldName)) {
//               //       console.log('delete email')
//               //       if(!hasAccessToPrivateData) {
//               //         delete value[property];
//               //       }
//               //     }
//               //   }

//               //   // console.log('hello', value, key)

//               //   // const emailFieldName = response.locals.requestSanitation['email'] ? response.locals.requestSanitation['email'].split('.').pop() : 'email';

//               //   // const emailPath = response.locals.requestSanitation['email'] ? ['data', ...response.locals.requestSanitation['email'].split('.')] : [...path, key, 'email'];
//               //   // console.log(emailFieldName)


//               //   // console.log({ hasAccessToPrivateData})

//               //   // const copiedValue = {
//               //   //   ...value
//               //   // }

//               //   // if (!hasAccessToPrivateData) {
//               //   //   delete copiedValue[emailFieldName]
//               //   // }

//               //   // cbSetValue(copiedValue)

//               //   // let currentObj = modifiedBody;
//               //   // let idx = 0;
//               //   // while (idx < emailPath.length - 1) {
//               //   //   currentObj = currentObj[emailPath[idx]];
//               //   //   if (!currentObj) {
//               //   //     delete currentObj[emailPath[emailPath.length - 1]];
//               //   //   }
//               //   //   idx++;
//               //   // }
//               //   // if (!hasAccessToPrivateData) {
//               //   //   delete currentObj[emailPath[emailPath.length - 1]];
//               //   // }

//               // }

//               // if (key === '__typename' && value === 'Profile') {
//               //   const emailPath = response.locals.requestSanitation['email'] ? ['data', ...response.locals.requestSanitation['email'].split('.')] : [...path, 'email'];
//               //   console.log(emailPath)
//               //   // const fieldToDeleteOnProfile = ['email'];
//               //   // delete modifiedBody.data.getUser.profile.email;
//               //   // const hasAlias = !!response.locals.requestSanitation[path.slice(1).join('.')];
//               //   // console.log({ hasAlias})
//               //   // console.log(path.join('.'));
//                 // let currentObj = modifiedBody;
//                 // let idx = 0;
//                 // while (idx < emailPath.length -1 ) {
//                 //   currentObj = currentObj[emailPath[idx]];
//                 //   if (!currentObj) {
//                 //     delete currentObj[emailPath[emailPath.length - 1]];
//                 //   }
//                 //   idx++;
//                 // }
//                 // delete currentObj[emailPath[emailPath.length - 1]];
//               // }
//               /* your logic here */
//             },
//             enterLevel: (level: any, path: any) => {
//               /* your logic here */
//             },
//             exitLevel: (level: any, path: any) => {
//               /* your logic here */
//             }
//           };

//           jt.traverse(body, callbacks);
//           return modifiedBody;
//         }
//       } catch (error) {
//         // proxyResponse.destroy();
//       }
//       return body;
//     });
  },
  logProvider: () => ({
    log: logger,
    info: logger,
    error: logger,
    warn: logger,
    debug: logger,
  }),
};
