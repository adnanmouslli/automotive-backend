import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';
// test
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });
  
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  // إنشاء مجلدات الرفع إذا لم تكن موجودة
  const uploadsPath = join(process.cwd(), 'uploads');
  const imagesPath = join(uploadsPath, 'images');
  const signaturesPath = join(uploadsPath, 'signatures');

  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      logger.log('✅ تم إنشاء مجلد uploads في: ' + uploadsPath);
    }
    
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true });
      logger.log('✅ تم إنشاء مجلد images في: ' + imagesPath);
    }
    
    if (!fs.existsSync(signaturesPath)) {
      fs.mkdirSync(signaturesPath, { recursive: true });
      logger.log('✅ تم إنشاء مجلد signatures في: ' + signaturesPath);
    }
  } catch (error) {
    logger.error('❌ خطأ في إنشاء مجلدات الرفع:', error);
  }

  // إعداد الـ static files قبل تطبيق API prefix
  app.use('/uploads', express.static(uploadsPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // تحديد نوع المحتوى بناءً على امتداد الملف
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (path.endsWith('.png')) {
        res.setHeader('Content-Type', 'image/png');
      } else if (path.endsWith('.gif')) {
        res.setHeader('Content-Type', 'image/gif');
      } else if (path.endsWith('.webp')) {
        res.setHeader('Content-Type', 'image/webp');
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }));

  logger.log('📁 تم إعداد خدمة الملفات الثابتة:');
  logger.log(`   - مسار الملفات: ${uploadsPath}`);
  logger.log(`   - رابط الوصول: /uploads/`);

  // تطبيق API prefix بعد static files
  const apiPrefix = configService.get('API_PREFIX', '/');
  if (apiPrefix !== '/') {
    app.setGlobalPrefix(apiPrefix);
  }
  
  app.useGlobalPipes(new ValidationPipe());

  // إعداد CORS
  const corsOrigin = configService.get('CORS_ORIGIN', '*');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  
  const serverUrl = await app.getUrl();
    console.log(`الخادم يعمل على: ${serverUrl}`);
  
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('❌ فشل في بدء تشغيل التطبيق', error);
  process.exit(1); 
});