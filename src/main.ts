import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuração de CORS
  app.enableCors({
    origin: [
      'https://elnata-nexa-ia-frontend.cc6xgb.easypanel.host',
      'https://elnata-holodeckhubb.cc6xgb.easypanel.host',
      'http://localhost:9000',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    preflightContinue: false,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 9000;

  await app.listen(port);
  console.log(`Server is running on port ${port}`);
}

void bootstrap();
