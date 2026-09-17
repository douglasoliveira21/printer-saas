import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const port = config.get<number>('WORKER_PORT', 3002);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Worker health endpoint listening on port ${port}`);
}

bootstrap();
