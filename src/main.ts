import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { PrismaService } from './modules/prisma/prisma.service';
import { corsAllowlist, trustedProxies } from './common/request-security';
import { SafeExceptionFilter } from './common/safe-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  // Schema changes belong to a separately approved migration job, never runtime startup.
  const corsOrigins = corsAllowlist(config);
  app.set('trust proxy', trustedProxies(config));

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new SafeExceptionFilter());
  app.use((_request: Request, response: Response, next: NextFunction) => { response.setHeader('Cache-Control', 'private, no-store'); next(); });

  // Increase body size limit to 50mb to prevent "Request entity too large" error when uploading blog posts & cover photos
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ limit: '128kb', extended: false }));

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  app.enableCors({
    origin: corsOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'Cf-Access-Jwt-Assertion', 'X-Payment-Status-Token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('PORT') ?? 5000;
  await app.listen(port);
  console.log(`🚀 ENAKO OS Backend running on port ${port}`);
}

bootstrap();
