import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NumericOverflowFilter } from './common/numeric-overflow.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  // Защитная сетка: слишком большое число не должно выглядеть поломкой системы.
  app.useGlobalFilters(
    new NumericOverflowFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  app.enableCors();
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();
