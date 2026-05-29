import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import { createNestApp } from '../src/main';

let cachedApp: INestApplication | null = null;
const server = express();

async function getApp(): Promise<INestApplication> {
  if (!cachedApp) {
    cachedApp = await createNestApp(server);
    await cachedApp.init();
  }

  return cachedApp;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  await getApp();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return server(req, res);
}
