import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { buildApiError } from './common/api-error';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: number) => void;
  };
  httpAdapter.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  const configuredOrigins = (
    process.env.FRONTEND_URL ?? 'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(
    new Set([
      ...configuredOrigins,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ]),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowedOrigin =
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      callback(null, isAllowedOrigin);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new BadRequestException(
          buildApiError(
            400,
            'VALIDATION_ERROR',
            'Ошибка валидации запроса.',
            errors,
          ),
        ),
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('PickMe API')
    .setDescription('API documentation for PickMe platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addCookieAuth('refreshToken')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
