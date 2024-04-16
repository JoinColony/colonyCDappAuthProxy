import dotenv from "dotenv";

import proxyServerInstance from './server';
import { handleWsUpgrade } from './routes/graphql/ws';


dotenv.config();

const port = process.env.DEFAULT_PORT || 3005;
const proxy = proxyServerInstance();

const server = proxy.listen(port, () => {
  /*
   * @NOTE Use console log here as to ensure it will always be logged
   */
  console.log(`Authentication proxy listening on port ${port}`);
});

// Custom websocker upgrade proxy handler
server.on('upgrade', handleWsUpgrade)
