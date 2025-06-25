import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService , private readonly mailerService: MailerService) {}

    private readonly uploadsDir = path.join(process.cwd(), 'uploads'); // المسار إلى مجلد uploads


  async sendOrderPdfByEmail(orderId: string, recipientEmail: string) {
    try {
      const pdfBuffer = await this.generateOrderPdf(orderId); // 1. توليد الـ PDF
      const filename = `order-${orderId}.pdf`;               // 2. اسم الملف
      await this.sendPdfReport(recipientEmail, pdfBuffer, filename); // 3. إرسال الإيميل
      console.log(`📧 Email sent to ${recipientEmail} with PDF attached`);
    } catch (error) {
      console.error('❌ Failed to send order PDF by email:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }


  async sendPdfReport(email: string, pdfBuffer: Buffer, filename: string) {
    await this.mailerService.sendMail({
      to: "adnanmouslli7@gmail.com",
      subject: 'Fahrzeugübergabebericht',
      text: 'يرجى العثور على التقرير في المرفق.',
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ],
    });
  }


async generateOrderPdf(orderId: string): Promise<Buffer> {
    console.log(`📄 Generating PDF for order ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        driver: true,
        images: true,
        signatures: true,
        expenses: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        bufferPages: true,
        lang: 'de',
        displayTitle: true,
        pdfVersion: '1.5'
      });
      
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.generatePdfContent(doc, order);
        doc.end();
      } catch (error) {
        console.error('❌ Error generating PDF:', error);
        reject(error);
      }
    });
  }

  private generatePdfContent(doc: PDFKit.PDFDocument, order: any) {
    // Cover page
    this.addCoverPage(doc, order);
    
    // Table of contents
    this.addTableOfContents(doc);
    
    // Order details
    this.addOrderDetails(doc, order);
    
    // Vehicle information
    this.addVehicleDetails(doc, order);
    
    // Addresses
    this.addAddresses(doc, order);
    
    // Images
    this.addImages(doc, order);
    
    // Signatures
    this.addSignatures(doc, order);
    
    // Expenses
    this.addExpenses(doc, order);
    
    // Comments
    this.addComments(doc, order);
    
    // Footer
    this.addFooter(doc);
  }

  private addCoverPage(doc: PDFKit.PDFDocument, order: any) {
    // Page background
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fill('#f8f9fa');
    
    // Company logo
    const logoPath = path.join(this.uploadsDir, 'logo.jpg');
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, doc.page.width/2 - 200, 80, { width: 150 });
    } else {
      console.warn('⚠️ Logo file not found:', logoPath);
      doc.fontSize(24)
         .text('Company Logo', doc.page.width/2 - 75, 100, { align: 'center' });
    }

    // Report title
    doc.fontSize(28)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Fahrzeugübergabebericht', doc.page.width/2, 200, { align: 'center' });
    
    // Order details
    doc.fontSize(18)
       .font('Helvetica')
       .fill('#7f8c8d')
       .text(`Auftragsnummer: ${order.orderNumber}`, doc.page.width/2, 260, { align: 'center' });
    
    doc.fontSize(16)
       .text(`Erstellungsdatum: ${this.formatDate(new Date(order.createdAt))}`, doc.page.width/2, 290, { align: 'center' });
    
    // Client information
    doc.fontSize(14)
       .text(`Kunde: ${order.client}`, doc.page.width/2, 340, { align: 'center' });
    
    // Divider line
    doc.moveTo(100, 380)
       .lineTo(doc.page.width - 100, 380)
       .stroke('#bdc3c7');
    
    // Footer
    doc.fontSize(10)
       .fill('#95a5a6')
       .text('Fahrzeugübergabe-Managementsystem', doc.page.width/2, doc.page.height - 60, { align: 'center' });
    
    doc.text(`Erstellt am: ${this.formatDateTime(new Date())}`, doc.page.width/2, doc.page.height - 40, { align: 'center' });
    
    doc.addPage();
  }

  private addTableOfContents(doc: PDFKit.PDFDocument) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Inhaltsverzeichnis', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(150, 75)
       .stroke('#3498db');
    
    const contents = [
      { title: 'Auftragsdetails', page: 3 },
      { title: 'Fahrzeuginformationen', page: 4 },
      { title: 'Adressen', page: 5 },
      { title: 'Fahrzeugbilder', page: 6 },
      { title: 'Unterschriften', page: 7 },
      { title: 'Kosten', page: 8 },
      { title: 'Bemerkungen', page: 9 }
    ];
    
    let y = 100;
    doc.fontSize(12);
    
    contents.forEach(item => {
      // Dot leaders
      const titleWidth = doc.widthOfString(item.title);
      const pageWidth = doc.widthOfString(`... ${item.page}`);
      const availableWidth = doc.page.width - 120;
      const dotCount = Math.floor((availableWidth - titleWidth - pageWidth) / 3);
      
      doc.fill('#2c3e50')
         .text(item.title, 60, y);
      
      doc.fill('#95a5a6')
         .text('.'.repeat(dotCount), 60 + titleWidth + 5, y);
      
      doc.fill('#2c3e50')
         .text(`${item.page}`, doc.page.width - 60, y, { align: 'right' });
      
      y += 30;
    });
    
    doc.addPage();
  }

  private addOrderDetails(doc: PDFKit.PDFDocument, order: any) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Auftragsdetails', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(150, 75)
       .stroke('#3498db');
    
    let y = 100;
    
    // Create a light blue background for the details section
    doc.rect(50, y - 10, doc.page.width - 100, 180)
       .fill('#e8f4fc');
    
    // Basic information
    const details = [
      { label: 'Auftragsnummer', value: order.orderNumber },
      { label: 'Erstellungsdatum', value: this.formatDateTime(new Date(order.createdAt)) },
      { label: 'Status', value: this.translateStatus(order.status) },
      { label: 'Servicetyp', value: this.translateServiceType(order.serviceType) },
      { label: 'Kunde', value: order.client },
      { label: 'Kunden-Telefon', value: order.clientPhone || 'Nicht verfügbar' },
      { label: 'Kunden-Email', value: order.clientEmail || 'Nicht verfügbar' },
      { label: 'Fahrer', value: order.driver?.name || 'Nicht zugewiesen' }
    ];
    
    details.forEach(item => {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text(`${item.label}:`, 60, y);
      
      doc.font('Helvetica')
         .fill('#2c3e50')
         .text(item.value || 'Nicht angegeben', 200, y);
      
      y += 22;
    });
    
    // Description if available
    if (order.description) {
      y += 15;
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text('Beschreibung:', 60, y);
      
      y += 20;
      doc.font('Helvetica')
         .fill('#2c3e50')
         .text(order.description, 60, y, {
           width: doc.page.width - 120,
           align: 'left'
         });
    }
    
    doc.addPage();
  }

  private addVehicleDetails(doc: PDFKit.PDFDocument, order: any) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Fahrzeuginformationen', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(220, 75)
       .stroke('#3498db');
    
    let y = 100;
    
    // Create a light gray background for the details section
    doc.rect(50, y - 10, doc.page.width - 100, 220)
       .fill('#f5f5f5');
    
    // Basic vehicle information
    const vehicleDetails = [
      { label: 'Fahrzeughalter', value: order.vehicleOwner },
      { label: 'Kennzeichen', value: order.licensePlateNumber },
      { label: 'Fahrgestellnummer (VIN)', value: order.vin || 'Nicht angegeben' },
      { label: 'Marke', value: order.brand || 'Nicht angegeben' },
      { label: 'Modell', value: order.model || 'Nicht angegeben' },
      { label: 'Baujahr', value: order.year || 'Nicht angegeben' },
      { label: 'Farbe', value: order.color || 'Nicht angegeben' },
      { label: 'Fahrzeugtyp', value: order.vehicleType || 'Nicht angegeben' }
    ];
    
    vehicleDetails.forEach(item => {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#7f8c8d')
         .text(`${item.label}:`, 60, y);
      
      doc.font('Helvetica')
         .fill('#2c3e50')
         .text(item.value, 200, y);
      
      y += 25;
    });
    
    doc.addPage();
  }

  private addAddresses(doc: PDFKit.PDFDocument, order: any) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Adressen', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(120, 75)
       .stroke('#3498db');
    
    let y = 100;
    
    // Pickup address section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#2980b9')
       .text('Abholadresse:', 60, y);
    
    y += 30;
    
    if (order.pickupAddress) {
      // Address box with border
      doc.rect(60, y - 10, doc.page.width - 120, 90)
         .fill('#fff')
         .stroke('#bdc3c7');
      
      const pickupDetails = [
        `${order.pickupAddress.street} ${order.pickupAddress.houseNumber}`,
        `${order.pickupAddress.zipCode} ${order.pickupAddress.city}`,
        order.pickupAddress.country
      ];
      
      pickupDetails.forEach(line => {
        doc.fontSize(12)
           .font('Helvetica')
           .fill('#2c3e50')
           .text(line, 70, y);
        y += 25;
      });
    } else {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#e74c3c')
         .text('Nicht angegeben', 70, y);
      y += 25;
    }
    
    y += 40;
    
    // Delivery address section
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#2980b9')
       .text('Lieferadresse:', 60, y);
    
    y += 30;
    
    if (order.deliveryAddress) {
      // Address box with border
      doc.rect(60, y - 10, doc.page.width - 120, 90)
         .fill('#fff')
         .stroke('#bdc3c7');
      
      const deliveryDetails = [
        `${order.deliveryAddress.street} ${order.deliveryAddress.houseNumber}`,
        `${order.deliveryAddress.zipCode} ${order.deliveryAddress.city}`,
        order.deliveryAddress.country
      ];
      
      deliveryDetails.forEach(line => {
        doc.fontSize(12)
           .font('Helvetica')
           .fill('#2c3e50')
           .text(line, 70, y);
        y += 25;
      });
    } else {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#e74c3c')
         .text('Nicht angegeben', 70, y);
      y += 25;
    }
    
    doc.addPage();
  }

  private addImages(doc: PDFKit.PDFDocument, order: any) {
    // تحديد مسار مجلد uploads
    
    // إذا لم توجد صور
    if (!order.images || order.images.length === 0) {
        this.addSectionHeader(doc, 'Fahrzeugbilder', 50);
        doc.fontSize(12)
           .font('Helvetica')
           .fill('#7f8c8d')
           .text('Keine Bilder vorhanden', 60, 120);
        doc.addPage();
        return;
    }

    // إضافة عنوان القسم
    this.addSectionHeader(doc, 'Fahrzeugbilder', 50);
    
    let y = 100;
    const imageWidth = 220;
    const imageHeight = 150;
    const padding = 10;
    const maxImagesPerRow = 2;

    // تجميع الصور حسب التصنيف
    const imagesByCategory = order.images.reduce((acc, image) => {
        const category = image.category || 'OTHER';
        if (!acc[category]) acc[category] = [];
        acc[category].push(image);
        return acc;
    }, {});

    // معالجة كل تصنيف
    for (const [category, images] of Object.entries(imagesByCategory)) {
        // إضافة عنوان التصنيف
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fill('#2980b9')
           .text(this.translateImageCategory(category as string), 60, y);
        y += 30;

        let x = 60;
        let imagesInRow = 0;

        // معالجة كل صورة في التصنيف
        for (const image of images as any[]) {
            // التحقق من المساحة والصفحات
            if (this.needsNewPage(doc, y, imageHeight)) {
                doc.addPage();
                y = 50;
                x = 60;
                imagesInRow = 0;
            }

            if (imagesInRow >= maxImagesPerRow) {
                y += imageHeight + padding;
                x = 60;
                imagesInRow = 0;
                
                if (this.needsNewPage(doc, y, imageHeight)) {
                    doc.addPage();
                    y = 50;
                    x = 60;
                    imagesInRow = 0;
                }
            }

            try {
                // بناء المسار الكامل للصورة
                const filename = path.basename(image.imageUrl);
                const imagePath = path.join(this.uploadsDir, 'images', filename);
                
                if (fs.existsSync(imagePath)) {
                    // رسم إطار الصورة
                    doc.rect(x, y, imageWidth, imageHeight)
                       .fill('#fff')
                       .stroke('#bdc3c7');
                    
                    // إدراج الصورة
                    doc.image(imagePath, x + padding, y + padding, {
                        width: imageWidth - (padding * 2),
                        height: imageHeight - (padding * 2),
                        fit: [imageWidth - (padding * 2), imageHeight - (padding * 2)],
                        align: 'center'
                    });

                    // إضافة وصف الصورة إن وجد
                    if (image.description) {
                        doc.fontSize(9)
                           .font('Helvetica')
                           .fill('#7f8c8d')
                           .text(image.description, x + padding, y + imageHeight - 25, {
                               width: imageWidth - (padding * 2),
                               align: 'center'
                           });
                    }
                } else {
                    this.addImagePlaceholder(doc, x, y, imageWidth, imageHeight, 'Bild nicht gefunden');
                }
            } catch (error) {
                this.addImagePlaceholder(doc, x, y, imageWidth, imageHeight, 'Fehler beim Laden');
            }

            x += imageWidth + padding;
            imagesInRow++;
        }

        y += imageHeight + padding + 20;
        
        if (this.needsNewPage(doc, y, imageHeight)) {
            doc.addPage();
            y = 50;
        }
    }
    
    doc.addPage();
} 

// ===== الدوال المساعدة =====
private addSectionHeader(doc: PDFKit.PDFDocument, title: string, y: number) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text(title, 50, y);
    doc.moveTo(50, y + 25)
       .lineTo(50 + title.length * 8, y + 25)
       .stroke('#3498db');
}

private needsNewPage(doc: PDFKit.PDFDocument, currentY: number, contentHeight: number): boolean {
    return currentY + contentHeight > doc.page.height - 40;
}

private addImagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, message: string) {
    doc.rect(x, y, width, height)
       .fill('#f8f9fa')
       .stroke('#e74c3c');
    doc.fontSize(10)
       .fill('#e74c3c')
       .text(message, x + 10, y + (height / 2) - 5, {
           width: width - 20,
           align: 'center'
       });
}


  private addSignatures(doc: PDFKit.PDFDocument, order: any) {
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Unterschriften', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(160, 75)
       .stroke('#3498db');
    
    let y = 100;
    
    // Driver signature
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#2980b9')
       .text('Fahrerunterschrift:', 60, y);
    
    y += 30;
    
    const driverSignature = order.signatures?.find(s => s.isDriver);
    if (driverSignature) {
      try {
        const signPath = path.join(process.cwd(), driverSignature.signUrl);
        
        if (fs.existsSync(signPath)) {
          // Signature box
          doc.rect(60, y, doc.page.width - 120, 100)
             .fill('#fff')
             .stroke('#bdc3c7');
          
          // Add signature image
          doc.image(signPath, 80, y + 10, {
            width: 200,
            height: 60
          });
          
          // Signature details
          doc.fontSize(10)
             .font('Helvetica')
             .fill('#7f8c8d')
             .text(`Unterschrieben von: ${driverSignature.name}`, 80, y + 80);
          
          doc.text(`Datum: ${this.formatDateTime(new Date(driverSignature.signedAt))}`, 80, y + 95);
        }
      } catch (error) {
        console.error('❌ Error loading driver signature:', error);
        doc.fontSize(12)
           .font('Helvetica')
           .fill('#e74c3c')
           .text('Fehler beim Laden der Unterschrift', 80, y);
      }
    } else {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('Nicht verfügbar', 80, y);
    }
    
    y += 150;
    
    // Customer signature
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#2980b9')
       .text('Kundenunterschrift:', 60, y);
    
    y += 30;
    
    const customerSignature = order.signatures?.find(s => !s.isDriver);
    if (customerSignature) {
      try {
        const signPath = path.join(process.cwd(), customerSignature.signUrl);
        
        if (fs.existsSync(signPath)) {
          // Signature box
          doc.rect(60, y, doc.page.width - 120, 100)
             .fill('#fff')
             .stroke('#bdc3c7');
          
          // Add signature image
          doc.image(signPath, 80, y + 10, {
            width: 200,
            height: 60
          });
          
          // Signature details
          doc.fontSize(10)
             .font('Helvetica')
             .fill('#7f8c8d')
             .text(`Unterschrieben von: ${customerSignature.name}`, 80, y + 80);
          
          doc.text(`Datum: ${this.formatDateTime(new Date(customerSignature.signedAt))}`, 80, y + 95);
        }
      } catch (error) {
        console.error('❌ Error loading customer signature:', error);
        doc.fontSize(12)
           .font('Helvetica')
           .fill('#e74c3c')
           .text('Fehler beim Laden der Unterschrift', 80, y);
      }
    } else {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('Nicht verfügbar', 80, y);
    }
    
    doc.addPage();
  }

  private addExpenses(doc: PDFKit.PDFDocument, order: any) {
    if (!order.expenses) {
      // Add empty page with message if no expenses
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fill('#2c3e50')
         .text('Kosten', 50, 50);
      
      doc.moveTo(50, 75)
         .lineTo(110, 75)
         .stroke('#3498db');
      
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('Keine Kosten angegeben', 60, 120);
      
      doc.addPage();
      return;
    }
    
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Kosten', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(110, 75)
       .stroke('#3498db');
    
    let y = 100;
    
    // Expenses table header
    doc.rect(60, y, doc.page.width - 120, 30)
       .fill('#3498db')
       .stroke('#3498db');
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fill('#fff')
       .text('Position', 70, y + 8);
    
    doc.text('Betrag (€)', doc.page.width - 70, y + 8, { align: 'right' });
    
    y += 35;
    
    // Expenses data
    const expenses = [
      { label: 'Treibstoff', value: order.expenses.fuel || 0 },
      { label: 'Wäsche', value: order.expenses.wash || 0 },
      { label: 'AdBlue', value: order.expenses.adBlue || 0 },
      { label: 'Mautgebühren', value: order.expenses.tollFees || 0 },
      { label: 'Parken', value: order.expenses.parking || 0 },
      { label: 'Sonstiges', value: order.expenses.other || 0 }
    ];
    
    expenses.forEach((item, index) => {
      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(60, y, doc.page.width - 120, 25)
           .fill('#f8f9fa');
      }
      
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#2c3e50')
         .text(item.label, 70, y + 5);
      
      doc.text(item.value.toFixed(2), doc.page.width - 70, y + 5, { align: 'right' });
      
      y += 25;
    });
    
    // Total row
    const total = expenses.reduce((sum, item) => sum + item.value, 0);
    
    doc.rect(60, y, doc.page.width - 120, 30)
       .fill('#2c3e50')
       .stroke('#2c3e50');
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fill('#fff')
       .text('Gesamt', 70, y + 8);
    
    doc.text(total.toFixed(2), doc.page.width - 70, y + 8, { align: 'right' });
    
    y += 40;
    
    // Notes if available
    if (order.expenses.notes) {
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text('Bemerkungen:', 60, y);
      
      y += 20;
      
      doc.fontSize(11)
         .font('Helvetica')
         .fill('#2c3e50')
         .text(order.expenses.notes, 60, y, {
           width: doc.page.width - 120,
           align: 'left'
         });
    }
    
    doc.addPage();
  }

  private addComments(doc: PDFKit.PDFDocument, order: any) {
    if (!order.comments) {
      // Add empty page with message if no comments
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .fill('#2c3e50')
         .text('Bemerkungen', 50, 50);
      
      doc.moveTo(50, 75)
         .lineTo(150, 75)
         .stroke('#3498db');
      
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('Keine Bemerkungen vorhanden', 60, 120);
      
      return;
    }
    
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Bemerkungen', 50, 50);
    
    doc.moveTo(50, 75)
       .lineTo(150, 75)
       .stroke('#3498db');
    
    // Comments box with border
    doc.rect(60, 100, doc.page.width - 120, 150)
       .fill('#fff')
       .stroke('#bdc3c7');
    
    doc.fontSize(12)
       .font('Helvetica')
       .fill('#2c3e50')
       .text(order.comments, 70, 110, {
         width: doc.page.width - 140,
         align: 'left'
       });
  }

  private addFooter(doc: PDFKit.PDFDocument) {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Page footer
      doc.fontSize(10)
         .font('Helvetica')
         .fill('#95a5a6')
         .text(`Seite ${i + 1} von ${pageCount}`, doc.page.width/2, doc.page.height - 30, { 
           align: 'center',
           lineBreak: false
         });
      
      // Footer divider line
      doc.moveTo(50, doc.page.height - 40)
         .lineTo(doc.page.width - 50, doc.page.height - 40)
         .stroke('#ecf0f1');
      
      doc.text(`Fahrzeugübergabe-Managementsystem • ${this.formatDate(new Date())}`, 
               doc.page.width/2, doc.page.height - 20, { 
                 align: 'center',
                 lineBreak: false
               });
    }
  }

  // Helper methods
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  private formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private translateStatus(status: string): string {
    const statusMap = {
      'pending': 'Ausstehend',
      'in_progress': 'In Bearbeitung',
      'completed': 'Abgeschlossen',
      'cancelled': 'Abgebrochen'
    };
    return statusMap[status.toLowerCase()] || status;
  }

  private translateServiceType(serviceType: string): string {
    const serviceMap = {
      'TRANSPORT': 'Transport',
      'WASH': 'Wäsche',
      'REGISTRATION': 'Zulassung',
      'INSPECTION': 'Inspektion',
      'MAINTENANCE': 'Wartung',
      'REPAIR': 'Reparatur',
      'DELIVERY': 'Lieferung'
    };
    return serviceMap[serviceType] || serviceType;
  }

  private translateImageCategory(category: string): string {
    const categoryMap = {
      'PICKUP': 'Abholbilder',
      'DELIVERY': 'Lieferbilder',
      'ADDITIONAL': 'Zusätzliche Bilder',
      'DAMAGE': 'Schadensbilder',
      'INTERIOR': 'Innenraum',
      'EXTERIOR': 'Außenansicht',
      'DOCUMENT': 'Dokumente'
    };
    return categoryMap[category] || category;
  }

}