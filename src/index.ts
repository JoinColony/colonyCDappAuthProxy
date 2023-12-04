import dotenv from "dotenv";

import proxyServerInstance from './server';

dotenv.config();

const port = process.env.DEFAULT_PORT || 3005;
const server = proxyServerInstance();

server.listen(port, () => {
  /*
   * @NOTE Use console log here as to ensure it will always be logged
   */
  console.log(`Authentication proxy listening on port ${port}`);
});
