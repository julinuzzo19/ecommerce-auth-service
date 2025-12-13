import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { WinstonModule } from 'nest-winston';
import { logger } from './config/logger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as morgan from 'morgan';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './config/exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { CLIENT_URL, NODE_ENV } from './config/configs';
import type { Server } from 'http';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // helmet configuration
  app.use(helmet());
  // CORS configuration
  app.enableCors({
    methods: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'],
    origin: NODE_ENV === 'production' ? CLIENT_URL : '*',
    credentials: true,
  });
  // cookie configuration
  app.use(cookieParser());

  // add prefix
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'metrics'] });

  // csrf protection
  // const { doubleCsrfProtection } = doubleCsrf({
  //   cookieName: 'csrf-token',
  //   getSecret: (req) => 'secret-csrf-token-cookie-value',
  //   cookieOptions: {
  //     secure: process.env.NODE_ENV === 'production',
  //   },
  //   size: 64,
  //   ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  //   getTokenFromRequest: (req) => req.headers['x-csrf-token'],
  // });
  // app.use(doubleCsrfProtection);

  // logger configuration
  app.useLogger(WinstonModule.createLogger({ instance: logger }));
  // log http requests
  app.use(morgan('dev'));
  // validations
  app.useGlobalPipes(new ValidationPipe());
  // exceptions handler
  app.useGlobalFilters(new GlobalExceptionFilter());
  // serve avatar users
  app.use('/avatars', express.static(join(process.cwd(), 'public', 'avatars')));

  // documentation configuration
  if (NODE_ENV === 'production') {
    const config = new DocumentBuilder()
      .setTitle('Users API')
      .setDescription('The users API with NestJS')
      .setVersion('1.0')
      .addTag('users')
      .addBearerAuth()
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, documentFactory);
  }

  const host =
    process.env.NODE_ENV === 'production'
      ? process.env.HOST || '0.0.0.0'
      : '0.0.0.0';

  const port = process.env.PORT;

  const server: Server = await app.listen(port, host);

  server.setTimeout(30000);
}
bootstrap();
