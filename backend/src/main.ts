import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // body parser 한도 확장 — 포트폴리오 카드 details(Json) 안에 base64
  // 이미지/파일 dataUrl 이 들어가서 default 100KB 한도를 쉽게 넘김.
  // frontend 가 강제로 이미지 3MB / 파일 8MB 까지만 허용하므로, 여러 자료가
  // 한 카드에 묶여도 20MB 안쪽에서 처리 가능하도록 설정.
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ limit: '20mb', extended: true }));

  // CORS 설정 — FRONTEND_URL 에 콤마로 여러 origin 지정 가능
  // 예: FRONTEND_URL=https://mocozi.vercel.app,http://localhost:3000
  const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // 글로벌 ValidationPipe - DTO 유효성 검사 자동 적용
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 글로벌 예외 필터
  app.useGlobalFilters(new HttpExceptionFilter());

  // 글로벌 응답 변환 인터셉터
  app.useGlobalInterceptors(new TransformInterceptor());

  // API 접두사
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`🚀 모코지 API 서버가 포트 ${port}에서 실행 중입니다.`);
}
bootstrap();
