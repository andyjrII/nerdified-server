import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const fromEnv = process.env.FRONTEND_BASE_URL
    ? process.env.FRONTEND_BASE_URL.split(',').map((u) => u.trim())
    : [];
  const devOrigins = ['http://localhost:3101'];
  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? fromEnv.length ? fromEnv : devOrigins
      : [...new Set([...fromEnv, ...devOrigins])];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    maxAge: 86400,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe());
  const port = process.env.PORT ?? 3100;
  await app.listen(port);
}
bootstrap();
