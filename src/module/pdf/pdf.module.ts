import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PdfController } from './pdf.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'yazanmouslli6@gmail.com',
          pass: 'hvmo zlnj gusd zlov',
        },
      },
      defaults: {
        from: '"Adnan Mouslli" <yazanmouslli6@gmail.com>',
      },
    }),
    
  ],
  controllers: [PdfController],
  providers: [PdfService , PrismaService],
})
export class PdfModule {}
