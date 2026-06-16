import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module';

export async function createNestApp(server?: Express) {
  const app = server
    ? await NestFactory.create(AppModule, new ExpressAdapter(server))
    : await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  return app;
}

async function bootstrap() {
  const app = await createNestApp();
  await app.listen(process.env.PORT ?? 3001);
}
if (!process.env.VERCEL) {
  void bootstrap();
}
