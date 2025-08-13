import { Controller, Get, Param, Res, UseGuards, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/common';
import { PdfService } from './pdf.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private readonly htmlReportService: PdfService) {}

  @Get(':id/pdf')
async generateOrderPdf(
  @Param('id') orderId: string,
  @Res() res: Response
) {
  try {
    const { buffer, filename } = await this.htmlReportService.generateAndDownloadOrderPdf(orderId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    
    res.send(buffer);
  } catch (error) {
    throw new InternalServerErrorException('Failed to generate PDF');
  }
}

// Endpoint لإرسال PDF بالبريد الإلكتروني
@Post(':id/send-pdf-email')
async sendOrderPdfEmail(
  @Param('id') orderId: string,
  @Body() body: { email: string }
) {
  try {
    await this.htmlReportService.sendOrderPdfByEmail(orderId, body.email);
    return {
      success: true,
      message: 'PDF report sent successfully',
      email: body.email,
      timestamp: new Date()
    };
  } catch (error) {
    throw new InternalServerErrorException('Failed to send PDF email');
  }
}



  @Get('order/:orderId/preview')
  async previewOrderHtml(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`👁️ طلب معاينة تقرير HTML للطلبية ${orderId}`);

    try {
      const htmlContent = await this.htmlReportService.generateOrderHtml(orderId);
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.send(htmlContent);
      console.log(`✅ تم عرض تقرير HTML للمعاينة بنجاح`);
    } catch (error) {
      console.error('❌ خطأ في معاينة تقرير HTML:', error);
      res.status(500).json({ 
        message: 'فشل في معاينة التقرير',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

}