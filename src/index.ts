import dotenv from "dotenv";

import proxyServerInstance from './server';

dotenv.config();

const port = process.env.DEFAULT_PORT || 3005;
const server = proxyServerInstance();

server.listen(port, () => {
  console.log(`Authentication proxy listening on port ${port}`);
});
