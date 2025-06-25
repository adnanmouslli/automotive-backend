import { Controller, Get, Param, Res, UseGuards, ParseIntPipe, Post, Body } from '@nestjs/common';
import { Response } from 'express';
import { PdfService } from './pdf.service';
import { JwtAuthGuard } from 'src/common';

@Controller('pdf')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Get('order/:orderId')
  async downloadOrderPdf(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`📥 طلب تحميل PDF للطلبية ${orderId}`);

    try {
      const pdfBuffer = await this.pdfService.generateOrderPdf(orderId);
      
      const filename = `Handover_Report_${orderId}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });
      
      res.send(pdfBuffer);
      console.log(`✅ تم إرسال PDF بنجاح: ${filename}`);
    } catch (error) {
      console.error('❌ خطأ في إنشاء PDF:', error);
      res.status(500).json({ 
        message: 'فشل في إنشاء ملف PDF',
        error: error.message 
      });
    }
  }


  
  @Get('order/:orderId/preview')
  async previewOrderPdf(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`👁️ طلب معاينة PDF للطلبية ${orderId}`);

    try {
      const pdfBuffer = await this.pdfService.generateOrderPdf(orderId);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      });
      
      res.send(pdfBuffer);
      console.log(`✅ تم عرض PDF للمعاينة`);
    } catch (error) {
      console.error('❌ خطأ في معاينة PDF:', error);
      res.status(500).json({ 
        message: 'فشل في معاينة ملف PDF',
        error: error.message 
      });
    }
  }

  @Post('order/:orderId/send-email')
  async sendOrderPdfByEmail(
    @Param('orderId') orderId: string,
    @Body('email') email: string,
  ) {
    try {
      await this.pdfService.sendOrderPdfByEmail(orderId, email);
      return { message: '✅ تم إرسال التقرير إلى البريد الإلكتروني بنجاح' };
    } catch (error) {
      console.error('❌ فشل إرسال التقرير بالبريد الإلكتروني:', error);
      return {
        message: '❌ فشل إرسال التقرير بالبريد الإلكتروني',
        error: error.message,
      };
    }
  }

}