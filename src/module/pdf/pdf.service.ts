import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
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

  async sendOrderHtmlByEmail(orderId: string, recipientEmail: string) {
    try {
      const htmlContent = await this.generateOrderHtml(orderId);
      const filename = `fahrzeuguebergabe-${orderId}-${this.formatDateForFilename(new Date())}.html`;
      
      // حفظ الملف مؤقتاً لإرساله كمرفق
      const tempFilePath = path.join(this.uploadsDir, 'temp', filename);
      await this.ensureDirectoryExists(path.dirname(tempFilePath));
      fs.writeFileSync(tempFilePath, htmlContent, 'utf8');
      
      await this.sendHtmlReport(recipientEmail, htmlContent, tempFilePath, filename);
      
      // حذف الملف المؤقت بعد الإرسال
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      console.log(`📧 E-Mail gesendet an ${recipientEmail} mit HTML-Anhang`);
    } catch (error) {
      console.error('❌ Fehler beim Senden der HTML per E-Mail:', error);
      throw new InternalServerErrorException('E-Mail konnte nicht gesendet werden');
    }
  }

  async sendHtmlReport(email: string, htmlContent: string, filePath: string, filename: string) {
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
              anbei erhalten Sie Ihren vollständigen Fahrzeugübergabebericht als HTML-Dokument. 
              Sie können die Datei in jedem Webbrowser öffnen und bei Bedarf ausdrucken.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <p style="margin: 0; color: #2980b9; font-weight: bold;">
                📄 Dateiname: ${filename}
              </p>
              <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px;">
                Erstellt am: ${this.formatGermanDateTime(new Date())}
              </p>
              <p style="margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px;">
                💡 Tipp: Öffnen Sie die Datei mit einem Webbrowser für beste Darstellung
              </p>
            </div>
            
            <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #27ae60; margin: 0 0 10px 0;">🖨️ Druckanweisungen:</h3>
              <ul style="color: #2c3e50; margin: 0; padding-left: 20px;">
                <li>Öffnen Sie die HTML-Datei in Chrome, Firefox oder Edge</li>
                <li>Drücken Sie Strg+P (Windows) oder Cmd+P (Mac)</li>
                <li>Wählen Sie "Hintergrundgrafiken drucken" für beste Qualität</li>
                <li>Empfohlenes Format: A4, Hochformat</li>
              </ul>
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
          path: filePath,
          contentType: 'text/html'
        }
      ],
    });
  }

  async generateOrderHtml(orderId: string): Promise<string> {
    console.log(`📄 HTML-Generierung für Auftrag ${orderId} gestartet`);

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

    try {
      const htmlContent = await this.generateHtmlContent(order);
      console.log(`✅ HTML تم إنشاؤه بنجاح للطلبية ${orderId}`);
      return htmlContent;
    } catch (error) {
      console.error('❌ خطأ في إنشاء HTML:', error);
      throw new InternalServerErrorException('فشل في إنشاء ملف HTML');
    }
  }

  private async generateHtmlContent(order: any): Promise<string> {
    // تحضير البيانات
    const currentDate = this.formatGermanDateTime(new Date());
    const logoBase64 = await this.getLogoAsBase64();
    const imagesHtml = await this.generateImagesHtml(order.images);
    const signaturesHtml = await this.generateSignaturesHtml(order.signatures);

    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fahrzeugübergabebericht - ${order.orderNumber}</title>
    <style>
        ${this.getGermanHtmlStyles()}
    </style>
</head>
<body>
    <!-- Print button for user convenience -->
    <div class="print-controls no-print">
        <button onclick="window.print()" class="print-btn">
            🖨️ Dokument drucken
        </button>
        <button onclick="window.close()" class="close-btn">
            ❌ Schließen
        </button>
    </div>

    <!-- صفحة الغلاف -->
    <div class="cover-page">
        <div class="header-section">
            <div class="logo-container">
                ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Logo" class="logo">` : '<div class="logo-placeholder">🏢<br>LOGO</div>'}
            </div>
            <div class="header-content">
                <h1 class="main-title">FAHRZEUGÜBERGABE</h1>
                <h2 class="sub-title">BERICHT</h2>
                <p class="header-description">Vollständige Dokumentation der Fahrzeugübergabe</p>
            </div>
        </div>
        
        <div class="order-info-card">
            <h3>Auftragsinformationen</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Auftragsnummer:</span>
                    <span class="info-value">${order.orderNumber}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Erstellungsdatum:</span>
                    <span class="info-value">${this.formatGermanDate(new Date(order.createdAt))}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Status:</span>
                    <span class="info-value status-${order.status}">${this.translateStatus(order.status)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Kunde:</span>
                    <span class="info-value">${order.client}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Servicetyp:</span>
                    <span class="info-value">${this.translateServiceType(order.serviceType)}</span>
                </div>
            </div>
        </div>
        
        <div class="cover-footer">
            <p>Erstellt am: ${currentDate}</p>
            <p>Fahrzeugübergabe-Managementsystem</p>
            <div class="qr-placeholder">
                <div class="qr-code">QR</div>
                <p>Digitale Verifikation</p>
            </div>
        </div>
    </div>

    <!-- فهرس المحتويات -->
    <div class="page-break">
        <div class="section-header">
            <h1>INHALTSVERZEICHNIS</h1>
        </div>
        
        <div class="toc-container">
            <div class="toc-item">
                <span class="toc-title">1. Auftragsübersicht</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 1</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">2. Fahrzeugdaten</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 2</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">3. Standortinformationen</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 3</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">4. Bilddokumentation</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 4</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">5. Unterschriftennachweis</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 5</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">6. Kostenaufstellung</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 6</span>
            </div>
        </div>
    </div>

    <!-- تفاصيل الطلب -->
    <div class="page-break">
        <div class="section-header">
            <h1>1. AUFTRAGSÜBERSICHT</h1>
        </div>
        
        <div class="content-card">
            <h3>Grundinformationen</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-icon">📋</span>
                    <div class="detail-content">
                        <span class="detail-label">Auftragsnummer</span>
                        <span class="detail-value">${order.orderNumber}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">📅</span>
                    <div class="detail-content">
                        <span class="detail-label">Erstellungsdatum</span>
                        <span class="detail-value">${this.formatGermanDateTime(new Date(order.createdAt))}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">🔄</span>
                    <div class="detail-content">
                        <span class="detail-label">Letztes Update</span>
                        <span class="detail-value">${this.formatGermanDateTime(new Date(order.updatedAt))}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">📊</span>
                    <div class="detail-content">
                        <span class="detail-label">Status</span>
                        <span class="detail-value status-badge status-${order.status}">${this.translateStatus(order.status)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="content-card">
            <h3>Kundeninformationen</h3>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-icon">👤</span>
                    <div class="detail-content">
                        <span class="detail-label">Kundenname</span>
                        <span class="detail-value">${order.client || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">📞</span>
                    <div class="detail-content">
                        <span class="detail-label">Telefonnummer</span>
                        <span class="detail-value">${order.clientPhone || 'Nicht verfügbar'}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">📧</span>
                    <div class="detail-content">
                        <span class="detail-label">E-Mail</span>
                        <span class="detail-value">${order.clientEmail || 'Nicht verfügbar'}</span>
                    </div>
                </div>
                <div class="detail-item">
                    <span class="detail-icon">🔧</span>
                    <div class="detail-content">
                        <span class="detail-label">Servicetyp</span>
                        <span class="detail-value">${this.translateServiceType(order.serviceType)}</span>
                    </div>
                </div>
            </div>
        </div>

        ${order.description ? `
        <div class="content-card">
            <h3>Auftragsbeschreibung</h3>
            <div class="description-content">
                <p>${order.description}</p>
            </div>
        </div>` : ''}
    </div>

    <!-- معلومات المركبة -->
    <div class="page-break">
        <div class="section-header">
            <h1>2. FAHRZEUGDATEN</h1>
        </div>
        
        <div class="content-card">
            <h3>Fahrzeugidentifikation</h3>
            <div class="vehicle-grid">
                <div class="vehicle-item primary">
                    <span class="vehicle-icon">🚗</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Kennzeichen</span>
                        <span class="vehicle-value">${order.licensePlateNumber || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item primary">
                    <span class="vehicle-icon">🔢</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">VIN</span>
                        <span class="vehicle-value">${order.vin || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item primary">
                    <span class="vehicle-icon">👤</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Fahrzeughalter</span>
                        <span class="vehicle-value">${order.vehicleOwner || 'Nicht angegeben'}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="content-card">
            <h3>Technische Daten</h3>
            <div class="vehicle-grid">
                <div class="vehicle-item">
                    <span class="vehicle-icon">🏭</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Marke</span>
                        <span class="vehicle-value">${order.brand || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🚙</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Modell</span>
                        <span class="vehicle-value">${order.model || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">📅</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Baujahr</span>
                        <span class="vehicle-value">${order.year || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🎨</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Farbe</span>
                        <span class="vehicle-value">${order.color || 'Nicht angegeben'}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- العناوين -->
    <div class="page-break">
        <div class="section-header">
            <h1>3. STANDORTINFORMATIONEN</h1>
        </div>
        
        <div class="address-container">
            <div class="address-card pickup">
                <div class="address-header">
                    <span class="address-icon">📍</span>
                    <h3>Abholadresse</h3>
                </div>
                <div class="address-content">
                    ${this.formatGermanAddress(order.pickupAddress)}
                </div>
            </div>

            <div class="address-card delivery">
                <div class="address-header">
                    <span class="address-icon">🎯</span>
                    <h3>Lieferadresse</h3>
                </div>
                <div class="address-content">
                    ${this.formatGermanAddress(order.deliveryAddress)}
                </div>
            </div>
        </div>
    </div>

    <!-- الصور -->
    <div class="page-break">
        <div class="section-header">
            <h1>4. BILDDOKUMENTATION</h1>
        </div>
        ${imagesHtml}
    </div>

    <!-- التوقيعات -->
    <div class="page-break">
        <div class="section-header">
            <h1>5. UNTERSCHRIFTENNACHWEIS</h1>
        </div>
        
        <div class="legal-notice">
            <div class="notice-icon">ℹ️</div>
            <div class="notice-content">
                <p><strong>Rechtlicher Hinweis:</strong> Die nachfolgenden digitalen Unterschriften entsprechen den Anforderungen des deutschen Signaturgesetzes (SigG) für einfache elektronische Signaturen.</p>
            </div>
        </div>
        
        ${signaturesHtml}
    </div>

    <!-- التكاليف -->
    <div class="page-break">
        <div class="section-header">
            <h1>6. KOSTENAUFSTELLUNG</h1>
        </div>
        ${this.generateExpensesHtml(order.expenses)}
    </div>

</body>
</html>`;
  }

  // === مساعدات إنشاء HTML ===

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

  private formatGermanAddress(address: any): string {
    if (!address) {
      return `
        <div class="no-data">
          <span class="no-data-icon">❌</span>
          <p>Adresse nicht verfügbar</p>
        </div>
      `;
    }

    return `
      <p class="address-line">${address.street || ''} ${address.houseNumber || ''}`.trim() + `</p>
      <p class="address-line">${address.zipCode || ''} ${address.city || ''}</p>
      <p class="address-line">${address.country || 'Deutschland'}</p>
      ${address.additionalInfo ? `<p class="address-additional">Zusatz: ${address.additionalInfo}</p>` : ''}
    `;
  }

  private async generateImagesHtml(images: any[]): Promise<string> {
    if (!images || images.length === 0) {
      return `
        <div class="no-data">
          <span class="no-data-icon">📷</span>
          <p>Keine Bilder in der Dokumentation verfügbar</p>
        </div>
      `;
    }

    const groupedImages = this.groupImagesByGermanCategory(images);
    let html = '';

    for (const [category, categoryImages] of Object.entries(groupedImages)) {
      html += `<h2 class="image-category-header">${category}</h2>`;
      html += '<div class="images-container">';

      for (const image of categoryImages as any[]) {
        const imageBase64 = await this.getImageAsBase64(image.imageUrl);
        
        html += `
          <div class="image-card">
            ${imageBase64 ? 
              `<img src="data:image/jpeg;base64,${imageBase64}" alt="Fahrzeugbild">` :
              `<div class="image-placeholder">
                <span class="image-placeholder-icon">📷</span>
                <span>Bild nicht verfügbar</span>
              </div>`
            }
            <div class="image-description">${image.description || 'Fahrzeugdokumentation'}</div>
            ${image.createdAt ? 
              `<div class="image-timestamp">Aufgenommen: ${this.formatGermanDateTime(new Date(image.createdAt))}</div>` : 
              ''
            }
          </div>
        `;
      }

      html += '</div>';
    }

    return html;
  }

  private async getImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
      const filename = path.basename(imageUrl);
      const imagePath = path.join(this.uploadsDir, 'images', filename);
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        return imageBuffer.toString('base64');
      }
    } catch (error) {
      console.warn('⚠️ خطأ في تحميل الصورة:', error);
    }
    return null;
  }

  private async generateSignaturesHtml(signatures: any[]): Promise<string> {
    const driverSignature = signatures?.find(s => s.isDriver);
    const customerSignature = signatures?.find(s => !s.isDriver);

    return `
      <div class="signatures-container">
        <div class="signature-card driver">
          <div class="signature-header">
            <span class="address-icon">🚗</span>
            <h3>Unterschrift des Fahrers</h3>
          </div>
          <div class="signature-content">
            ${await this.generateSignatureContent(driverSignature)}
          </div>
          ${driverSignature ? this.generateSignatureDetails(driverSignature) : ''}
        </div>

        <div class="signature-card customer">
          <div class="signature-header">
            <span class="address-icon">👤</span>
            <h3>Unterschrift des Kunden</h3>
          </div>
          <div class="signature-content">
            ${await this.generateSignatureContent(customerSignature)}
          </div>
          ${customerSignature ? this.generateSignatureDetails(customerSignature) : ''}
        </div>
      </div>
    `;
  }

  private async generateSignatureContent(signature: any): Promise<string> {
    if (!signature) {
      return '<div class="signature-placeholder">❌ Unterschrift ausstehend</div>';
    }

    try {
      const signPath = path.join(process.cwd(), signature.signUrl);
      
      if (fs.existsSync(signPath)) {
        const signBuffer = fs.readFileSync(signPath);
        const signBase64 = signBuffer.toString('base64');
        return `<img src="data:image/png;base64,${signBase64}" alt="Unterschrift" class="signature-image">`;
      } else {
        return '<div class="signature-placeholder">❌ Unterschriftsdatei nicht gefunden</div>';
      }
    } catch (error) {
      return '<div class="signature-placeholder">❌ Fehler beim Laden der Unterschrift</div>';
    }
  }

  private generateSignatureDetails(signature: any): string {
    return `
      <div class="signature-details">
        <span class="signature-label">Unterzeichnet von:</span>
        <span class="signature-value">${signature.name || 'Nicht angegeben'}</span>
        <span class="signature-label">Datum und Uhrzeit:</span>
        <span class="signature-value">${this.formatGermanDateTime(new Date(signature.signedAt))}</span>
      </div>
    `;
  }

  private generateExpensesHtml(expenses: any): string {
    if (!expenses) {
      return `
        <div class="no-data">
          <span class="no-data-icon">💰</span>
          <p>Keine Kostenangaben verfügbar</p>
        </div>
      `;
    }

    const germanExpenses = [
      { label: 'Kraftstoffkosten', value: expenses.fuel || 0, category: 'Transport', icon: '⛽' },
      { label: 'Fahrzeugwäsche', value: expenses.wash || 0, category: 'Service', icon: '🧽' },
      { label: 'AdBlue-Nachfüllung', value: expenses.adBlue || 0, category: 'Service', icon: '🔵' },
      { label: 'Mautgebühren', value: expenses.tollFees || 0, category: 'Transport', icon: '🛣️' },
      { label: 'Parkgebühren', value: expenses.parking || 0, category: 'Transport', icon: '🅿️' },
      { label: 'Sonstige Kosten', value: expenses.other || 0, category: 'Sonstiges', icon: '📋' }
    ];

    const subtotal = germanExpenses.reduce((sum, item) => sum + item.value, 0);
    const mwstRate = 0.19;
    const mwstAmount = subtotal * mwstRate;
    const totalAmount = subtotal + mwstAmount;

    let tableHtml = `
      <table class="expenses-table">
        <thead>
          <tr>
            <th>Position</th>
            <th>Kategorie</th>
            <th style="text-align: right;">Betrag (€)</th>
          </tr>
        </thead>
        <tbody>
    `;

    germanExpenses.forEach(item => {
      if (item.value > 0) {
        tableHtml += `
          <tr>
            <td>
              <span class="expense-icon">${item.icon}</span>
              ${item.label}
            </td>
            <td>
              <span class="expense-category">${item.category}</span>
            </td>
            <td class="expense-amount">${item.value.toFixed(2)}</td>
          </tr>
        `;
      }
    });

    tableHtml += `
        </tbody>
      </table>

      <div class="expenses-summary">
        <div class="summary-row">
          <span class="summary-label">Zwischensumme (netto)</span>
          <span class="summary-value">€ ${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Mehrwertsteuer (19%)</span>
          <span class="summary-value">€ ${mwstAmount.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">GESAMTSUMME (brutto)</span>
          <span class="summary-value total-amount">€ ${totalAmount.toFixed(2)}</span>
        </div>
      </div>
    `;

    if (expenses.notes) {
      tableHtml += `
        <div class="content-card" style="margin-top: 20px;">
          <h3>💬 Anmerkungen zu den Kosten</h3>
          <div class="description-content">
            <p>${expenses.notes}</p>
          </div>
        </div>
      `;
    }

    return tableHtml;
  }

  // === CSS Styles ===
  
  private getGermanHtmlStyles(): string {
    return `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #2c3e50;
            background: #ffffff;
        }

        /* Print controls - only visible on screen */
        .print-controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            gap: 10px;
        }

        .print-btn, .close-btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .print-btn:hover {
            background: #2980b9;
        }

        .close-btn {
            background: #e74c3c;
        }

        .close-btn:hover {
            background: #c0392b;
        }

        /* Hide print controls when printing */
        @media print {
            .no-print {
                display: none !important;
            }
            
            .page-break {
                page-break-before: always;
            }
            
            .cover-page {
                page-break-after: always;
            }

            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }

        .page-break {
            padding: 20px;
            min-height: 100vh;
        }

        .cover-page {
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 40px;
            position: relative;
        }

        .header-section {
            display: flex;
            align-items: flex-start;
            gap: 40px;
        }

        .logo-container {
            flex-shrink: 0;
        }

        .logo {
            width: 120px;
            height: 80px;
            object-fit: contain;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 10px;
        }

        .logo-placeholder {
            width: 120px;
            height: 80px;
            background: rgba(255,255,255,0.1);
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
        }

        .header-content {
            flex: 1;
        }

        .main-title {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .sub-title {
            font-size: 32px;
            font-weight: 500;
            margin-bottom: 20px;
            opacity: 0.9;
        }

        .header-description {
            font-size: 18px;
            opacity: 0.8;
            font-weight: 300;
        }

        .order-info-card {
            background: rgba(255,255,255,0.95);
            color: #2c3e50;
            padding: 30px;
            border-radius: 12px;
            margin: 40px 0;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .order-info-card h3 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #2980b9;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .info-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .info-label {
            font-weight: 600;
            color: #7f8c8d;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .info-value {
            font-weight: 500;
            font-size: 16px;
        }

        .status-pending { color: #f39c12; }
        .status-in_progress { color: #3498db; }
        .status-completed { color: #27ae60; }
        .status-cancelled { color: #e74c3c; }

        .cover-footer {
            text-align: center;
            opacity: 0.8;
            position: relative;
        }

        .qr-placeholder {
            position: absolute;
            right: 0;
            bottom: 0;
            text-align: center;
        }

        .qr-code {
            width: 80px;
            height: 80px;
            background: rgba(255,255,255,0.1);
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
        }

        .section-header {
            margin-bottom: 30px;
        }

        .section-header h1 {
            font-size: 28px;
            font-weight: 700;
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        .toc-container {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #e9ecef;
        }

        .toc-item {
            display: flex;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #dee2e6;
        }

        .toc-item:last-child {
            border-bottom: none;
        }

        .toc-title {
            font-weight: 500;
            color: #2c3e50;
        }

        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #bdc3c7;
            margin: 0 15px;
            height: 1px;
        }

        .toc-page {
            font-weight: 600;
            color: #3498db;
            background: #e3f2fd;
            padding: 5px 10px;
            border-radius: 20px;
            min-width: 60px;
            text-align: center;
        }

        .content-card {
            background: #ffffff;
            border: 1px solid #e9ecef;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }

        .content-card h3 {
            color: #2980b9;
            font-size: 20px;
            margin-bottom: 20px;
            font-weight: 600;
        }

        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .detail-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }

        .detail-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .detail-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .detail-label {
            font-size: 12px;
            color: #7f8c8d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .detail-value {
            font-weight: 500;
            color: #2c3e50;
        }

        .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-badge.status-pending {
            background: #fef9e7;
            color: #f39c12;
            border: 1px solid #f39c12;
        }

        .status-badge.status-completed {
            background: #eafaf1;
            color: #27ae60;
            border: 1px solid #27ae60;
        }

        .status-badge.status-in_progress {
            background: #e3f2fd;
            color: #3498db;
            border: 1px solid #3498db;
        }

        .status-badge.status-cancelled {
            background: #fdf2f2;
            color: #e74c3c;
            border: 1px solid #e74c3c;
        }

        .vehicle-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
        }

        .vehicle-item {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #95a5a6;
            transition: all 0.3s ease;
        }

        .vehicle-item.primary {
            border-left-color: #e74c3c;
            background: #fdf2f2;
        }

        .vehicle-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .vehicle-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .vehicle-label {
            font-size: 12px;
            color: #7f8c8d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .vehicle-value {
            font-weight: 500;
            color: #2c3e50;
            font-size: 14px;
        }

        .address-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        .address-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border-top: 4px solid;
        }

        .address-card.pickup {
            border-top-color: #3498db;
        }

        .address-card.delivery {
            border-top-color: #27ae60;
        }

        .address-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
        }

        .address-header h3 {
            color: #2c3e50;
            font-size: 18px;
            font-weight: 600;
        }

        .address-icon {
            font-size: 24px;
        }

        .address-content {
            color: #34495e;
            line-height: 1.8;
        }

        .address-content p {
            margin-bottom: 8px;
        }

        .address-content .address-line {
            font-weight: 500;
        }

        .address-content .address-additional {
            color: #7f8c8d;
            font-size: 13px;
        }

        .images-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .image-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
        }

        .image-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 10px;
        }

        .image-placeholder {
            width: 100%;
            height: 200px;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #7f8c8d;
            margin-bottom: 10px;
        }

        .image-placeholder-icon {
            font-size: 48px;
            margin-bottom: 10px;
        }

        .image-description {
            font-size: 13px;
            color: #2c3e50;
            font-weight: 500;
            text-align: center;
            margin-bottom: 5px;
        }

        .image-timestamp {
            font-size: 11px;
            color: #7f8c8d;
            text-align: center;
        }

        .image-category-header {
            color: #2980b9;
            font-size: 18px;
            font-weight: 600;
            margin: 30px 0 20px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e3f2fd;
        }

        .signatures-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 20px;
        }

        .signature-card {
            background: #ffffff;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border-top: 4px solid;
        }

        .signature-card.driver {
            border-top-color: #3498db;
        }

        .signature-card.customer {
            border-top-color: #27ae60;
        }

        .signature-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
        }

        .signature-header h3 {
            color: #2c3e50;
            font-size: 16px;
            font-weight: 600;
        }

        .signature-content {
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            min-height: 120px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
        }

        .signature-image {
            max-width: 100%;
            max-height: 100px;
            object-fit: contain;
        }

        .signature-placeholder {
            color: #e74c3c;
            text-align: center;
            font-weight: 500;
        }

        .signature-details {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 10px 15px;
            font-size: 13px;
        }

        .signature-label {
            color: #7f8c8d;
            font-weight: 600;
        }

        .signature-value {
            color: #2c3e50;
        }

        .legal-notice {
            background: #e3f2fd;
            border: 1px solid #3498db;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            display: flex;
            gap: 15px;
        }

        .notice-icon {
            font-size: 24px;
            color: #3498db;
            flex-shrink: 0;
        }

        .notice-content {
            color: #2980b9;
        }

        .notice-content strong {
            color: #2c3e50;
        }

        .expenses-table {
            width: 100%;
            border-collapse: collapse;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }

        .expenses-table th {
            background: #2c3e50;
            color: #ffffff;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }

        .expenses-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e9ecef;
        }

        .expenses-table tr:nth-child(even) {
            background: #f8f9fa;
        }

        .expense-icon {
            font-size: 18px;
            margin-right: 8px;
        }

        .expense-amount {
            text-align: right;
            font-weight: 500;
        }

        .expense-category {
            color: #7f8c8d;
            font-size: 12px;
        }

        .expenses-summary {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
        }

        .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }

        .summary-row:last-child {
            border-bottom: none;
            border-top: 2px solid #2c3e50;
            padding-top: 15px;
            margin-top: 10px;
            font-weight: 600;
            font-size: 16px;
        }

        .summary-label {
            color: #2c3e50;
        }

        .summary-value {
            color: #2c3e50;
            font-weight: 500;
        }

        .total-amount {
            color: #27ae60 !important;
            font-size: 18px !important;
        }

        .no-data {
            text-align: center;
            color: #7f8c8d;
            padding: 40px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 2px dashed #dee2e6;
        }

        .no-data-icon {
            font-size: 48px;
            margin-bottom: 15px;
            display: block;
        }

        .description-content {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            color: #2c3e50;
            line-height: 1.6;
        }

        /* Responsive design for smaller screens */
        @media (max-width: 768px) {
            .details-grid, .vehicle-grid, .address-container, .signatures-container {
                grid-template-columns: 1fr;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
            
            .header-section {
                flex-direction: column;
                text-align: center;
            }
            
            .print-controls {
                position: relative;
                top: auto;
                right: auto;
                margin-bottom: 20px;
                justify-content: center;
            }
        }
    `;
  }

  // === مساعدات التصنيف والترجمة ===

  private groupImagesByGermanCategory(images: any[]): { [key: string]: any[] } {
    return images.reduce((acc, image) => {
      const germanCategory = this.translateImageCategoryToGerman(image.category || 'OTHER');
      if (!acc[germanCategory]) acc[germanCategory] = [];
      acc[germanCategory].push(image);
      return acc;
    }, {});
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

  // === مساعدات التاريخ والوقت الألماني ===
  
  private getGermanDate(): Date {
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
}