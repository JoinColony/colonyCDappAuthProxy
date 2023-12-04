import ExpressSession from "express-session";
import { SiweMessage } from 'siwe';

declare module 'express-session' {
  interface SessionData {
    auth?: SiweMessage;
  }
}

export default ExpressSession;
