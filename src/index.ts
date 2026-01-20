import dotenv from 'dotenv';

import proxyServerInstance from './server';
import { handleWsUpgrade } from './routes/graphql/ws';
import { initSchema } from './schema';

dotenv.config();

const port = process.env.DEFAULT_PORT || 3005;

(async () => {
  try {
    await initSchema();
    console.log('GraphQL schema loaded successfully');
  } catch (error) {
    console.error('Failed to load GraphQL schema:', error);
    process.exit(1);
  }

  const proxy = proxyServerInstance();

  const server = proxy.listen(port, () => {
    /*
     * @NOTE Use console log here as to ensure it will always be logged
     */
    console.log(`Authentication proxy listening on port ${port}`);
  });

  // Custom websocker upgrade proxy handler
  server.on('upgrade', handleWsUpgrade);
})();
