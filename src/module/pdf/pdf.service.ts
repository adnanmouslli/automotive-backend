import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService, private readonly mailerService: MailerService) {}

  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  
  // German timezone configuration
  private readonly GERMAN_TIMEZONE = 'Europe/Berlin';
  private readonly GERMAN_LOCALE = 'de-DE';

  async sendOrderPdfByEmail(orderId: string, recipientEmail: string) {
    try {
      const pdfBuffer = await this.generateOrderPdf(orderId);
      const filename = `fahrzeuguebergabe-${orderId}-${this.formatDateForFilename(new Date())}.pdf`;
      await this.sendPdfReport(recipientEmail, pdfBuffer, filename);
      console.log(`📧 E-Mail gesendet an ${recipientEmail} mit PDF-Anhang`);
    } catch (error) {
      console.error('❌ Fehler beim Senden der PDF per E-Mail:', error);
      throw new InternalServerErrorException('E-Mail konnte nicht gesendet werden');
    }
  }

  async sendPdfReport(email: string, pdfBuffer: Buffer, filename: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Fahrzeugübergabebericht - Ihr Auftrag',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Fahrzeugübergabebericht</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Ihr vollständiger Übergabebericht</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #2c3e50; margin-top: 0;">Guten Tag,</h2>
            
            <p style="line-height: 1.6; color: #34495e;">
              anbei erhalten Sie Ihren vollständigen Fahrzeugübergabebericht als PDF-Dokument.
            </p>
            
            <p style="line-height: 1.6; color: #34495e;">
              Der Bericht enthält alle wichtigen Informationen zu Ihrem Auftrag:
            </p>
            
            <ul style="color: #34495e; line-height: 1.8;">
              <li>Vollständige Auftragsdetails</li>
              <li>Fahrzeuginformationen</li>
              <li>Abhol- und Lieferadressen</li>
              <li>Dokumentierte Fahrzeugbilder</li>
              <li>Digitale Unterschriften</li>
              <li>Kostenaufstellung</li>
            </ul>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <p style="margin: 0; color: #2980b9; font-weight: bold;">
                📄 Dateiname: ${filename}
              </p>
              <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px;">
                Erstellt am: ${this.formatGermanDateTime(new Date())}
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
            <p style="margin: 5px 0 0 0;">Automatisch generiert am ${this.formatGermanDateTime(new Date())}</p>
          </div>
        </div>
      `,
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
    console.log(`📄 PDF-Generierung für Auftrag ${orderId} gestartet`);

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
      throw new NotFoundException(`Auftrag ${orderId} nicht gefunden`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        bufferPages: true,
        lang: 'de-DE',
        displayTitle: true,
        pdfVersion: '1.7',
        info: {
          Title: `Fahrzeugübergabebericht - ${order.orderNumber}`,
          Author: 'Fahrzeugübergabe-Managementsystem',
          Subject: 'Fahrzeugübergabebericht',
          Keywords: 'Fahrzeug, Übergabe, Transport, Bericht',
          Creator: 'PDF Service',
          Producer: 'Fahrzeugübergabe-System',
          CreationDate: this.getGermanDate(),
          ModDate: this.getGermanDate()
        }
      });
      
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.generatePdfContent(doc, order);
        doc.end();
      } catch (error) {
        console.error('❌ Fehler bei der PDF-Generierung:', error);
        reject(error);
      }
    });
  }

  private generatePdfContent(doc: PDFKit.PDFDocument, order: any) {
    // Register German fonts if available
    this.registerGermanFonts(doc);
    
    // Deckblatt
    this.addGermanCoverPage(doc, order);
    
    // Inhaltsverzeichnis
    this.addGermanTableOfContents(doc);
    
    // Auftragsdetails
    this.addGermanOrderDetails(doc, order);
    
    // Fahrzeuginformationen
    this.addGermanVehicleDetails(doc, order);
    
    // Adressen
    this.addGermanAddresses(doc, order);
    
    // Bilder
    this.addGermanImages(doc, order);
    
    // Unterschriften
    this.addGermanSignatures(doc, order);
    
    // Kosten
    this.addGermanExpenses(doc, order);
    
    // Bemerkungen
    this.addGermanComments(doc, order);
    
    // Fußzeile
    this.addGermanFooter(doc);
  }

  private registerGermanFonts(doc: PDFKit.PDFDocument) {
    // Try to register German-friendly fonts if available
    try {
      const fontsPath = path.join(this.uploadsDir, 'fonts');
      
      // Check for common German fonts
      const germanFonts = [
        'DejaVuSans.ttf',
        'DejaVuSans-Bold.ttf',
        'Liberation-Sans.ttf',
        'Arial.ttf'
      ];

      germanFonts.forEach(fontFile => {
        const fontPath = path.join(fontsPath, fontFile);
        if (fs.existsSync(fontPath)) {
          const fontName = fontFile.replace('.ttf', '');
          doc.registerFont(fontName, fontPath);
        }
      });
    } catch (error) {
      console.warn('⚠️ Deutsche Schriftarten nicht verfügbar, verwende Standardschriften');
    }
  }

  private addGermanCoverPage(doc: PDFKit.PDFDocument, order: any) {
    // Professioneller deutscher Hintergrund
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fillAndStroke('#f8f9fa', '#e9ecef');
    
    // Deutscher Header mit Gradient-Effekt
    doc.rect(0, 0, doc.page.width, 200)
       .fill('#2c3e50');
    
    // Firmenlogo - البحث عن أنواع ملفات مختلفة
    const logoPath = this.findLogoFile();
    if (logoPath && fs.existsSync(logoPath)) {
      try {
        doc.image(logoPath, 50, 30, { width: 120, height: 80 });
        console.log(`✅ Logo geladen von: ${logoPath}`);
      } catch (error) {
        console.error('❌ Fehler beim Laden des Logos:', error);
        this.addLogoPlaceholder(doc, 50, 30, 120, 80);
      }
    } else {
      console.warn('⚠️ Logo-Datei nicht gefunden. Gesucht in:', this.uploadsDir);
      this.addLogoPlaceholder(doc, 50, 30, 120, 80);
    }

    // Haupttitel بدون رموز
    doc.fontSize(36)
       .font('Helvetica-Bold')
       .fill('#ffffff')
       .text('FAHRZEUGUEBERGABE', 300, 50);
    
    doc.fontSize(24)
       .fill('#ecf0f1')
       .text('BERICHT', 300, 95);

    // Deutsche Untertitel بدون رموز
    doc.fontSize(14)
       .font('Helvetica')
       .fill('#bdc3c7')
       .text('Vollstaendige Dokumentation der Fahrzeuguebergabe', 300, 130);

    // Auftragsinformationen in deutschem Format
    const currentDate = this.getGermanDate();
    
    doc.rect(50, 250, doc.page.width - 100, 200)
       .fill('#ffffff')
       .stroke('#dee2e6');

    let y = 280;
    const infoItems = [
      { label: 'Auftragsnummer:', value: order.orderNumber },
      { label: 'Erstellungsdatum:', value: this.formatGermanDate(new Date(order.createdAt)) },
      { label: 'Aktueller Status:', value: this.translateStatus(order.status) },
      { label: 'Kunde:', value: order.client },
      { label: 'Servicetyp:', value: this.translateServiceType(order.serviceType) }
    ];


    infoItems.forEach(item => {
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fill('#2c3e50')
         .text(item.label, 100, y);
      
      doc.fontSize(14)
         .font('Helvetica')
         .fill('#34495e')
         .text(item.value, 250, y);
      
      y += 30;
    });

    // Deutsche Fußzeile
    doc.fontSize(10)
       .fill('#7f8c8d')
       .text(`Erstellt am: ${this.formatGermanDateTime(currentDate)}`, 50, doc.page.height - 100);
    
    doc.text('Fahrzeugübergabe-Managementsystem', 50, doc.page.height - 80);
    doc.text('Automatisch generierter Bericht', 50, doc.page.height - 60);

    // QR-Code Platzhalter für deutsche Compliance
    doc.rect(doc.page.width - 150, doc.page.height - 150, 100, 100)
       .fill('#ffffff')
       .stroke('#dee2e6');
    
    doc.fontSize(8)
       .fill('#7f8c8d')
       .text('QR-Code für', doc.page.width - 140, doc.page.height - 140);
    doc.text('digitale Verifikation', doc.page.width - 140, doc.page.height - 130);

    doc.addPage();
  }

  private addGermanTableOfContents(doc: PDFKit.PDFDocument) {
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('INHALTSVERZEICHNIS', 50, 60);
    
    // Deutsche Überschrift-Unterstreichung
    doc.moveTo(50, 95)
       .lineTo(280, 95)
       .lineWidth(3)
       .stroke('#3498db');

    const germanContents = [
      { title: '1. Auftragsübersicht', page: 3, description: 'Vollstaendige Details zum Auftrag' },
      { title: '2. Fahrzeugdaten', page: 4, description: 'Technische Informationen und Kennzeichen' },
      { title: '3. Standortinformationen', page: 5, description: 'Abhol- und Lieferadressen' },
      { title: '4. Bilddokumentation', page: 6, description: 'Fotografische Fahrzeugdokumentation' },
      { title: '5. Unterschriftennachweis', page: 7, description: 'Digitale Bestaetigungen' },
      { title: '6. Kostenaufstellung', page: 8, description: 'Detaillierte Kostenuebersicht' },
      { title: '7. Zusaetzliche Bemerkungen', page: 9, description: 'Weitere Informationen und Notizen' }
    ];
    
    let y = 130;
    
    germanContents.forEach((item, index) => {
      // Abwechselnde Hintergrundfarben für bessere Lesbarkeit
      if (index % 2 === 0) {
        doc.rect(50, y - 5, doc.page.width - 100, 35)
           .fill('#f8f9fa');
      }

      // Haupttitel
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fill('#2c3e50')
         .text(item.title, 60, y);

      // Beschreibung
      doc.fontSize(10)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text(item.description, 60, y + 18);

      // Seitenzahl
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fill('#3498db')
         .text(`${item.page}`, doc.page.width - 70, y + 5);

      // Punkte für optische Verbindung
      const titleWidth = doc.widthOfString(item.title);
      const dotStart = 60 + titleWidth + 10;
      const dotEnd = doc.page.width - 90;
      const dotCount = Math.floor((dotEnd - dotStart) / 4);
      
      if (dotCount > 0) {
        doc.fontSize(10)
           .fill('#bdc3c7')
           .text('.'.repeat(dotCount), dotStart, y + 5);
      }

      y += 40;
    });

    // Deutsche Hinweise
    doc.fontSize(10)
       .font('Helvetica')
       .fill('#7f8c8d')
       .text('Dieser Bericht wurde automatisch generiert und entspricht den deutschen Standards', 50, y + 40);
    
    doc.text('fuer die Fahrzeuguebergabedokumentation.', 50, y + 55);

    doc.addPage();
  }

  private addGermanOrderDetails(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '1. AUFTRAGSÜBERSICHT', 50);
    
    let y = 100;
    
    // Hauptinformationen in deutschem Stil
    doc.rect(50, y, doc.page.width - 100, 250)
       .fill('#ffffff')
       .stroke('#dee2e6');

    y += 20;
    
    const germanOrderDetails = [
      { 
        category: 'GRUNDINFORMATIONEN',
        items: [
          { label: 'Auftragsnummer', value: order.orderNumber, icon: '📋' },
          { label: 'Erstellungsdatum', value: this.formatGermanDateTime(new Date(order.createdAt)), icon: '📅' },
          { label: 'Letztes Update', value: this.formatGermanDateTime(new Date(order.updatedAt)), icon: '🔄' },
          { label: 'Aktueller Status', value: this.translateStatus(order.status), icon: '📊' }
        ]
      },
      {
        category: 'KUNDENINFORMATIONEN',
        items: [
          { label: 'Kundenname', value: order.client, icon: '👤' },
          { label: 'Telefonnummer', value: order.clientPhone || 'Nicht verfügbar', icon: '📞' },
          { label: 'E-Mail-Adresse', value: order.clientEmail || 'Nicht verfügbar', icon: '📧' }
        ]
      },
      {
        category: 'SERVICEDETAILS',
        items: [
          { label: 'Servicetyp', value: this.translateServiceType(order.serviceType), icon: '🔧' },
          { label: 'Zugewiesener Fahrer', value: order.driver?.name || 'Nicht zugewiesen', icon: '🚗' }
        ]
      }
    ];

    germanOrderDetails.forEach((category) => {
      // Kategorie-Header
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text(category.category, 70, y);
      
      y += 25;

      category.items.forEach((item) => {
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fill('#34495e')
           .text(`${item.label}:`, 105, y);
        
        doc.fontSize(11)
           .font('Helvetica')
           .fill('#2c3e50')
           .text(item.value, 220, y);
        
        y += 20;
      });

      y += 10;
    });

    // Beschreibung falls vorhanden
    if (order.description) {
      y += 20;
      
      doc.rect(50, y, doc.page.width - 100, 80)
         .fill('#f8f9fa')
         .stroke('#dee2e6');

      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text('AUFTRAGSBESCHREIBUNG', 70, y + 15);
      
      doc.fontSize(11)
         .font('Helvetica')
         .fill('#2c3e50')
         .text(order.description, 70, y + 35, {
           width: doc.page.width - 140,
           align: 'left'
         });
    }

    doc.addPage();
  }

  private addGermanVehicleDetails(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '2. FAHRZEUGDATEN', 50);
    
    let y = 100;
    
    // Fahrzeuginformationen in deutschem Layout
    doc.rect(50, y, doc.page.width - 100, 300)
       .fill('#ffffff')
       .stroke('#dee2e6');

    y += 20;

    const germanVehicleDetails = [
      {
        category: 'FAHRZEUGIDENTIFIKATION',
        items: [
          { label: 'Amtliches Kennzeichen', value: order.licensePlateNumber, icon: '🚗', mandatory: true },
          { label: 'Fahrgestellnummer (VIN)', value: order.vin, icon: '🔢', mandatory: true },
          {
          label: 'Fahrzeughalter', value: order.vehicleOwner, mandatory: true
        }
        ]
      },
      {
        category: 'TECHNISCHE DATEN',
        items: [
          { label: 'Hersteller/Marke', value: order.brand, icon: '🏭', mandatory: false },
          { label: 'Modellbezeichnung', value: order.model, icon: '🚙', mandatory: false },
          { label: 'Erstzulassung/Baujahr', value: order.year, icon: '📅', mandatory: false },
          { label: 'Fahrzeugfarbe', value: order.color, icon: '🎨', mandatory: false },
          { label: 'Fahrzeugklasse', value: order.vehicleType, icon: '📋', mandatory: false }
        ]
      }
    ];

    germanVehicleDetails.forEach((category) => {
      // Kategorie-Header mit deutschem Stil
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text(category.category, 70, y);
      
      y += 25;

      category.items.forEach((item) => {
        const value = item.value || 'Nicht angegeben';
        const color = item.mandatory && !item.value ? '#e74c3c' : '#2c3e50';
        
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fill('#34495e')
           .text(`${item.label}:`, 105, y);
        
        doc.fontSize(11)
           .font('Helvetica')
           .fill(color)
           .text(value, 270, y);
        
        // Pflichtfeld-Kennzeichnung
        if (item.mandatory && !item.value) {
          doc.fontSize(8)
             .fill('#e74c3c')
             .text('*Pflichtfeld', 450, y);
        }
        
        y += 22;
      });

      y += 15;
    });

    // Deutsche Hinweise zu Pflichtfeldern
    if (germanVehicleDetails.some(cat => cat.items.some(item => item.mandatory && !item.value))) {
      doc.fontSize(9)
         .font('Helvetica')
         .fill('#e74c3c')
         .text('* Fehlende Pflichtfelder - bitte vor Abschluss vervollständigen', 70, y);
    }

    doc.addPage();
  }

  private addGermanAddresses(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '3. STANDORTINFORMATIONEN', 50);
    
    let y = 100;
    
    // Abholadresse
    this.addGermanAddressSection(doc, 'ABHOLADRESSE', order.pickupAddress, y, '');
    y += 150;
    
    // Lieferadresse
    this.addGermanAddressSection(doc, 'LIEFERADRESSE', order.deliveryAddress, y, '');

    doc.addPage();
  }

  private addGermanAddressSection(doc: PDFKit.PDFDocument, title: string, address: any, y: number, icon: string) {
    // Section Header بدون رموز
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#2980b9')
       .text(title, 70, y);
    
    y += 30;
    
    if (address) {
      // Adressfeld im deutschen Format
      doc.rect(70, y, doc.page.width - 140, 100)
         .fill('#f8f9fa')
         .stroke('#dee2e6');

      const germanAddress = [
        `${address.street} ${address.houseNumber || ''}`.trim(),
        `${address.zipCode} ${address.city}`,
        address.country || 'Deutschland'
      ];

      germanAddress.forEach((line, index) => {
        doc.fontSize(12)
           .font('Helvetica')
           .fill('#2c3e50')
           .text(line, 85, y + 15 + (index * 20));
      });

      // Zusätzliche deutsche Adressfelder
      if (address.additionalInfo) {
        doc.fontSize(10)
           .fill('#7f8c8d')
           .text(`Zusatz: ${address.additionalInfo}`, 85, y + 75);
      }
    } else {
      doc.rect(70, y, doc.page.width - 140, 60)
         .fill('#fff5f5')
         .stroke('#e74c3c');
      
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#e74c3c')
         .text('Adresse nicht verfuegbar', 85, y + 25);
    }
  }

  private addGermanImages(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '4. BILDDOKUMENTATION', 50);
    
    if (!order.images || order.images.length === 0) {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('Keine Bilder in der Dokumentation verfuegbar', 70, 120);
      
      doc.addPage();
      return;
    }

    let y = 100;
    const imageWidth = 240;
    const imageHeight = 180;
    const padding = 20;
    const maxImagesPerRow = 2;

    // Gruppierung nach deutschen Kategorien
    const germanImageCategories = this.groupImagesByGermanCategory(order.images);

    for (const [category, images] of Object.entries(germanImageCategories)) {
      // Kategorie-Überschrift
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fill('#2980b9')
         .text(category, 70, y);
      
      y += 35;

      let x = 70;
      let imagesInRow = 0;

      for (const image of images as any[]) {
        if (this.needsNewPage(doc, y, imageHeight + 50)) {
          doc.addPage();
          y = 50;
          x = 70;
          imagesInRow = 0;
        }

        if (imagesInRow >= maxImagesPerRow) {
          y += imageHeight + padding + 30;
          x = 70;
          imagesInRow = 0;
          
          if (this.needsNewPage(doc, y, imageHeight + 50)) {
            doc.addPage();
            y = 50;
            x = 70;
            imagesInRow = 0;
          }
        }

        this.addGermanImageFrame(doc, image, x, y, imageWidth, imageHeight);
        
        x += imageWidth + padding;
        imagesInRow++;
      }

      y += imageHeight + padding + 40;
    }
    
    doc.addPage();
  }

  private addGermanImageFrame(doc: PDFKit.PDFDocument, image: any, x: number, y: number, width: number, height: number) {
    // Rahmen mit deutschem Stil
    doc.rect(x, y, width, height)
       .fill('#ffffff')
       .stroke('#dee2e6');

    try {
      const filename = path.basename(image.imageUrl);
      const imagePath = path.join(this.uploadsDir, 'images', filename);
      
      if (fs.existsSync(imagePath)) {
        doc.image(imagePath, x + 10, y + 10, {
          width: width - 20,
          height: height - 60,
          fit: [width - 20, height - 60],
          align: 'center'
        });

        // Deutsche Bildbeschriftung
        doc.fontSize(9)
           .font('Helvetica')
           .fill('#7f8c8d')
           .text(
             image.description || 'Fahrzeugdokumentation',
             x + 10,
             y + height - 45,
             { width: width - 20, align: 'center' }
           );

        // Zeitstempel in deutschem Format
        if (image.createdAt) {
          doc.fontSize(8)
             .fill('#95a5a6')
             .text(
               `Aufgenommen: ${this.formatGermanDateTime(new Date(image.createdAt))}`,
               x + 10,
               y + height - 25,
               { width: width - 20, align: 'center' }
             );
        }
      } else {
        this.addGermanImagePlaceholder(doc, x, y, width, height, 'Bild nicht verfügbar');
      }
    } catch (error) {
      this.addGermanImagePlaceholder(doc, x, y, width, height, 'Fehler beim Laden');
    }
  }

  private addGermanImagePlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number, message: string) {
    doc.rect(x + 10, y + 10, width - 20, height - 20)
       .fill('#f8f9fa')
       .stroke('#e74c3c');
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fill('#e74c3c')
       .text('📷', x + width/2 - 10, y + height/2 - 20);
    
    doc.fontSize(10)
       .fill('#e74c3c')
       .text(message, x + 20, y + height/2, {
         width: width - 40,
         align: 'center'
       });
  }

  private addGermanSignatures(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '5. UNTERSCHRIFTENNACHWEIS', 50);
    
    let y = 100;
    
    // Rechtliche Hinweise für deutsche Compliance
    doc.rect(50, y, doc.page.width - 100, 60)
       .fill('#e8f4fd')
       .stroke('#3498db');
    
    doc.fontSize(10)
       .font('Helvetica')
       .fill('#2980b9')
       .text('ℹ️ Rechtlicher Hinweis: Die nachfolgenden digitalen Unterschriften entsprechen', 70, y + 15);
    doc.text('den Anforderungen des deutschen Signaturgesetzes (SigG) für einfache elektronische Signaturen.', 70, y + 30);
    
    y += 80;
    
    // Fahrerunterschrift
    this.addGermanSignatureSection(doc, 'UNTERSCHRIFT DES FAHRERS', order.signatures?.find(s => s.isDriver), y, '🚗');
    y += 200;
    
    // Kundenunterschrift  
    this.addGermanSignatureSection(doc, 'UNTERSCHRIFT DES KUNDEN', order.signatures?.find(s => !s.isDriver), y, '👤');

    doc.addPage();
  }

  private addGermanSignatureSection(doc: PDFKit.PDFDocument, title: string, signature: any, y: number, icon: string) {
    // Section Header
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#2980b9')
       .text(`${icon} ${title}`, 70, y);
    
    y += 30;
    
    if (signature) {
      // Unterschriftsrahmen
      doc.rect(70, y, doc.page.width - 140, 120)
         .fill('#ffffff')
         .stroke('#dee2e6');

      try {
        const signPath = path.join(process.cwd(), signature.signUrl);
        
        if (fs.existsSync(signPath)) {
          doc.image(signPath, 90, y + 15, {
            width: 200,
            height: 60,
            fit: [200, 60]
          });
        } else {
          doc.fontSize(12)
             .fill('#e74c3c')
             .text('❌ Unterschriftsdatei nicht gefunden', 90, y + 40);
        }
      } catch (error) {
        doc.fontSize(12)
           .fill('#e74c3c')
           .text('❌ Fehler beim Laden der Unterschrift', 90, y + 40);
      }

      // Deutsche Unterschriftsdetails
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fill('#34495e')
         .text('Unterzeichnet von:', 90, y + 85);
      
      doc.font('Helvetica')
         .text(signature.name, 200, y + 85);
      
      doc.font('Helvetica-Bold')
         .text('Datum und Uhrzeit:', 90, y + 100);
      
      doc.font('Helvetica')
         .text(this.formatGermanDateTime(new Date(signature.signedAt)), 200, y + 100);
    } else {
      doc.rect(70, y, doc.page.width - 140, 80)
         .fill('#fff5f5')
         .stroke('#e74c3c');
      
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#e74c3c')
         .text('❌ Unterschrift ausstehend', 90, y + 35);
    }
  }

  private addGermanExpenses(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '6. KOSTENAUFSTELLUNG', 50);
    
    if (!order.expenses) {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('💰 Keine Kostenangaben verfügbar', 70, 120);
      
      doc.addPage();
      return;
    }
    
    let y = 100;
    
    // Deutsche Kostenaufstellung mit MwSt.
    const germanExpenses = [
      { label: 'Kraftstoffkosten', value: order.expenses.fuel || 0, category: 'transport', icon: '⛽' },
      { label: 'Fahrzeugwäsche', value: order.expenses.wash || 0, category: 'service', icon: '🧽' },
      { label: 'AdBlue-Nachfüllung', value: order.expenses.adBlue || 0, category: 'service', icon: '🔵' },
      { label: 'Mautgebühren', value: order.expenses.tollFees || 0, category: 'transport', icon: '🛣️' },
      { label: 'Parkgebühren', value: order.expenses.parking || 0, category: 'transport', icon: '🅿️' },
      { label: 'Sonstige Kosten', value: order.expenses.other || 0, category: 'other', icon: '📋' }
    ];

    // Tabellenkopf im deutschen Stil
    doc.rect(70, y, doc.page.width - 140, 35)
       .fill('#2c3e50')
       .stroke('#2c3e50');
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fill('#ffffff')
       .text('Position', 90, y + 10);
    
    doc.text('Kategorie', 250, y + 10);
    doc.text('Betrag (€)', doc.page.width - 120, y + 10, { align: 'right' });
    
    y += 40;

    let subtotal = 0;
    
    germanExpenses.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(70, y, doc.page.width - 140, 25)
           .fill('#f8f9fa');
      }
      
      subtotal += item.value;
      
      doc.fontSize(11)
         .font('Helvetica')
         .fill('#2c3e50')
         .text(item.icon, 80, y + 5);
      
      doc.text(item.label, 100, y + 5);
      
      doc.fontSize(10)
         .fill('#7f8c8d')
         .text(this.translateExpenseCategory(item.category), 250, y + 5);
      
      doc.fontSize(11)
         .fill('#2c3e50')
         .text(item.value.toFixed(2), doc.page.width - 120, y + 5, { align: 'right' });
      
      y += 25;
    });

    // Deutsche Steuerberechnung
    y += 10;
    const mwstRate = 0.19; // 19% MwSt in Deutschland
    const mwstAmount = subtotal * mwstRate;
    const totalAmount = subtotal + mwstAmount;

    // Zwischensumme
    doc.rect(70, y, doc.page.width - 140, 25)
       .fill('#ecf0f1')
       .stroke('#bdc3c7');
    
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text('Zwischensumme (netto)', 100, y + 5);
    
    doc.text(subtotal.toFixed(2), doc.page.width - 120, y + 5, { align: 'right' });
    
    y += 25;

    // MwSt.
    doc.rect(70, y, doc.page.width - 140, 25)
       .fill('#ecf0f1')
       .stroke('#bdc3c7');
    
    doc.fontSize(11)
       .font('Helvetica')
       .fill('#2c3e50')
       .text('Mehrwertsteuer (19%)', 100, y + 5);
    
    doc.text(mwstAmount.toFixed(2), doc.page.width - 120, y + 5, { align: 'right' });
    
    y += 25;

    // Gesamtsumme
    doc.rect(70, y, doc.page.width - 140, 30)
       .fill('#2c3e50')
       .stroke('#2c3e50');
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fill('#ffffff')
       .text('GESAMTSUMME (brutto)', 100, y + 8);
    
    doc.text(`€ ${totalAmount.toFixed(2)}`, doc.page.width - 120, y + 8, { align: 'right' });
    
    y += 50;

    // Deutsche Zahlungshinweise
    if (order.expenses.notes) {
      doc.rect(70, y, doc.page.width - 140, 60)
         .fill('#fff9e6')
         .stroke('#f39c12');
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fill('#e67e22')
         .text('💬 ANMERKUNGEN ZU DEN KOSTEN:', 85, y + 10);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fill('#2c3e50')
         .text(order.expenses.notes, 85, y + 30, {
           width: doc.page.width - 170,
           align: 'left'
         });
    }

    doc.addPage();
  }

  private addGermanComments(doc: PDFKit.PDFDocument, order: any) {
    this.addGermanSectionHeader(doc, '7. ZUSÄTZLICHE BEMERKUNGEN', 50);
    
    if (!order.comments) {
      doc.fontSize(12)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text('📝 Keine zusätzlichen Bemerkungen vorhanden', 70, 120);
      
      return;
    }
    
    let y = 100;
    
    // Kommentarfeld im deutschen Stil
    doc.rect(70, y, doc.page.width - 140, 200)
       .fill('#ffffff')
       .stroke('#dee2e6');

    doc.fontSize(12)
       .font('Helvetica')
       .fill('#2c3e50')
       .text(order.comments, 85, y + 20, {
         width: doc.page.width - 170,
         align: 'left'
       });

    // Rechtlicher Hinweis
    y += 220;
    doc.fontSize(9)
       .font('Helvetica')
       .fill('#7f8c8d')
       .text('Hinweis: Diese Bemerkungen sind Teil der offiziellen Fahrzeugübergabedokumentation', 70, y);
    doc.text('und haben rechtliche Relevanz für den Übergabevorgang.', 70, y + 15);
  }

  private addGermanFooter(doc: PDFKit.PDFDocument) {
    const pageCount = doc.bufferedPageRange().count;
    const currentDate = this.getGermanDate();
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Deutsche Fußzeile
      doc.moveTo(50, doc.page.height - 60)
         .lineTo(doc.page.width - 50, doc.page.height - 60)
         .stroke('#dee2e6');
      
      // Seitennummerierung
      doc.fontSize(9)
         .font('Helvetica')
         .fill('#7f8c8d')
         .text(`Seite ${i + 1} von ${pageCount}`, 50, doc.page.height - 45);
      
      // Firmeninfo
      doc.text('Fahrzeugübergabe-Managementsystem', doc.page.width/2, doc.page.height - 45, { 
        align: 'center' 
      });
      
      // Datum
      doc.text(`Erstellt: ${this.formatGermanDate(currentDate)}`, doc.page.width - 50, doc.page.height - 45, { 
        align: 'right' 
      });
      
      // Compliance-Hinweis
      doc.fontSize(8)
         .text('Entspricht deutschen Standards für Fahrzeugübergabedokumentation', doc.page.width/2, doc.page.height - 30, { 
           align: 'center' 
         });
    }
  }

  // === DEUTSCHE HILFSMETHODEN ===
  
  private findLogoFile(): string | null {
    // البحث عن ملف اللوغو بأنواع مختلفة
    const logoExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    const logoNames = ['logo', 'company-logo', 'brand-logo'];
    
    for (const name of logoNames) {
      for (const ext of logoExtensions) {
        const logoPath = path.join(this.uploadsDir, `${name}.${ext}`);
        if (fs.existsSync(logoPath)) {
          return logoPath;
        }
      }
    }
    
    // البحث في مجلد فرعي للوغوهات
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

  private addLogoPlaceholder(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
    // Professioneller Logo-Platzhalter
    doc.rect(x, y, width, height)
       .fill('#34495e')
       .stroke('#2c3e50');
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fill('#ffffff')
       .text('🏢', x + width/2 - 10, y + height/2 - 15);
    
    doc.fontSize(10)
       .text('LOGO', x + width/2, y + height/2, { align: 'center' });
  }
  
  private addGermanSectionHeader(doc: PDFKit.PDFDocument, title: string, y: number) {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fill('#2c3e50')
       .text(title, 50, y);
    
    doc.moveTo(50, y + 30)
       .lineTo(50 + doc.widthOfString(title) + 20, y + 30)
       .lineWidth(3)
       .stroke('#3498db');
  }

  private groupImagesByGermanCategory(images: any[]): { [key: string]: any[] } {
    return images.reduce((acc, image) => {
      const germanCategory = this.translateImageCategoryToGerman(image.category || 'OTHER');
      if (!acc[germanCategory]) acc[germanCategory] = [];
      acc[germanCategory].push(image);
      return acc;
    }, {});
  }

  private needsNewPage(doc: PDFKit.PDFDocument, currentY: number, contentHeight: number): boolean {
    return currentY + contentHeight > doc.page.height - 80;
  }

  // === DEUTSCHE ÜBERSETZUNGEN ===
  
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

  private translateImageCategoryToGerman(category: string): string {
    const germanCategoryMap = {
      'PICKUP': '📍 ABHOLBILDER',
      'DELIVERY': '🎯 LIEFERBILDER', 
      'ADDITIONAL': '📷 ZUSÄTZLICHE DOKUMENTATION',
      'DAMAGE': '⚠️ SCHADENSDOKUMENTATION',
      'INTERIOR': '🪑 INNENRAUMBILDER',
      'EXTERIOR': '🚗 AUSSENANSICHTEN',
      'DOCUMENT': '📄 DOKUMENTENBILDER',
      'ENGINE': '🔧 MOTORBEREICH',
      'TRUNK': '🎒 KOFFERRAUM',
      'OTHER': '📋 SONSTIGE BILDER'
    };
    return germanCategoryMap[category] || '📷 WEITERE BILDER';
  }

  private translateExpenseCategory(category: string): string {
    const germanExpenseCategoryMap = {
      'transport': 'Transport',
      'service': 'Service',
      'maintenance': 'Wartung',
      'other': 'Sonstiges',
      'fuel': 'Kraftstoff',
      'fees': 'Gebühren'
    };
    return germanExpenseCategoryMap[category] || category;
  }

  // === DEUTSCHE DATUMSFORMATIERUNG ===
  
  private getGermanDate(): Date {
    // Konvertierung zur deutschen Zeitzone
    return new Date(new Date().toLocaleString("en-US", { timeZone: this.GERMAN_TIMEZONE }));
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

  private formatGermanTime(date: Date): string {
    return new Intl.DateTimeFormat(this.GERMAN_LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: this.GERMAN_TIMEZONE
    }).format(date);
  }
}