import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import WebSocket from 'ws';

import { logger } from '~helpers';

// The host of the AppSync API (non-realtime)
const WS_HOST = new URL('/', process.env.APPSYNC_API).host;
// In production the Amplify WebSocket API is secure and requires a different endpoint
const WS_ENDPOINT = process.env.NODE_ENV === 'dev' ? `ws://${WS_HOST}` : process.env.APPSYNC_WSS_API;

const wss = new WebSocket.Server({ noServer: true });

// Custom websocker upgrade handler
// This proxies websocket requests and adds the necessary headers for Amplify authorization if applicable
export const handleWsUpgrade = (req: InstanceType<typeof IncomingMessage>, socket: Duplex, head: Buffer) => {
    // localhost is fine here, we're just using the path and the query string
    const url = new URL(req.url || '', 'http://localhost');
    const authHeaders = {
        host: WS_HOST,
        // Creates a date in the format YYYYMMDDTHHMMSSZ
        'x-amz-date': new Date().toISOString().replace(/[\-:]/g,'').replace(/\.\d{3}/,''),
        'x-api-key': process.env.APPSYNC_API_KEY,
    } 
    // Add "header" query string parameter (default is {})
    url.searchParams.set('header', btoa((JSON.stringify(authHeaders))));
    const proxyPath = `${url.pathname}?${url.searchParams.toString()}`
    // Establish a websocket connection to Amplify
    const targetWs = new WebSocket(
        `${WS_ENDPOINT}${proxyPath}`,
        req.headers['sec-websocket-protocol'] || 'graphql-ws',
    );
    targetWs.on('open', () => {
        wss.handleUpgrade(req, socket, head, (ws) => {
            // Add authorization headers to incoming client messages
            ws.on('message', (data) => {
                let parsed;
                try {
                    parsed = JSON.parse(data.toString());
                } catch (e) {
                    logger('Failed to parse websocket message', e);
                    return;
                }
                if (parsed.payload?.extensions?.authorization) {
                    parsed.payload.extensions.authorization = {
                        ...parsed.payload.extensions.authorization,
                        ...authHeaders,
                    };
                    return targetWs.send(JSON.stringify(parsed));
                }
                targetWs.send(data.toString());
            });
            ws.on('close', () => {
                targetWs.close();
            });
            ws.on('error', (err) => {
                logger('WebSocket error from client: ', err);
                targetWs.close();
            });

            // Pass through messages from Amplify to the client
            targetWs.on('message', (data) => {
                ws.send(data.toString());
            });
            targetWs.on('close', () => {
                ws.close();
            });
            targetWs.on('error', (err) => {
                logger('WebSocket error from Amplify: ', err);
                ws.close();
            });
        });
    });
};
