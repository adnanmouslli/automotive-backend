import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService, private readonly mailerService: MailerService) {}

  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  private readonly GERMAN_TIMEZONE = 'Europe/Berlin';
  private readonly GERMAN_LOCALE = 'de-DE';

  // الدالة الرئيسية لتوليد PDF مباشرة
  async generateOrderPdf(orderId: string): Promise<Buffer> {
    console.log(`📄 PDF-Generierung für Auftrag ${orderId} gestartet`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        clientAddress: true,
        billingAddress: true,
        pickupAddress: true,
        deliveryAddress: true,
        vehicleData: true,
        service: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        images: {
          orderBy: { createdAt: 'desc' }
        },
        driverSignature: true,
        customerSignature: true,
        expenses: true,
        damages: {
          orderBy: { createdAt: 'asc' }
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Auftrag ${orderId} nicht gefunden`);
    }

    try {
      const pdfBuffer = await this.generateDirectPdf(order);
      console.log(`✅ PDF generated successfully for order ${orderId}`);
      return pdfBuffer;
    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      throw new InternalServerErrorException('Failed to generate PDF');
    }
  }

  // دالة توليد HTML للمعاينة (تبقى كما هي)
  async generateOrderHtml(orderId: string): Promise<string> {
    console.log(`📄 HTML-Generierung für Auftrag ${orderId} gestartet`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        clientAddress: true,
        billingAddress: true,
        pickupAddress: true,
        deliveryAddress: true,
        vehicleData: true,
        service: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        images: {
          orderBy: { createdAt: 'desc' }
        },
        driverSignature: true,
        customerSignature: true,
        expenses: true,
        damages: {
          orderBy: { createdAt: 'asc' }
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Auftrag ${orderId} nicht gefunden`);
    }

    try {
      const htmlContent = await this.generateCompactOfficialReport(order);
      console.log(`✅ Compact Official HTML Report generated successfully for order ${orderId}`);
      return htmlContent;
    } catch (error) {
      console.error('❌ Error generating compact official HTML report:', error);
      throw new InternalServerErrorException('Failed to generate compact official HTML report');
    }
  }

  // دالة توليد PDF مباشرة باستخدام PDFKit
  private async generateDirectPdf(order: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40
          },
          info: {
            Title: `Fahrzeugübergabebericht Nr. ${order.orderNumber}`,
            Author: 'Fahrzeugübergabe-Service GmbH',
            Subject: 'Offizieller Fahrzeugübergabebericht',
            Creator: 'PDF Service v2.0',
            Producer: 'NestJS PDF Generator'
          }
        });

        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });
        doc.on('error', reject);

        // بناء المستند
        this.buildPdfDocument(doc, order);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // دالة بناء محتوى PDF
  private buildPdfDocument(doc: PDFKit.PDFDocument, order: any): void {
    const currentDate = this.formatGermanDateTime(new Date());
    const reportDate = this.formatGermanDate(new Date(order.createdAt));
    const documentReference = `FÜ-${order.orderNumber}-${new Date().getFullYear()}`;

    let currentY = 50; // متتبع الموضع العمودي

    // الصفحة الأولى
    currentY = this.addDocumentHeader(doc, order, documentReference, reportDate, currentY);
    currentY = this.addOrderInformation(doc, order, currentY);
    currentY = this.addPersonsAndVehicleInfo(doc, order, currentY);
    currentY = this.addLocationsInfo(doc, order, currentY);
    currentY = this.addEquipmentAndDamages(doc, order, currentY);
    currentY = this.addExpensesInfo(doc, order, currentY);
    
    // التحقق من المساحة المتبقية
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }
    
    this.addPageFooter(doc, 1, order);

    // الصفحة الثانية: التوقيعات والمعلومات القانونية
    doc.addPage();
    this.addSignaturesPage(doc, order, documentReference);

    // صفحات الصور (إن وجدت)
    if (order.images && order.images.length > 0) {
      this.addImagesPages(doc, order.images, documentReference);
    }
  }

  // رأس المستند
  private addDocumentHeader(doc: PDFKit.PDFDocument, order: any, documentReference: string, reportDate: string, startY: number): number {
    let currentY = startY;

    // شعار الشركة (إن وجد)
    const logoPath = this.findLogoFile();
    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 40, currentY, { width: 50, height: 50 });
      } catch (error) {
        console.warn('⚠️ خطأ في تحميل اللوغو:', error);
      }
    }

    // معلومات الشركة
    doc.fontSize(18)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('Fahrzeugübergabe-Service GmbH', 100, currentY + 10);

    doc.fontSize(10)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text('Professionelle Fahrzeuglogistik • Zertifiziert nach DIN EN ISO 9001:2015', 100, currentY + 30);

    // معلومات المستند
    doc.fontSize(10)
       .fillColor('#1f2937')
       .font('Helvetica-Bold')
       .text(`Nr. ${documentReference}`, 450, currentY + 10, { align: 'right' });

    doc.fontSize(9)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(reportDate, 450, currentY + 25, { align: 'right' });

    currentY += 70;

    // عنوان المستند
    doc.fontSize(20)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('FAHRZEUGÜBERGABEBERICHT', 40, currentY, { align: 'center', width: 515 });

    currentY += 30;

    // خط تحت العنوان
    doc.moveTo(40, currentY)
       .lineTo(555, currentY)
       .strokeColor('#2563eb')
       .lineWidth(2)
       .stroke();

    return currentY + 20; // إرجاع الموضع الجديد
  }

  // معلومات الطلب
  private addOrderInformation(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;

    // عنوان القسم
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('AUFTRAGSINFORMATIONEN', 40, currentY);

    currentY += 25;

    // شبكة المعلومات
    const infoItems = [
      { label: 'Auftragsnummer', value: this.sanitizeText(order.orderNumber), highlight: true },
      { label: 'Status', value: this.sanitizeText(this.translateStatus(order.status)) },
      { label: 'Servicetyp', value: this.sanitizeText(this.translateServiceType(order.service?.serviceType)) },
      { label: 'Fahrzeugtyp', value: this.sanitizeText(order.service?.vehicleType || 'Standard') }
    ];

    const colWidth = 125;
    const rowHeight = 40;

    infoItems.forEach((item, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const x = 40 + (col * colWidth);
      const y = currentY + (row * rowHeight);

      // إطار العنصر
      doc.rect(x, y, colWidth - 5, rowHeight - 5)
         .fillColor(item.highlight ? '#eff6ff' : '#f8fafc')
         .fill()
         .strokeColor('#e5e7eb')
         .stroke();

      // التسمية
      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica-Bold')
         .text(item.label.toUpperCase(), x + 5, y + 5);

      // القيمة
      doc.fontSize(10)
         .fillColor(item.highlight ? '#1e40af' : '#1f2937')
         .font(item.highlight ? 'Helvetica-Bold' : 'Helvetica')
         .text(item.value, x + 5, y + 18, { width: colWidth - 10, lineBreak: false });
    });

    currentY += 60; // المساحة المستخدمة للشبكة

    // الوصف (إن وجد)
    if (order.description && order.description.trim()) {
      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica-Bold')
         .text('BESCHREIBUNG', 40, currentY);

      currentY += 15;

      const cleanDescription = this.sanitizeText(order.description);
      doc.fontSize(10)
         .fillColor('#374151')
         .font('Helvetica')
         .text(cleanDescription, 40, currentY, { width: 515, lineBreak: true });

      // حساب ارتفاع النص
      const textHeight = Math.ceil(cleanDescription.length / 80) * 12; // تقدير تقريبي
      currentY += Math.max(textHeight, 20);
    }

    return currentY + 20; // هامش إضافي
  }

  // دالة تنظيف النصوص من الرموز الغريبة
  private sanitizeText(text: string | null | undefined): string {
    if (!text) return 'Nicht angegeben';
    
    // إزالة الرموز الغريبة والأحرف غير المرغوب فيها
    return text
      .toString()
      .replace(/[^\w\s\-.,!?äöüÄÖÜß()/@€°]/g, '') // الاحتفاظ بالأحرف الألمانية والرموز الأساسية فقط
      .replace(/\s+/g, ' ') // استبدال المسافات المتعددة بمسافة واحدة
      .trim() || 'Nicht verfügbar';
  }

  // معلومات الأشخاص والمركبة
  private addPersonsAndVehicleInfo(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;

    // معلومات العميل
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('KUNDE', 40, currentY);

    currentY += 20;
    currentY = this.addPersonDetails(doc, 40, currentY, {
      name: this.sanitizeText(order.client) || 'Nicht angegeben',
      phone: this.sanitizeText(order.clientPhone) || 'Nicht verfügbar',
      email: this.sanitizeText(order.clientEmail) || 'Nicht verfügbar',
      address: order.clientAddress
    });

    // معلومات السائق
    if (order.driver) {
      currentY += 20;
      doc.fontSize(12)
         .fillColor('#2563eb')
         .font('Helvetica-Bold')
         .text('FAHRER', 40, currentY);

      currentY += 20;
      currentY = this.addPersonDetails(doc, 40, currentY, {
        name: this.sanitizeText(order.driver.name),
        phone: this.sanitizeText(order.driver.phone) || 'Nicht verfügbar',
        email: this.sanitizeText(order.driver.email) || 'Nicht verfügbar'
      });
    }

    // معلومات المركبة (في نفس الارتفاع مع معلومات العميل)
    const vehicleStartY = startY;
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('FAHRZEUGDATEN', 300, vehicleStartY);

    this.addVehicleInfo(doc, 300, vehicleStartY + 25, order.vehicleData);

    return Math.max(currentY, vehicleStartY + 150) + 20; // إرجاع أقل موضع من القسمين
  }

  // تفاصيل الشخص
  private addPersonDetails(doc: PDFKit.PDFDocument, x: number, y: number, person: any): number {
    const details = [
      { label: 'Name:', value: this.sanitizeText(person.name) },
      { label: 'Telefon:', value: this.sanitizeText(person.phone) },
      { label: 'E-Mail:', value: this.sanitizeText(person.email) }
    ];

    let currentY = y;

    details.forEach((detail, index) => {
      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica-Bold')
         .text(detail.label, x, currentY);

      doc.fontSize(10)
         .fillColor('#1f2937')
         .font('Helvetica')
         .text(detail.value, x + 50, currentY, { width: 200, lineBreak: false });
      
      currentY += 15;
    });

    if (person.address) {
      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica-Bold')
         .text('Adresse:', x, currentY);

      const formattedAddress = this.formatCompactAddress(person.address);
      doc.fontSize(10)
         .fillColor('#1f2937')
         .font('Helvetica')
         .text(formattedAddress, x + 50, currentY, { width: 200, lineBreak: true });
      
      // حساب ارتفاع العنوان
      const addressLines = Math.ceil(formattedAddress.length / 30);
      currentY += Math.max(addressLines * 12, 20);
    }

    return currentY;
  }

  // معلومات المركبة
  private addVehicleInfo(doc: PDFKit.PDFDocument, x: number, y: number, vehicleData: any): void {
    let currentY = y;

    // رقم اللوحة
    if (vehicleData?.licensePlateNumber) {
      doc.rect(x, currentY, 200, 25)
         .fillColor('#dbeafe')
         .fill()
         .strokeColor('#3b82f6')
         .lineWidth(2)
         .stroke();

      doc.fontSize(8)
         .fillColor('#1e40af')
         .font('Helvetica-Bold')
         .text('KENNZEICHEN', x + 5, currentY + 3);

      doc.fontSize(12)
         .fillColor('#1e40af')
         .font('Helvetica-Bold')
         .text(this.sanitizeText(vehicleData.licensePlateNumber), x + 5, currentY + 15);

      currentY += 35;
    }

    // تفاصيل المركبة
    const vehicleDetails = [
      { label: 'Halter', value: this.sanitizeText(vehicleData?.vehicleOwner) || 'Nicht angegeben' },
      { label: 'Marke', value: this.sanitizeText(vehicleData?.brand) || 'Nicht angegeben' },
      { label: 'Modell', value: this.sanitizeText(vehicleData?.model) || 'Nicht angegeben' },
      { label: 'Jahr', value: this.sanitizeText(vehicleData?.year) || 'Nicht angegeben' },
      { label: 'Farbe', value: this.sanitizeText(vehicleData?.color) || 'Nicht angegeben' },
      { label: 'FIN/VIN', value: this.sanitizeText(vehicleData?.vin || vehicleData?.fin) || 'Nicht angegeben' }
    ];

    vehicleDetails.forEach((detail, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const detailX = x + (col * 100);
      const detailY = currentY + (row * 25);

      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica-Bold')
         .text(detail.label + ':', detailX, detailY);

      doc.fontSize(9)
         .fillColor('#1f2937')
         .font('Helvetica')
         .text(detail.value, detailX, detailY + 10, { width: 95, lineBreak: false });
    });
  }

  // معلومات المواقع
  private addLocationsInfo(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;

    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('STANDORTE', 40, currentY);

    currentY += 25;

    // موقع الاستلام
    doc.fontSize(10)
       .fillColor('#f59e0b')
       .font('Helvetica-Bold')
       .text('ABHOLUNG', 40, currentY);

    if (order.pickupAddress) {
      const pickupAddress = this.formatCompactAddress(order.pickupAddress);
      doc.fontSize(10)
         .fillColor('#1f2937')
         .font('Helvetica')
         .text(pickupAddress, 40, currentY + 15, { width: 230, lineBreak: true });
    } else {
      doc.fontSize(9)
         .fillColor('#9ca3af')
         .font('Helvetica-Oblique')
         .text('Keine Adresse verfügbar', 40, currentY + 15);
    }

    // موقع التسليم
    doc.fontSize(10)
       .fillColor('#10b981')
       .font('Helvetica-Bold')
       .text('LIEFERUNG', 300, currentY);

    if (order.deliveryAddress) {
      const deliveryAddress = this.formatCompactAddress(order.deliveryAddress);
      doc.fontSize(10)
         .fillColor('#1f2937')
         .font('Helvetica')
         .text(deliveryAddress, 300, currentY + 15, { width: 230, lineBreak: true });
    } else {
      doc.fontSize(9)
         .fillColor('#9ca3af')
         .font('Helvetica-Oblique')
         .text('Keine Adresse verfügbar', 300, currentY + 15);
    }

    return currentY + 60; // المساحة المستخدمة للمواقع
  }
      

  // معلومات المعدات والأضرار
  private addEquipmentAndDamages(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;

    // المعدات
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('AUSSTATTUNG', 40, currentY);

    currentY += 20;
    if (order.items && order.items.length > 0) {
      order.items.slice(0, 5).forEach((item, index) => {
        const itemInfo = this.getVehicleItemInfo(item);
        doc.fontSize(9)
           .fillColor('#10b981')
           .font('Helvetica')
           .text(`✓ ${this.sanitizeText(itemInfo.name)}`, 40, currentY + (index * 12));
      });
      currentY += order.items.slice(0, 5).length * 12;
    } else {
      doc.fontSize(9)
         .fillColor('#9ca3af')
         .font('Helvetica-Oblique')
         .text('Keine spezielle Ausstattung dokumentiert', 40, currentY);
      currentY += 12;
    }

    // الأضرار (في نفس الارتفاع)
    const damageStartY = startY;
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('SCHÄDEN', 300, damageStartY);

    let damageY = damageStartY + 20;
    if (order.damages && order.damages.length > 0) {
      order.damages.slice(0, 5).forEach((damage, index) => {
        const damageText = `⚠ ${this.getDamageTypeText(damage.type)} - ${this.getVehicleSideText(damage.side)}`;
        doc.fontSize(9)
           .fillColor('#ef4444')
           .font('Helvetica')
           .text(this.sanitizeText(damageText), 300, damageY + (index * 12), { width: 200, lineBreak: true });
      });
      damageY += order.damages.slice(0, 5).length * 12;
    } else {
      doc.fontSize(9)
         .fillColor('#10b981')
         .font('Helvetica')
         .text('✓ Keine Schäden dokumentiert', 300, damageY);
      damageY += 12;
    }

    return Math.max(currentY, damageY) + 20;
  }

  // معلومات المصاريف
  private addExpensesInfo(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    if (!order.expenses) return startY + 20;

    let currentY = startY;

    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('KOSTENAUFSTELLUNG', 40, currentY);

    currentY += 20;

    const expenseItems = [
      { key: 'fuel', label: 'Kraftstoff', value: order.expenses.fuel || 0 },
      { key: 'wash', label: 'Fahrzeugwäsche', value: order.expenses.wash || 0 },
      { key: 'adBlue', label: 'AdBlue', value: order.expenses.adBlue || 0 },
      { key: 'tollFees', label: 'Mautgebühren', value: order.expenses.tollFees || 0 },
      { key: 'parking', label: 'Parkgebühren', value: order.expenses.parking || 0 },
      { key: 'other', label: 'Sonstige Kosten', value: order.expenses.other || 0 }
    ];

    const validExpenses = expenseItems.filter(item => item.value > 0);

    if (validExpenses.length > 0) {
      const subtotal = validExpenses.reduce((sum, item) => sum + item.value, 0);
      const mwst = subtotal * 0.19;
      const total = subtotal + mwst;

      validExpenses.forEach((item, index) => {
        doc.fontSize(9)
           .fillColor('#374151')
           .font('Helvetica')
           .text(`${this.sanitizeText(item.label)}:`, 40, currentY + (index * 12));

        doc.fontSize(9)
           .fillColor('#374151')
           .font('Helvetica')
           .text(`${item.value.toFixed(2)} €`, 200, currentY + (index * 12));
      });

      currentY += validExpenses.length * 12 + 10;

      doc.fontSize(10)
         .fillColor('#1f2937')
         .font('Helvetica-Bold')
         .text(`Gesamtbetrag (brutto): ${total.toFixed(2)} €`, 40, currentY);

      currentY += 15;
    } else {
      doc.fontSize(9)
         .fillColor('#9ca3af')
         .font('Helvetica-Oblique')
         .text('Keine zusätzlichen Kosten angefallen', 40, currentY);
      currentY += 12;
    }

    return currentY + 20;
  }

  // تذييل الصفحة
  private addPageFooter(doc: PDFKit.PDFDocument, pageNumber: number, order: any): void {
    const footerY = 750;

    // خط فاصل
    doc.moveTo(40, footerY)
       .lineTo(555, footerY)
       .strokeColor('#e5e7eb')
       .lineWidth(1)
       .stroke();

    // معلومات التذييل
    doc.fontSize(8)
       .fillColor('#374151')
       .font('Helvetica-Bold')
       .text('Fahrzeugübergabe-Service GmbH', 40, footerY + 10);

    doc.fontSize(8)
       .fillColor('#374151')
       .font('Helvetica')
       .text(`Dokument erstellt: ${this.formatGermanDateTime(new Date())}`, 40, footerY + 22);

    // رقم الصفحة
    const totalPages = order.images ? Math.ceil(order.images.length / 4) + 2 : 2;
    doc.fontSize(8)
       .fillColor('#374151')
       .font('Helvetica')
       .text(`Seite ${pageNumber} von ${totalPages}`, 500, footerY + 10, { align: 'right' });
  }

  // صفحة التوقيعات
  private addSignaturesPage(doc: PDFKit.PDFDocument, order: any, documentReference: string): void {
    let currentY = 50;

    // رأس مبسط
    doc.fontSize(10)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('Fahrzeugübergabebericht', 40, currentY);

    doc.fontSize(8)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text(this.sanitizeText(documentReference), 40, currentY + 15);

    doc.fontSize(8)
       .fillColor('#6b7280')
       .font('Helvetica')
       .text('Seite 2', 500, currentY, { align: 'right' });

    currentY += 60;

    // التوقيعات
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('UNTERSCHRIFTEN & BESTÄTIGUNG', 40, currentY);

    currentY += 40;

    // إطار توقيع السائق
    doc.rect(40, currentY, 230, 80)
       .strokeColor('#e5e7eb')
       .stroke();

    doc.fontSize(10)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('FAHRER / DIENSTLEISTER', 50, currentY + 10);

    // منطقة التوقيع
    doc.rect(50, currentY + 25, 210, 30)
       .strokeColor('#d1d5db')
       .dash(2, { space: 2 })
       .stroke()
       .undash();

    if (order.driverSignature) {
      // محاولة إضافة التوقيع
      try {
        const signPath = path.join(process.cwd(), order.driverSignature.signUrl);
        if (fs.existsSync(signPath)) {
          doc.image(signPath, 55, currentY + 28, { width: 200, height: 24 });
        }
      } catch (error) {
        doc.fontSize(8)
           .fillColor('#9ca3af')
           .font('Helvetica-Oblique')
           .text('Unterschrift nicht verfügbar', 55, currentY + 35);
      }

      doc.fontSize(8)
         .fillColor('#374151')
         .font('Helvetica')
         .text(this.sanitizeText(order.driverSignature.name) || 'Nicht angegeben', 50, currentY + 60);

      doc.fontSize(7)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text(this.formatGermanDateTime(new Date(order.driverSignature.signedAt)), 50, currentY + 70);
    } else {
      doc.fontSize(8)
         .fillColor('#dc2626')
         .font('Helvetica-Oblique')
         .text('Unterschrift ausstehend', 55, currentY + 35);
    }

    // إطار توقيع العميل
    doc.rect(300, currentY, 230, 80)
       .strokeColor('#e5e7eb')
       .stroke();

    doc.fontSize(10)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('KUNDE / AUFTRAGGEBER', 310, currentY + 10);

    // منطقة التوقيع
    doc.rect(310, currentY + 25, 210, 30)
       .strokeColor('#d1d5db')
       .dash(2, { space: 2 })
       .stroke()
       .undash();

    if (order.customerSignature) {
      try {
        const signPath = path.join(process.cwd(), order.customerSignature.signUrl);
        if (fs.existsSync(signPath)) {
          doc.image(signPath, 315, currentY + 28, { width: 200, height: 24 });
        }
      } catch (error) {
        doc.fontSize(8)
           .fillColor('#9ca3af')
           .font('Helvetica-Oblique')
           .text('Unterschrift nicht verfügbar', 315, currentY + 35);
      }

      doc.fontSize(8)
         .fillColor('#374151')
         .font('Helvetica')
         .text(this.sanitizeText(order.customerSignature.name) || 'Nicht angegeben', 310, currentY + 60);

      doc.fontSize(7)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text(this.formatGermanDateTime(new Date(order.customerSignature.signedAt)), 310, currentY + 70);
    } else {
      doc.fontSize(8)
         .fillColor('#dc2626')
         .font('Helvetica-Oblique')
         .text('Unterschrift ausstehend', 315, currentY + 35);
    }

    currentY += 120;

    // تأكيد الاتفاق
    doc.rect(40, currentY, 515, 40)
       .fillColor('#eff6ff')
       .fill()
       .strokeColor('#3b82f6')
       .stroke();

    doc.fontSize(8)
       .fillColor('#1e40af')
       .font('Helvetica-Bold')
       .text('BESTÄTIGUNG:', 50, currentY + 10);

    doc.fontSize(8)
       .fillColor('#1e40af')
       .font('Helvetica')
       .text('Beide Vertragsparteien bestätigen die Richtigkeit der dokumentierten Informationen und den ordnungsgemäßen Zustand der Übergabe.', 
              50, currentY + 22, { width: 495, lineBreak: true });

    currentY += 80;

    // المعلومات القانونية
    doc.fontSize(12)
       .fillColor('#2563eb')
       .font('Helvetica-Bold')
       .text('RECHTLICHE HINWEISE', 40, currentY);

    const legalTexts = [
      {
        title: 'Dokumentengültigkeit',
        text: 'Dieses Dokument wurde automatisch generiert und entspricht den deutschen Standards gemäß § 126a BGB. Die elektronische Form ist rechtsgültig.'
      },
      {
        title: 'Datenschutz', 
        text: 'Die Verarbeitung aller Daten erfolgt DSGVO-konform. Aufbewahrung gemäß gesetzlicher Aufbewahrungsfristen für Geschäftsunterlagen.'
      },
      {
        title: 'Verbindlichkeit',
        text: 'Beide Vertragsparteien erkennen diesen Bericht als verbindliche Dokumentation des Fahrzeugzustands zum Zeitpunkt der Übergabe an.'
      }
    ];

    currentY += 25;

    legalTexts.forEach((legal, index) => {
      const boxY = currentY + (index * 60);
      
      doc.rect(40, boxY, 515, 50)
         .fillColor('#f0f9ff')
         .fill()
         .strokeColor('#0ea5e9')
         .stroke();

      doc.fontSize(9)
         .fillColor('#0c4a6e')
         .font('Helvetica-Bold')
         .text(legal.title.toUpperCase(), 50, boxY + 10);

      doc.fontSize(8)
         .fillColor('#0c4a6e')
         .font('Helvetica')
         .text(legal.text, 50, boxY + 25, { width: 495, lineBreak: true });
    });

    currentY += 200;

    // تذييل قانوني
    doc.rect(40, currentY, 515, 40)
       .fillColor('#1e40af')
       .fill();

    doc.fontSize(8)
       .fillColor('white')
       .font('Helvetica-Bold')
       .text('ZERTIFIZIERTE DOKUMENTATION', 50, currentY + 10);

    doc.fontSize(7)
       .fillColor('white')
       .font('Helvetica')
       .text('Erstellt nach DIN EN ISO 9001:2015 Standards', 50, currentY + 22);

    doc.fontSize(8)
       .fillColor('white')
       .font('Helvetica')
       .text(`Dokumentenerstellung: ${this.formatGermanDateTime(new Date())}`, 350, currentY + 10, { align: 'right' });

    doc.fontSize(7)
       .fillColor('white')
       .font('Helvetica')
       .text(`Version: 1.0 • Status: ${this.translateStatus(order.status)}`, 350, currentY + 22, { align: 'right' });
  }

  // صفحات الصور
  private addImagesPages(doc: PDFKit.PDFDocument, images: any[], documentReference: string): void {
    const imagesPerPage = 4;
    const totalImagePages = Math.ceil(images.length / imagesPerPage);

    for (let pageIndex = 0; pageIndex < totalImagePages; pageIndex++) {
      doc.addPage();
      
      const startIndex = pageIndex * imagesPerPage;
      const endIndex = Math.min(startIndex + imagesPerPage, images.length);
      const pageImages = images.slice(startIndex, endIndex);
      const currentPageNumber = pageIndex + 3;
      const totalPages = 2 + totalImagePages;

      // رأس صفحة الصور
      doc.fontSize(10)
         .fillColor('#2563eb')
         .font('Helvetica-Bold')
         .text('Fotografische Dokumentation', 40, 40);

      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text(documentReference, 40, 55);

      doc.fontSize(8)
         .fillColor('#6b7280')
         .font('Helvetica')
         .text(`Seite ${currentPageNumber} von ${totalPages}`, 500, 40, { align: 'right' });

      // عنوان الصفحة
      doc.rect(40, 80, 515, 30)
         .fillColor('#eff6ff')
         .fill()
         .strokeColor('#3b82f6')
         .stroke();

      doc.fontSize(12)
         .fillColor('#1e40af')
         .font('Helvetica-Bold')
         .text(`DOKUMENTATION - SEITE ${pageIndex + 1}`, 50, 90);

      doc.fontSize(9)
         .fillColor('#1e40af')
         .font('Helvetica')
         .text(`Bilder ${startIndex + 1} bis ${endIndex} von ${images.length}`, 50, 102);

      // شبكة الصور (2x2)
      const imageWidth = 240;
      const imageHeight = 180;
      const imageSpacing = 15;
      let imageY = 130;

      for (let i = 0; i < pageImages.length; i++) {
        const image = pageImages[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const imageX = 40 + (col * (imageWidth + imageSpacing));
        const currentImageY = imageY + (row * (imageHeight + 60));
        const globalImageNumber = startIndex + i + 1;

        // إطار الصورة
        doc.rect(imageX, currentImageY, imageWidth, imageHeight + 40)
           .strokeColor('#e5e7eb')
           .stroke();

        // رأس الصورة
        doc.rect(imageX, currentImageY, imageWidth, 25)
           .fillColor('#2563eb')
           .fill();

        doc.fontSize(9)
           .fillColor('white')
           .font('Helvetica-Bold')
           .text(`BILD ${globalImageNumber}`, imageX + 10, currentImageY + 8);

        doc.fontSize(7)
           .fillColor('white')
           .font('Helvetica')
           .text(this.formatGermanDateTime(new Date(image.createdAt)), imageX + 150, currentImageY + 8, { align: 'right' });

        // منطقة الصورة
        const imageContentY = currentImageY + 25;
        doc.rect(imageX + 5, imageContentY + 5, imageWidth - 10, imageHeight - 35)
           .fillColor('#f9fafb')
           .fill()
           .strokeColor('#d1d5db')
           .dash(2, { space: 2 })
           .stroke()
           .undash();

        // محاولة إضافة الصورة
        try {
          const imagePath = this.getImagePath(image.imageUrl);
          if (imagePath && fs.existsSync(imagePath)) {
            doc.image(imagePath, imageX + 10, imageContentY + 10, { 
              width: imageWidth - 20, 
              height: imageHeight - 45,
              fit: [imageWidth - 20, imageHeight - 45]
            });
          } else {
            // placeholder للصورة المفقودة
            doc.fontSize(16)
               .fillColor('#6b7280')
               .font('Helvetica-Bold')
               .text('BILD', imageX + (imageWidth/2) - 20, imageContentY + (imageHeight/2) - 20);

            doc.fontSize(9)
               .fillColor('#9ca3af')
               .font('Helvetica')
               .text('Nicht verfügbar', imageX + (imageWidth/2) - 35, imageContentY + (imageHeight/2));
          }
        } catch (error) {
          console.warn(`⚠️ خطأ في تحميل الصورة ${image.imageUrl}:`, error);
          
          doc.fontSize(12)
             .fillColor('#dc2626')
             .font('Helvetica-Bold')
             .text('❌', imageX + (imageWidth/2) - 10, imageContentY + (imageHeight/2) - 15);

          doc.fontSize(8)
             .fillColor('#dc2626')
             .font('Helvetica')
             .text('Ladefehler', imageX + (imageWidth/2) - 25, imageContentY + (imageHeight/2));
        }

        // وصف الصورة
        doc.rect(imageX, currentImageY + imageHeight - 15, imageWidth, 15)
           .fillColor('#f8fafc')
           .fill()
           .strokeColor('#e5e7eb')
           .stroke();

        doc.fontSize(8)
           .fillColor('#374151')
           .font('Helvetica')
           .text(image.description || `Fahrzeugdokumentation ${globalImageNumber}`, 
                  imageX + 5, currentImageY + imageHeight - 10, 
                  { width: imageWidth - 10, align: 'center' });
      }

      // تذييل صفحة الصور
      const footerY = 720;
      doc.rect(40, footerY, 515, 30)
         .fillColor('#f0f9ff')
         .fill()
         .strokeColor('#0ea5e9')
         .stroke();

      doc.fontSize(8)
         .fillColor('#0c4a6e')
         .font('Helvetica-Oblique')
         .text('Alle Bilder wurden zum Zeitpunkt der Fahrzeugübergabe aufgenommen und sind Bestandteil der offiziellen Dokumentation.', 
                50, footerY + 10, { width: 495, align: 'center' });
    }
  }

  // دالة الحصول على مسار الصورة
  private getImagePath(imageUrl: string): string | null {
    try {
      const filename = path.basename(imageUrl);
      return path.join(this.uploadsDir, 'images', filename);
    } catch (error) {
      console.warn('⚠️ خطأ في تحديد مسار الصورة:', error);
      return null;
    }
  }

  // دالة HTML القديمة (تبقى كما هي للتوافق مع الفرونت إند)
  private async generateCompactOfficialReport(order: any): Promise<string> {
    const currentDate = this.formatGermanDateTime(new Date());
    const reportDate = this.formatGermanDate(new Date(order.createdAt));
    const logoBase64 = await this.getLogoAsBase64();
    
    const documentReference = `FÜ-${order.orderNumber}-${new Date().getFullYear()}`;
    
    // تجهيز الصور للصفحات الإضافية
    const images = order.images || [];
    const imagesPerPage = 4; // 4 صور لكل صفحة
    const imagePagesCount = Math.ceil(images.length / imagesPerPage);
    
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fahrzeugübergabebericht Nr. ${order.orderNumber}</title>
    <style>
        ${this.getProfessionalPrintStyles()}
    </style>
</head>
<body>
   

    <!-- الصفحة الأولى: المعلومات الأساسية -->
    <div class="page page-main">
        <!-- رأس المستند -->
        <header class="document-header">
            <div class="header-container">
                <div class="company-section">
                    ${logoBase64 ? 
                      `<img src="data:image/png;base64,${logoBase64}" alt="Logo" class="company-logo">` : 
                      '<div class="company-logo-placeholder">LOGO</div>'
                    }
                    <div class="company-info">
                        <h1 class="company-name">Fahrzeugübergabe-Service GmbH</h1>
                        <p class="company-subtitle">Professionelle Fahrzeuglogistik • Zertifiziert nach DIN EN ISO 9001:2015</p>
                    </div>
                </div>
                <div class="document-info">
                    <div class="doc-number">Nr. ${documentReference}</div>
                    <div class="doc-date">${reportDate}</div>
                </div>
            </div>
            <div class="document-title">
                <h1>FAHRZEUGÜBERGABEBERICHT</h1>
                <div class="title-underline"></div>
            </div>
        </header>

        <!-- باقي محتوى HTML كما هو -->
        ${this.generateRestOfHtmlContent(order, images, imagePagesCount, currentDate, documentReference)}
    </div>
</body>
</html>`;
  }

  // باقي الدوال المساعدة تبقى كما هي
  private generateRestOfHtmlContent(order: any, images: any[], imagePagesCount: number, currentDate: string, documentReference: string): string {
    // هذه الدالة تحتوي على باقي محتوى HTML
    // يمكنك نسخ المحتوى من الكود الأصلي هنا
    return `<!-- باقي محتوى HTML -->`;
  }

  // دالة توليد PDF وتحميله مباشرة
  async generateAndDownloadOrderPdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    const pdfBuffer = await this.generateOrderPdf(orderId);
    const filename = `fahrzeuguebergabe-${orderId}-${this.formatDateForFilename(new Date())}.pdf`;
    
    return {
      buffer: pdfBuffer,
      filename
    };
  }

  // دالة إرسال PDF بالبريد الإلكتروني
  async sendOrderPdfByEmail(orderId: string, recipientEmail: string) {
    try {
      const pdfBuffer = await this.generateOrderPdf(orderId);
      const filename = `fahrzeuguebergabe-${orderId}-${this.formatDateForFilename(new Date())}.pdf`;
      
      // حفظ الملف مؤقتاً لإرساله كمرفق
      const tempFilePath = path.join(this.uploadsDir, 'temp', filename);
      await this.ensureDirectoryExists(path.dirname(tempFilePath));
      fs.writeFileSync(tempFilePath, pdfBuffer);
      
      await this.sendPdfReport(recipientEmail, tempFilePath, filename);
      
      // حذف الملف المؤقت بعد الإرسال
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      console.log(`📧 PDF per E-Mail gesendet an ${recipientEmail}`);
    } catch (error) {
      console.error('❌ Fehler beim Senden der PDF per E-Mail:', error);
      throw new InternalServerErrorException('PDF-E-Mail konnte nicht gesendet werden');
    }
  }

  // دالة إرسال PDF بالبريد الإلكتروني
  async sendPdfReport(email: string, filePath: string, filename: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Fahrzeugübergabebericht - Ihr Auftrag (PDF)',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">📄 Fahrzeugübergabebericht</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Ihr vollständiger Übergabebericht als PDF</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #2c3e50; margin-top: 0;">Guten Tag,</h2>
            
            <p style="line-height: 1.6; color: #34495e;">
              anbei erhalten Sie Ihren vollständigen Fahrzeugübergabebericht als PDF-Dokument. 
              Das PDF können Sie direkt öffnen, ausdrucken oder archivieren.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <p style="margin: 0; color: #2980b9; font-weight: bold;">
                📄 Dateiname: ${filename}
              </p>
              <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px;">
                Erstellt am: ${this.formatGermanDateTime(new Date())}
              </p>
              <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px;">
                💡 Das PDF ist bereit zum Drucken und Archivieren
              </p>
            </div>
            
            <p style="line-height: 1.6; color: #34495e;">
              Bei Fragen stehen wir Ihnen gerne zur Verfügung.
            </p>
            
            <p style="line-height: 1.6; color: #34495e;">
              Mit freundlichen Grüßen<br>
              Ihr Fahrzeugübergabe-Team
            </p>
          </div>
          
          <div style="background: #2c3e50; padding: 20px; text-align: center; color: #bdc3c7; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} Fahrzeugübergabe-Managementsystem</p>
            <p style="margin: 5px 0 0 0;">PDF automatisch generiert am ${this.formatGermanDateTime(new Date())}</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename,
          path: filePath,
          contentType: 'application/pdf'
        }
      ],
    });
  }

  // الدوال المساعدة الموجودة أصلاً
  private async ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private async getLogoAsBase64(): Promise<string | null> {
    try {
      const logoPath = this.findLogoFile();
      if (logoPath && fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        return logoBuffer.toString('base64');
      }
    } catch (error) {
      console.warn('⚠️ خطأ في تحميل اللوغو:', error);
    }
    return null;
  }

  private findLogoFile(): string | null {
    const logoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
    const logoNames = ['logo', 'company-logo', 'brand-logo'];
    
    for (const name of logoNames) {
      for (const ext of logoExtensions) {
        const logoPath = path.join(this.uploadsDir, `${name}.${ext}`);
        if (fs.existsSync(logoPath)) {
          return logoPath;
        }
      }
    }
    
    const logosDir = path.join(this.uploadsDir, 'logos');
    if (fs.existsSync(logosDir)) {
      for (const name of logoNames) {
        for (const ext of logoExtensions) {
          const logoPath = path.join(logosDir, `${name}.${ext}`);
          if (fs.existsSync(logoPath)) {
            return logoPath;
          }
        }
      }
    }
    
    return null;
  }

  private getDamageTypeText(type: string): string {
    const typeTexts = {
      'DENT_BUMP': 'Delle/Beule',
      'STONE_CHIP': 'Steinschlag',
      'SCRATCH_GRAZE': 'Kratzer/Schramme',
      'PAINT_DAMAGE': 'Lackschaden',
      'CRACK_BREAK': 'Riss/Bruch',
      'MISSING': 'Fehlend'
    };
    return typeTexts[type] || type;
  }

  private getVehicleSideText(side: string): string {
    const sideTexts = {
      'FRONT': 'Vorderseite',
      'REAR': 'Rückseite', 
      'LEFT': 'Linke Seite',
      'RIGHT': 'Rechte Seite',
      'TOP': 'Dach/Oberseite'
    };
    return sideTexts[side] || side;
  }

  private getVehicleItemInfo(item: string): { name: string; icon: string; available: boolean } {
    const itemsMap = {
      'PARTITION_NET': { name: 'Trennnetz', icon: '🕸️', available: true },
      'WINTER_TIRES': { name: 'Winterreifen', icon: '❄️', available: true },
      'SUMMER_TIRES': { name: 'Sommerreifen', icon: '☀️', available: true },
      'HUBCAPS': { name: 'Radkappen', icon: '⭕', available: true },
      'ALLOY_WHEELS': { name: 'Alufelgen', icon: '🛞', available: true },
      'REAR_PARCEL_SHELF': { name: 'Hutablage', icon: '📦', available: true },
      'NAVIGATION_SYSTEM': { name: 'Navigationssystem', icon: '🗺️', available: true },
      'TRUNK_ROLL_COVER': { name: 'Kofferraumrollo', icon: '🎭', available: true },
      'SAFETY_VEST': { name: 'Warnweste', icon: '🦺', available: true },
      'VEHICLE_KEYS': { name: 'Fahrzeugschlüssel', icon: '🗝️', available: true },
      'WARNING_TRIANGLE': { name: 'Warndreieck', icon: '🔺', available: true },
      'RADIO': { name: 'Radio', icon: '📻', available: true },
      'OPERATING_MANUAL': { name: 'Bedienungsanleitung', icon: '📖', available: true },
      'REGISTRATION_DOCUMENT': { name: 'Fahrzeugschein', icon: '📄', available: true },
      'COMPRESSOR_REPAIR_KIT': { name: 'Kompressor-Reparaturset', icon: '🛠️', available: true },
      'TOOLS_JACK': { name: 'Werkzeug & Wagenheber', icon: '🔧', available: true },
      'SECOND_SET_OF_TIRES': { name: 'Zweiter Reifensatz', icon: '🛞', available: true },
      'EMERGENCY_WHEEL': { name: 'Notrad', icon: '🆘', available: true },
      'SPARE_TIRE': { name: 'Ersatzreifen', icon: '🛞', available: true },
      'ANTENNA': { name: 'Antenne', icon: '📡', available: true },
      'FUEL_CARD': { name: 'Tankkarte', icon: '💳', available: true },
      'FIRST_AID_KIT': { name: 'Erste-Hilfe-Kasten', icon: '🩹', available: true },
      'SERVICE_BOOK': { name: 'Serviceheft', icon: '📓', available: true }
    };

    return itemsMap[item] || { name: item, icon: '❓', available: true };
  }

  private formatCompactAddress(address: any): string {
    if (!address) return 'Keine Adresse verfügbar';
    
    const parts = [
      this.sanitizeText(address.street),
      this.sanitizeText(address.houseNumber),
      `${this.sanitizeText(address.zipCode)} ${this.sanitizeText(address.city)}`,
      this.sanitizeText(address.country)
    ].filter(part => part && part !== 'Nicht angegeben');
    
    return parts.length > 0 ? parts.join(', ') : 'Keine Adresse verfügbar';
  }

  private translateStatus(status: string): string {
    const germanStatusMap = {
      'pending': 'Ausstehend',
      'in_progress': 'In Bearbeitung',
      'completed': 'Abgeschlossen',
      'cancelled': 'Storniert',
      'on_hold': 'Pausiert',
      'ready_for_pickup': 'Abholbereit',
      'in_transit': 'Unterwegs',
      'delivered': 'Ausgeliefert'
    };
    return germanStatusMap[status?.toLowerCase()] || status;
  }

  private translateServiceType(serviceType: string): string {
    const germanServiceMap = {
      'TRANSPORT': 'Fahrzeugtransport',
      'WASH': 'Fahrzeugwäsche',
      'REGISTRATION': 'Fahrzeugzulassung',
      'INSPECTION': 'Fahrzeuginspektion',
      'MAINTENANCE': 'Wartung & Service',
      'REPAIR': 'Reparatur',
      'DELIVERY': 'Auslieferung',
      'PICKUP': 'Abholung',
      'FULL_SERVICE': 'Komplettservice'
    };
    return germanServiceMap[serviceType] || serviceType;
  }

  private formatGermanDate(date: Date): string {
    return new Intl.DateTimeFormat(this.GERMAN_LOCALE, {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      timeZone: this.GERMAN_TIMEZONE
    }).format(date);
  }

  private formatGermanDateTime(date: Date): string {
    return new Intl.DateTimeFormat(this.GERMAN_LOCALE, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: this.GERMAN_TIMEZONE,
      timeZoneName: 'short'
    }).format(date);
  }

  private formatDateForFilename(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: this.GERMAN_TIMEZONE
    }).format(date).replace(/\./g, '-');
  }

  // CSS للطباعة (تبقى كما هي)
  private getProfessionalPrintStyles(): string {
    // يمكنك نسخ CSS من الكود الأصلي هنا
    return `/* CSS styles here */`;
  }
}