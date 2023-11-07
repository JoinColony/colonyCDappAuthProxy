import dotenv from "dotenv";
import express from "express";
import Session from 'express-session';
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";
import { generateNonce, SiweMessage } from 'siwe';

dotenv.config();

const proxyServer = express();

proxyServer.use(express.json());
proxyServer.use(cors({
  origin: true,
  credentials: true,
}));
proxyServer.use(Session({
  name: 'colony-cdapp-auth-proxy',
  secret: process.env.SECRET || 'pleasechangemebeforegoingintoproduction',
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false, sameSite: true },
}));

proxyServer.get(
  '/health',
  (req, res) => {
    res.sendStatus(200);
  },
);

declare module 'express-session' {
  interface SessionData {
    nonce?: string;
    siwe?: SiweMessage;
  }
}

proxyServer.get(
  '/nonce',
  (req, res) => {
    req.session.nonce = generateNonce();
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(req.session.nonce);
  },
);

proxyServer.post(
  '/verify',
  async (req, res) => {
    try {
      if (!req.body.message) {
        res.status(422).json({ message: 'Expected prepareMessage object as body.' });
        return;
      }

      console.log({
        body: req.body,
        session: req.session,
      })

      let SIWEObject = new SiweMessage(req.body.message);
      const { data: message, ...rest } = await SIWEObject.verify({ signature: req.body.signature, nonce: req.session.nonce });

      console.log({ message, ...rest });

      req.session.siwe = message;
      req.session.cookie.expires = new Date(message?.expirationTime || Date.now());
      req.session.save(() => res.status(200).send(true));
    } catch (e) {
      req.session.siwe = undefined;
      req.session.nonce = undefined;
      console.error(e);
    }
  },
);

proxyServer.get('/personal_information', function (req, res) {
  console.log({ session: req.session})
  if (!req.session.siwe) {
    res.status(401).json({ message: 'You have to first sign_in' });
    return;
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send(`You are authenticated and your address is: ${req.session.siwe.address}`);
});

proxyServer.use('', (req, res, next) => {
  // @TODO Add proper authorization check
  if (req.headers.authorization) {
    // fetch and forward the query/mutation
    return next();
  } else {
    res.sendStatus(403);
  }
});

proxyServer.listen(process.env.PORT || 3005, () => {
  console.log(`Authentication proxy listening on port ${process.env.PORT || 3005}`);
});
