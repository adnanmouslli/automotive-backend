import { Module } from '@nestjs/common';
import { PrismaConfig } from './config/prisma.config';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { appConfig, databaseConfig } from './config/configuration';
import { validate } from './config/env.validation';
import { UserModule } from './module/user/user.module';
import { AuthModule } from './module/auth/auth.module';
import { OrdersModule } from './module/orders/orders.module';
import { UploadsModule } from './module/uploads/uploads.module';
import { PdfModule } from './module/pdf/pdf.module';


@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      validate,
      expandVariables: true,
    }),

    UserModule,

    AuthModule,

    OrdersModule,

    UploadsModule,

    PdfModule,
    

    
  ],
  providers: [PrismaConfig],
  exports: [PrismaConfig],}
)
export class AppModule {}
