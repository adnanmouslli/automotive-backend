import { Controller, Get, Param, Res, UseGuards, Post, Body } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/common';
import { PdfService } from './pdf.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private readonly htmlReportService: PdfService) {}

  @Get('order/:orderId/download')
  async downloadOrderHtml(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`📥 طلب تحميل تقرير HTML للطلبية ${orderId}`);

    try {
      const htmlContent = await this.htmlReportService.generateOrderHtml(orderId);
      
      const filename = `Fahrzeuguebergabe_${orderId}_${new Date().toISOString().split('T')[0]}.html`;
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': Buffer.byteLength(htmlContent, 'utf8'),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.send(htmlContent);
      console.log(`✅ تم إرسال تقرير HTML بنجاح: ${filename}`);
    } catch (error) {
      console.error('❌ خطأ في إنشاء تقرير HTML:', error);
      res.status(500).json({ 
        message: 'فشل في إنشاء ملف التقرير',
        error: error.message,
        timestamp: new Date().toISOString()
      });
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

  @Post('order/:orderId/send-email')
  async sendOrderHtmlByEmail(
    @Param('orderId') orderId: string,
    @Body('email') email: string,
  ) {
    console.log(`📧 طلب إرسال تقرير HTML بالبريد الإلكتروني للطلبية ${orderId} إلى ${email}`);

    try {
      // التحقق من صحة البريد الإلكتروني
      if (!email || !this.isValidEmail(email)) {
        return {
          success: false,
          message: '❌ البريد الإلكتروني غير صالح',
          timestamp: new Date().toISOString()
        };
      }

      await this.htmlReportService.sendOrderHtmlByEmail(orderId, email);
      
      console.log(`✅ تم إرسال تقرير HTML بالبريد الإلكتروني بنجاح إلى ${email}`);
      
      return { 
        success: true,
        message: '✅ تم إرسال التقرير إلى البريد الإلكتروني بنجاح',
        email: email,
        orderId: orderId,
        reportType: 'HTML',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ فشل إرسال التقرير بالبريد الإلكتروني:', error);
      
      return {
        success: false,
        message: '❌ فشل إرسال التقرير بالبريد الإلكتروني',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('order/:orderId/preview-clean')
  async previewOrderHtmlClean(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`🌐 طلب معاينة تقرير HTML نظيف للطلبية ${orderId}`);

    try {
      const htmlContent = await this.htmlReportService.generateOrderHtml(orderId);
      
      // إزالة أزرار التحكم للمعاينة النظيفة
      const cleanHtmlContent = htmlContent.replace(
        /<div class="print-controls no-print">[\s\S]*?<\/div>/,
        ''
      );
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.send(cleanHtmlContent);
      console.log(`✅ تم عرض تقرير HTML النظيف للمعاينة بنجاح`);
    } catch (error) {
      console.error('❌ خطأ في معاينة تقرير HTML النظيف:', error);
      res.status(500).json({ 
        message: 'فشل في معاينة التقرير النظيف',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  @Get('order/:orderId/print-ready')
  async getPrintReadyHtml(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`🖨️ طلب تقرير HTML جاهز للطباعة للطلبية ${orderId}`);

    try {
      const htmlContent = await this.htmlReportService.generateOrderHtml(orderId);
      
      // تحسين HTML للطباعة
      const printReadyHtml = this.optimizeForPrint(htmlContent);
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.send(printReadyHtml);
      console.log(`✅ تم إرسال تقرير HTML جاهز للطباعة بنجاح`);
    } catch (error) {
      console.error('❌ خطأ في تحضير تقرير HTML للطباعة:', error);
      res.status(500).json({ 
        message: 'فشل في تحضير التقرير للطباعة',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  @Get('order/:orderId/mobile-friendly')
  async getMobileFriendlyHtml(
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ) {
    console.log(`📱 طلب تقرير HTML متوافق مع الموبايل للطلبية ${orderId}`);

    try {
      const htmlContent = await this.htmlReportService.generateOrderHtml(orderId);
      
      // تحسين HTML للموبايل
      const mobileFriendlyHtml = this.optimizeForMobile(htmlContent);
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.send(mobileFriendlyHtml);
      console.log(`✅ تم إرسال تقرير HTML متوافق مع الموبايل بنجاح`);
    } catch (error) {
      console.error('❌ خطأ في تحضير تقرير HTML للموبايل:', error);
      res.status(500).json({ 
        message: 'فشل في تحضير التقرير للموبايل',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // @Get('order/:orderId/info')
  // async getOrderReportInfo(
  //   @Param('orderId') orderId: string,
  // ) {
  //   console.log(`ℹ️ طلب معلومات تقرير للطلبية ${orderId}`);

  //   try {
  //     // الحصول على معلومات الطلبية الأساسية
  //     const order = await this.htmlReportService['prisma'].order.findUnique({
  //       where: { id: orderId },
  //       select: {
  //         id: true,
  //         orderNumber: true,
  //         client: true,
  //         serviceType: true,
  //         status: true,
  //         createdAt: true,
  //         updatedAt: true,
  //         _count: {
  //           select: {
  //             images: true,
  //             signatures: true
  //           }
  //         }
  //       }
  //     });

  //     if (!order) {
  //       return {
  //         success: false,
  //         message: 'الطلبية غير موجودة',
  //         orderId: orderId
  //       };
  //     }

  //     return {
  //       success: true,
  //       orderId: orderId,
  //       orderInfo: {
  //         orderNumber: order.orderNumber,
  //         client: order.client,
  //         serviceType: order.serviceType,
  //         status: order.status,
  //         createdAt: order.createdAt,
  //         updatedAt: order.updatedAt,
  //         statistics: {
  //           imagesCount: order._count.images,
  //           signaturesCount: order._count.signatures,
  //           isComplete: order._count.signatures >= 2 // سائق وعميل
  //         }
  //       },
  //       reportOptions: {
  //         formats: ['HTML'],
  //         features: {
  //           download: true,
  //           preview: true,
  //           email: true,
  //           printOptimized: true,
  //           mobileOptimized: true
  //         }
  //       },
  //       timestamp: new Date().toISOString()
  //     };
  //   } catch (error) {
  //     console.error('❌ خطأ في الحصول على معلومات التقرير:', error);
      
  //     return {
  //       success: false,
  //       message: 'فشل في الحصول على معلومات التقرير',
  //       error: error.message,
  //       timestamp: new Date().toISOString()
  //     };
  //   }
  // }

  @Get('health')
  async healthCheck() {
    try {
      // فحص الاتصال بقاعدة البيانات
      await this.htmlReportService['prisma'].$queryRaw`SELECT 1`;
      
      return {
        status: 'healthy',
        service: 'HTML Report Service',
        timestamp: new Date().toISOString(),
        features: {
          htmlGeneration: true,
          emailSending: true,
          htmlPreview: true,
          printOptimization: true,
          mobileOptimization: true
        },
        endpoints: {
          download: '/reports/order/:orderId/download',
          preview: '/reports/order/:orderId/preview',
          sendEmail: '/reports/order/:orderId/send-email',
          printReady: '/reports/order/:orderId/print-ready',
          mobileFriendly: '/reports/order/:orderId/mobile-friendly',
          info: '/reports/order/:orderId/info'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'HTML Report Service',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  @Get('templates/preview')
  async previewTemplate(@Res() res: Response) {
    console.log(`🎨 طلب معاينة قالب التقرير`);

    try {
      // إنشاء بيانات وهمية لمعاينة القالب
      const mockOrder = this.createMockOrderData();
      const htmlContent = await this.htmlReportService['generateHtmlContent'](mockOrder);
      
      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      
      res.send(htmlContent);
      console.log(`✅ تم عرض معاينة القالب بنجاح`);
    } catch (error) {
      console.error('❌ خطأ في معاينة القالب:', error);
      res.status(500).json({ 
        message: 'فشل في معاينة القالب',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  // === مساعدات خاصة ===

  private optimizeForPrint(htmlContent: string): string {
    // إضافة أنماط خاصة بالطباعة
    const printStyles = `
      <style>
        @media print {
          body { margin: 0; }
          .page-break { page-break-before: always; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
        .print-only { display: none; }
      </style>
    `;
    
    return htmlContent.replace('</head>', `${printStyles}</head>`);
  }

  private optimizeForMobile(htmlContent: string): string {
    // إضافة أنماط خاصة بالموبايل
    const mobileStyles = `
      <style>
        @media (max-width: 768px) {
          .cover-page { padding: 20px; }
          .main-title { font-size: 32px; }
          .sub-title { font-size: 24px; }
          .info-grid, .details-grid, .vehicle-grid, 
          .address-container, .signatures-container { 
            grid-template-columns: 1fr; 
          }
          .images-container { 
            grid-template-columns: 1fr; 
          }
          .print-controls {
            position: relative;
            top: auto;
            right: auto;
            margin: 20px;
            justify-content: center;
          }
        }
      </style>
    `;
    
    return htmlContent.replace('</head>', `${mobileStyles}</head>`);
  }

  private createMockOrderData(): any {
    return {
      id: 'sample-id',
      orderNumber: 'ORD-2025-SAMPLE',
      client: 'Max Mustermann',
      clientPhone: '+49 123 456 7890',
      clientEmail: 'max.mustermann@example.com',
      serviceType: 'TRANSPORT',
      status: 'completed',
      description: 'Beispielhafte Fahrzeugübergabe für Templatevorschau',
      licensePlateNumber: 'B-MW 1234',
      vin: 'WBABA91060AL12345',
      vehicleOwner: 'Max Mustermann',
      brand: 'BMW',
      model: '320d',
      year: '2023',
      color: 'Alpinweiß',
      createdAt: new Date(),
      updatedAt: new Date(),
      pickupAddress: {
        street: 'Musterstraße',
        houseNumber: '123',
        zipCode: '10115',
        city: 'Berlin',
        country: 'Deutschland',
        additionalInfo: 'Hinterhof, 2. Etage'
      },
      deliveryAddress: {
        street: 'Lieferstraße',
        houseNumber: '456',
        zipCode: '80331',
        city: 'München',
        country: 'Deutschland'
      },
      driver: {
        name: 'Hans Schmidt',
        phone: '+49 987 654 3210'
      },
      images: [
        {
          id: '1',
          imageUrl: 'sample1.jpg',
          category: 'PICKUP',
          description: 'Fahrzeug bei Abholung - Frontansicht',
          createdAt: new Date()
        },
        {
          id: '2',
          imageUrl: 'sample2.jpg', 
          category: 'DELIVERY',
          description: 'Fahrzeug bei Lieferung - Seitenansicht',
          createdAt: new Date()
        }
      ],
      signatures: [
        {
          id: '1',
          name: 'Hans Schmidt',
          isDriver: true,
          signUrl: 'driver-signature.png',
          signedAt: new Date()
        },
        {
          id: '2', 
          name: 'Max Mustermann',
          isDriver: false,
          signUrl: 'customer-signature.png',
          signedAt: new Date()
        }
      ],
      expenses: {
        fuel: 45.50,
        wash: 15.00,
        adBlue: 8.90,
        tollFees: 12.50,
        parking: 5.00,
        other: 10.00,
        notes: 'Zusätzliche Reinigung aufgrund von Verschmutzung'
      }
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}