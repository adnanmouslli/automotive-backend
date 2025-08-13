  import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
  import * as fs from 'fs';
  import * as path from 'path';
  import { PrismaService } from 'src/prisma/prisma.service';
  import { MailerService } from '@nestjs-modules/mailer';

  import * as htmlPdf from 'html-pdf-node';


  @Injectable()
  export class PdfService {
    constructor(private prisma: PrismaService, private readonly mailerService: MailerService) {}

    private readonly uploadsDir = path.join(process.cwd(), 'uploads');
    
    // German timezone configuration
    private readonly GERMAN_TIMEZONE = 'Europe/Berlin';
    private readonly GERMAN_LOCALE = 'de-DE';



 

    // الدالة المحدثة لتوليد التقرير الرسمي المضغوط
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

    // دالة توليد التقرير المحسن للطباعة والتحويل إلى PDF
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

            <!-- المحتوى الرئيسي -->
            <main class="main-content">
                <!-- معلومات الطلب -->
                <section class="section order-info">
                    <h2 class="section-title">AUFTRAGSINFORMATIONEN</h2>
                    <div class="info-grid">
                        <div class="info-card primary">
                            <label>Auftragsnummer</label>
                            <div class="value-highlight">${order.orderNumber}</div>
                        </div>
                        <div class="info-card">
                            <label>Status</label>
                            <span class="status status-${order.status}">${this.translateStatus(order.status)}</span>
                        </div>
                        <div class="info-card">
                            <label>Servicetyp</label>
                            <div class="value">${this.translateServiceType(order.service?.serviceType)}</div>
                        </div>
                        <div class="info-card">
                            <label>Fahrzeugtyp</label>
                            <div class="value">${order.service?.vehicleType || 'Standard'}</div>
                        </div>
                    </div>
                    ${order.description ? `
                    <div class="description-box">
                        <label>Beschreibung</label>
                        <p>${order.description}</p>
                    </div>` : ''}
                </section>

                <!-- صف الأشخاص والمركبة -->
                <div class="content-row">
                    <!-- معلومات العميل والسائق -->
                    <div class="column">
                        <section class="section person-info">
                            <h2 class="section-title">KUNDE</h2>
                            <div class="person-details">
                                <div class="detail-row">
                                    <span class="label">Name:</span>
                                    <span class="value">${order.client || 'Nicht angegeben'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Telefon:</span>
                                    <span class="value">${order.clientPhone || 'Nicht verfügbar'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">E-Mail:</span>
                                    <span class="value">${order.clientEmail || 'Nicht verfügbar'}</span>
                                </div>
                                ${order.clientAddress ? `
                                <div class="detail-row address-row">
                                    <span class="label">Adresse:</span>
                                    <div class="address-block">${this.formatCompactAddress(order.clientAddress)}</div>
                                </div>` : ''}
                            </div>
                        </section>

                        ${order.driver ? `
                        <section class="section person-info">
                            <h2 class="section-title">FAHRER</h2>
                            <div class="person-details">
                                <div class="detail-row">
                                    <span class="label">Name:</span>
                                    <span class="value">${order.driver.name}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">Telefon:</span>
                                    <span class="value">${order.driver.phone || 'Nicht verfügbar'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="label">E-Mail:</span>
                                    <span class="value">${order.driver.email || 'Nicht verfügbar'}</span>
                                </div>
                            </div>
                        </section>` : ''}
                    </div>

                    <!-- معلومات المركبة -->
                    <div class="column">
                        <section class="section vehicle-section">
                            <h2 class="section-title">FAHRZEUGDATEN</h2>
                            <div class="vehicle-details">
                                <div class="license-plate-display">
                                    <label>Kennzeichen</label>
                                    <div class="license-plate">${order.vehicleData?.licensePlateNumber || 'Nicht angegeben'}</div>
                                </div>
                                <div class="vehicle-grid">
                                    <div class="vehicle-item">
                                        <label>Halter</label>
                                        <span>${order.vehicleData?.vehicleOwner || 'Nicht angegeben'}</span>
                                    </div>
                                    <div class="vehicle-item">
                                        <label>Marke</label>
                                        <span>${order.vehicleData?.brand || 'Nicht angegeben'}</span>
                                    </div>
                                    <div class="vehicle-item">
                                        <label>Modell</label>
                                        <span>${order.vehicleData?.model || 'Nicht angegeben'}</span>
                                    </div>
                                    <div class="vehicle-item">
                                        <label>Jahr</label>
                                        <span>${order.vehicleData?.year || 'Nicht angegeben'}</span>
                                    </div>
                                    <div class="vehicle-item">
                                        <label>Farbe</label>
                                        <span>${order.vehicleData?.color || 'Nicht angegeben'}</span>
                                    </div>
                                    <div class="vehicle-item vin-item">
                                        <label>FIN/VIN</label>
                                        <span class="vin-code">${order.vehicleData?.vin || order.vehicleData?.fin || 'Nicht angegeben'}</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <!-- الموقع -->
                <section class="section locations-section">
                    <h2 class="section-title">STANDORTE</h2>
                    <div class="locations-grid">
                        <div class="location-card pickup">
                            <h3>ABHOLUNG</h3>
                            ${this.formatLocationForPrint(order.pickupAddress)}
                        </div>
                        <div class="location-card delivery">
                            <h3>LIEFERUNG</h3>
                            ${this.formatLocationForPrint(order.deliveryAddress)}
                        </div>
                    </div>
                </section>

                <!-- المعدات والأضرار -->
                <div class="content-row">
                    <div class="column">
                        <section class="section equipment-section">
                            <h2 class="section-title">AUSSTATTUNG</h2>
                            ${await this.generateEquipmentForPrint(order.items || [])}
                        </section>
                    </div>
                    <div class="column">
                        <section class="section damages-section">
                            <h2 class="section-title">SCHÄDEN</h2>
                            ${this.generateDamagesForPrint(order.damages || [])}
                        </section>
                    </div>
                </div>

                <!-- التكاليف -->
                <section class="section expenses-section">
                    <h2 class="section-title">KOSTENAUFSTELLUNG</h2>
                    ${this.generateExpensesForPrint(order.expenses)}
                </section>
            </main>

            <!-- تذييل الصفحة الأولى -->
            <footer class="page-footer">
                <div class="footer-content">
                    <div class="footer-left">
                        <strong>Fahrzeugübergabe-Service GmbH</strong><br>
                        Dokument erstellt: ${currentDate}
                    </div>
                    <div class="footer-right">
                        ${images.length > 0 ? `Fotografische Dokumentation: ${images.length} Bilder auf ${imagePagesCount} zusätzlichen Seiten` : 'Keine fotografische Dokumentation'}
                    </div>
                </div>
            </footer>
        </div>

        <!-- الصفحة الثانية: التوقيعات والمعلومات القانونية -->
        <div class="page page-signatures">
            <!-- رأس مبسط -->
            <div class="simple-header">
                <div class="header-info">
                    <span class="doc-title">Fahrzeugübergabebericht</span>
                    <span class="doc-ref">${documentReference}</span>
                </div>
                <span class="page-indicator">Seite 2 von ${2 + imagePagesCount}</span>
            </div>

            <!-- التوقيعات -->
            <section class="section signatures-section">
                <h2 class="section-title">UNTERSCHRIFTEN & BESTÄTIGUNG</h2>
                ${await this.generateSignaturesForPrint([order.driverSignature, order.customerSignature].filter(Boolean))}
            </section>

            <!-- المعلومات القانونية -->
            <section class="section legal-section">
                <h2 class="section-title">RECHTLICHE HINWEISE</h2>
                <div class="legal-content">
                    <div class="legal-box">
                        <h4>Dokumentengültigkeit</h4>
                        <p>Dieses Dokument wurde automatisch generiert und entspricht den deutschen Standards gemäß § 126a BGB. Die elektronische Form ist rechtsgültig.</p>
                    </div>
                    <div class="legal-box">
                        <h4>Datenschutz</h4>
                        <p>Die Verarbeitung aller Daten erfolgt DSGVO-konform. Aufbewahrung gemäß gesetzlicher Aufbewahrungsfristen für Geschäftsunterlagen.</p>
                    </div>
                    <div class="legal-box">
                        <h4>Verbindlichkeit</h4>
                        <p>Beide Vertragsparteien erkennen diesen Bericht als verbindliche Dokumentation des Fahrzeugzustands zum Zeitpunkt der Übergabe an.</p>
                    </div>
                </div>
            </section>

            <!-- تذييل قانوني -->
            <div class="legal-footer">
                <div class="certification">
                    <strong>ZERTIFIZIERTE DOKUMENTATION</strong><br>
                    Erstellt nach DIN EN ISO 9001:2015 Standards
                </div>
                <div class="timestamp">
                    Dokumentenerstellung: ${currentDate}<br>
                    Version: 1.0 • Status: ${this.translateStatus(order.status)}
                </div>
            </div>
        </div>

        ${await this.generateImagePages(images, documentReference, imagePagesCount)}

    </body>
    </html>`;
    }


    // دالة توليد صفحات الصور
    private async generateImagePages(images: any[], documentReference: string, totalImagePages: number): Promise<string> {
      if (!images || images.length === 0) return '';

      const imagesPerPage = 4;
      let html = '';

      for (let pageIndex = 0; pageIndex < totalImagePages; pageIndex++) {
        const startIndex = pageIndex * imagesPerPage;
        const endIndex = Math.min(startIndex + imagesPerPage, images.length);
        const pageImages = images.slice(startIndex, endIndex);
        const currentPageNumber = pageIndex + 3; // بدءاً من الصفحة 3
        const totalPages = 2 + totalImagePages;

        html += `
        <!-- صفحة الصور ${pageIndex + 1} -->
        <div class="page page-images">
            <!-- رأس الصفحة -->
            <div class="simple-header">
                <div class="header-info">
                    <span class="doc-title">Fotografische Dokumentation</span>
                    <span class="doc-ref">${documentReference}</span>
                </div>
                <span class="page-indicator">Seite ${currentPageNumber} von ${totalPages}</span>
            </div>

            <!-- عنوان الصفحة -->
            <div class="images-page-title">
                <h2>DOKUMENTATION - SEITE ${pageIndex + 1}</h2>
                <p>Bilder ${startIndex + 1} bis ${endIndex} von ${images.length}</p>
            </div>

            <!-- شبكة الصور -->
            <div class="images-grid">`;

        for (let i = 0; i < pageImages.length; i++) {
          const image = pageImages[i];
          const imageBase64 = await this.getImageAsBase64(image.imageUrl);
          const globalImageNumber = startIndex + i + 1;

          html += `
                <div class="image-container">
                    <div class="image-header">
                        <span class="image-number">Bild ${globalImageNumber}</span>
                        <span class="image-timestamp">${this.formatGermanDateTime(new Date(image.createdAt))}</span>
                    </div>
                    <div class="image-content">
                        ${imageBase64 ? 
                          `<img src="data:image/jpeg;base64,${imageBase64}" alt="Dokumentation ${globalImageNumber}" class="document-image">` :
                          `<div class="image-placeholder">
                            <div class="placeholder-icon">BILD</div>
                            <div class="placeholder-text">Nicht verfügbar</div>
                          </div>`
                        }
                    </div>
                    <div class="image-caption">
                        ${image.description || `Fahrzeugdokumentation ${globalImageNumber}`}
                    </div>
                </div>`;
        }

        html += `
            </div>

            <!-- تذييل صفحة الصور -->
            <div class="images-page-footer">
                <div class="footer-note">
                    Alle Bilder wurden zum Zeitpunkt der Fahrzeugübergabe aufgenommen und sind Bestandteil der offiziellen Dokumentation.
                </div>
            </div>
        </div>`;
      }

      return html;
    }


    // دالة توليد الأضرار للطباعة
    private generateDamagesForPrint(damages: any[]): string {
      if (!damages || damages.length === 0) {
        return '<div class="empty-state success">Keine Schäden dokumentiert<br><small>Fahrzeug in einwandfreiem Zustand</small></div>';
      }

      const damagesBySide = this.groupDamagesBySide(damages);
      
      let html = `<div class="damages-summary">Dokumentierte Schäden: ${damages.length} in ${Object.keys(damagesBySide).length} Bereichen</div>`;
      html += '<div class="damages-list">';

      Object.entries(damagesBySide).forEach(([side, sideDamages]) => {
        html += `
          <div class="damage-group">
            <h4 class="damage-side">${this.getVehicleSideText(side as any)} (${(sideDamages as any[]).length})</h4>
            <div class="damage-items">`;
        
        (sideDamages as any[]).forEach((damage, index) => {
          html += `
            <div class="damage-entry">
              <span class="damage-type">${this.getDamageTypeText(damage.type)}</span>
              ${damage.description ? `<span class="damage-desc">${damage.description}</span>` : ''}
            </div>
          `;
        });

        html += '</div></div>';
      });

      html += '</div>';
      return html;
    }


    // دالة توليد المصاريف للطباعة
    private generateExpensesForPrint(expenses: any): string {
      if (!expenses) {
        return '<div class="empty-state">Keine zusätzlichen Kosten angefallen</div>';
      }

      const expenseItems = [
        { key: 'fuel', label: 'Kraftstoff', value: expenses.fuel || 0 },
        { key: 'wash', label: 'Fahrzeugwäsche', value: expenses.wash || 0 },
        { key: 'adBlue', label: 'AdBlue', value: expenses.adBlue || 0 },
        { key: 'tollFees', label: 'Mautgebühren', value: expenses.tollFees || 0 },
        { key: 'parking', label: 'Parkgebühren', value: expenses.parking || 0 },
        { key: 'other', label: 'Sonstige Kosten', value: expenses.other || 0 }
      ];

      const validExpenses = expenseItems.filter(item => item.value > 0);
      
      if (validExpenses.length === 0) {
        return '<div class="empty-state">Keine zusätzlichen Kosten angefallen</div>';
      }

      const subtotal = validExpenses.reduce((sum, item) => sum + item.value, 0);
      const mwst = subtotal * 0.19;
      const total = subtotal + mwst;

      let html = '<table class="expenses-table">';
      html += '<thead><tr><th>Pos.</th><th>Beschreibung</th><th>Betrag</th></tr></thead>';
      html += '<tbody>';
      
      validExpenses.forEach((item, index) => {
        html += `
          <tr class="expense-row">
            <td class="pos">${index + 1}</td>
            <td class="desc">${item.label}</td>
            <td class="amount">${item.value.toFixed(2)} €</td>
          </tr>
        `;
      });

      html += `
        <tr class="subtotal-row">
          <td colspan="2">Zwischensumme (netto)</td>
          <td class="amount">${subtotal.toFixed(2)} €</td>
        </tr>
        <tr class="tax-row">
          <td colspan="2">Mehrwertsteuer (19%)</td>
          <td class="amount">${mwst.toFixed(2)} €</td>
        </tr>
        <tr class="total-row">
          <td colspan="2"><strong>Gesamtbetrag (brutto)</strong></td>
          <td class="amount"><strong>${total.toFixed(2)} €</strong></td>
        </tr>
      </tbody></table>`;

      return html;
    }


    // دالة توليد التوقيعات للطباعة
    private async generateSignaturesForPrint(signatures: any[]): Promise<string> {
      const driverSignature = signatures?.find(s => s.isDriver);
      const customerSignature = signatures?.find(s => !s.isDriver);

      return `
        <div class="signatures-compact-container">
          <!-- صف التوقيعات الثنائي -->
          <div class="signatures-row">
            <!-- توقيع السائق -->
            <div class="signature-compact driver-signature">
              <div class="signature-header">
                <span class="signature-role">FAHRER / DIENSTLEISTER</span>
              </div>
              <div class="signature-content">
                <div class="signature-image-area">
                  ${await this.generateCompactSignatureImage(driverSignature)}
                </div>
                <div class="signature-details">
                  ${driverSignature ? `
                    <div class="signer-info">
                      <span class="signer-name">${driverSignature.name || 'Nicht angegeben'}</span>
                      <span class="sign-datetime">${this.formatGermanDate(new Date(driverSignature.signedAt))} um ${this.formatGermanTime(new Date(driverSignature.signedAt))}</span>
                    </div>
                  ` : `
                    <div class="signature-missing">
                      <span class="missing-text">Unterschrift ausstehend</span>
                    </div>
                  `}
                </div>
              </div>
            </div>

            <!-- توقيع العميل -->
            <div class="signature-compact customer-signature">
              <div class="signature-header">
                <span class="signature-role">KUNDE / AUFTRAGGEBER</span>
              </div>
              <div class="signature-content">
                <div class="signature-image-area">
                  ${await this.generateCompactSignatureImage(customerSignature)}
                </div>
                <div class="signature-details">
                  ${customerSignature ? `
                    <div class="signer-info">
                      <span class="signer-name">${customerSignature.name || 'Nicht angegeben'}</span>
                      <span class="sign-datetime">${this.formatGermanDate(new Date(customerSignature.signedAt))} um ${this.formatGermanTime(new Date(customerSignature.signedAt))}</span>
                    </div>
                  ` : `
                    <div class="signature-missing">
                      <span class="missing-text">Unterschrift ausstehend</span>
                    </div>
                  `}
                </div>
              </div>
            </div>
          </div>

          <!-- تأكيد الاتفاق المضغوط -->
          <div class="agreement-confirmation-compact">
            <div class="confirmation-text">
              <strong>BESTÄTIGUNG:</strong> Beide Vertragsparteien bestätigen die Richtigkeit der dokumentierten Informationen und den ordnungsgemäßen Zustand der Übergabe.
            </div>
          </div>
        </div>
      `;
    }

    private async generateCompactSignatureImage(signature: any): Promise<string> {
      if (!signature) {
        return `
          <div class="signature-placeholder-compact">
            <div class="placeholder-content">
              <span class="placeholder-icon">✍️</span>
              <span class="placeholder-label">Ausstehend</span>
            </div>
          </div>
        `;
      }

      try {
        const signPath = path.join(process.cwd(), signature.signUrl);
        
        if (fs.existsSync(signPath)) {
          const signBuffer = fs.readFileSync(signPath);
          const signBase64 = signBuffer.toString('base64');
          return `<img src="data:image/png;base64,${signBase64}" alt="Unterschrift" class="signature-image-compact">`;
        } else {
          return `
            <div class="signature-error-compact">
              <span class="error-icon">⚠️</span>
              <span class="error-text">Datei nicht gefunden</span>
            </div>
          `;
        }
      } catch (error) {
        return `
          <div class="signature-error-compact">
            <span class="error-icon">❌</span>
            <span class="error-text">Ladefehler</span>
          </div>
        `;
      }
    }




    // CSS محسن للطباعة والتحويل إلى PDF
    private getProfessionalPrintStyles(): string {
      return `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        /* ===== BASIC RESET & TYPOGRAPHY ===== */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #1a1a1a;
            background: #ffffff;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        /* ===== PRINT CONTROLS ===== */
        .print-controls {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            background: white;
            padding: 12px;
            border-radius: 8px;
            box-shadow: 0 4px 25px rgba(0,0,0,0.15);
            border: 1px solid #e5e7eb;
        }

        .btn-print, .btn-close {
            padding: 10px 18px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        .btn-print {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
        }

        .btn-print:hover {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
        }

        .btn-close {
            background: #6b7280;
            color: white;
        }

        .btn-close:hover {
            background: #4b5563;
            transform: translateY(-1px);
        }

        /* ===== PRINT STYLES ===== */
        @media print {
            .no-print { 
                display: none !important;
            }
            
            /* إعدادات الصفحة الأساسية */
            @page {
                size: A4;
                margin: 15mm 12mm 12mm 12mm;
            }
            
            body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                font-size: 10px;
                background: white !important;
                margin: 0;
                padding: 0;
            }
            
            /* تخطيط الصفحات */
            .page { 
                page-break-after: always;
                page-break-inside: avoid;
                margin: 0 !important; 
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                width: 100% !important;
                max-width: none !important;
                height: auto !important;
                min-height: auto !important;
                background: white !important;
            }
            
            .page:last-child {
                page-break-after: avoid;
            }
            
            /* منع كسر العناصر */
            .section, .info-card, .signature-box, .damage-group, .equipment-item, 
            .image-container, .legal-box, .location-card {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            
            /* تحسين الخطوط للطباعة */
            .company-name { font-size: 16px !important; }
            .document-title h1 { font-size: 18px !important; }
            .section-title { font-size: 10px !important; }
            
            /* تحسين المسافات للطباعة */
            .main-content { gap: 4mm !important; }
            .section { margin-bottom: 4mm !important; }
            .content-row { gap: 4mm !important; margin-bottom: 4mm !important; }
            
            /* تحسين الألوان للطباعة */
            .value-highlight, .license-plate {
                background: #f0f9ff !important;
                border: 1px solid #2563eb !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .status {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            /* تحسين الصور للطباعة */
            .images-grid {
                grid-template-columns: repeat(2, 1fr) !important;
                gap: 4mm !important;
            }
            
            .document-image {
                max-height: 35mm !important;
                width: 100% !important;
                object-fit: contain !important;
            }
            
            .image-container {
                height: auto !important;
                break-inside: avoid !important;
            }
            
            /* تحسين الجداول للطباعة */
            .expenses-table {
                break-inside: avoid !important;
            }
            
            .expenses-table th, .expenses-table td {
                border: 1px solid #d1d5db !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            /* إخفاء عناصر غير ضرورية في الطباعة */
            .print-controls {
                display: none !important;
            }
        }

        /* ===== PAGE STRUCTURE ===== */
        .page {
            background: white;
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 20px;
            padding: 15mm 12mm 12mm 12mm;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            position: relative;
            display: flex;
            flex-direction: column;
        }

        /* ===== DOCUMENT HEADER ===== */
        .document-header {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 8mm;
            margin-bottom: 6mm;
            flex-shrink: 0;
        }

        .header-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 6mm;
            gap: 15mm;
        }

        .company-section {
            display: flex;
            align-items: center;
            gap: 4mm;
            flex: 1;
        }

        .company-logo {
            width: 12mm;
            height: 12mm;
            object-fit: contain;
            border: 1px solid #e5e7eb;
            border-radius: 2mm;
            padding: 1mm;
            background: white;
            flex-shrink: 0;
        }

        .company-logo-placeholder {
            width: 12mm;
            height: 12mm;
            background: #f3f4f6;
            border: 1px dashed #9ca3af;
            border-radius: 2mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 6px;
            font-weight: 700;
            color: #6b7280;
            text-align: center;
            flex-shrink: 0;
        }

        .company-info {
            flex: 1;
        }

        .company-name {
            font-size: 18px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 1mm;
            line-height: 1.1;
        }

        .company-subtitle {
            font-size: 9px;
            color: #6b7280;
            font-weight: 400;
            line-height: 1.2;
        }

        .document-info {
            text-align: right;
            flex-shrink: 0;
            min-width: 35mm;
        }

        .doc-number {
            font-size: 10px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 1mm;
        }

        .doc-date {
            font-size: 9px;
            color: #6b7280;
            font-weight: 500;
        }

        .document-title {
            text-align: center;
        }

        .document-title h1 {
            font-size: 20px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 2mm;
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .title-underline {
            width: 40mm;
            height: 2px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            margin: 0 auto;
        }

        /* ===== SIMPLE HEADER FOR OTHER PAGES ===== */
        .simple-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3mm 0 4mm 0;
            border-bottom: 1px solid #e5e7eb;
            margin-bottom: 5mm;
            flex-shrink: 0;
        }

        .header-info {
            display: flex;
            flex-direction: column;
            gap: 1mm;
        }

        .doc-title {
            font-size: 12px;
            font-weight: 600;
            color: #2563eb;
        }

        .doc-ref {
            font-size: 8px;
            color: #6b7280;
            font-weight: 500;
        }

        .page-indicator {
            background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
            color: #4b5563;
            padding: 2mm 3mm;
            border-radius: 2mm;
            font-size: 8px;
            font-weight: 600;
            border: 1px solid #d1d5db;
        }

        /* ===== MAIN CONTENT ===== */
        .main-content {
            display: flex;
            flex-direction: column;
            gap: 5mm;
            flex: 1;
        }

        /* ===== SECTIONS ===== */
        .section {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 3mm;
            overflow: hidden;
            margin-bottom: 4mm;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .section-title {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-bottom: 1px solid #e5e7eb;
            padding: 3mm 4mm;
            font-size: 10px;
            font-weight: 700;
            color: #2563eb;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
        }

        /* ===== CONTENT LAYOUTS ===== */
        .content-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            margin-bottom: 4mm;
        }

        .column {
            display: flex;
            flex-direction: column;
            gap: 4mm;
        }

        /* ===== INFO GRIDS ===== */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 3mm;
            padding: 4mm;
        }

        .info-card {
            display: flex;
            flex-direction: column;
            gap: 2mm;
            padding: 3mm;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 2mm;
        }

        .info-card.primary {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 1px solid #3b82f6;
        }

        .info-card label {
            font-size: 8px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 1mm;
        }

        .info-card .value, .info-card span {
            font-size: 10px;
            font-weight: 600;
            color: #1f2937;
            line-height: 1.2;
        }

        .value-highlight {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            color: #1e40af;
            padding: 2mm 3mm;
            border-radius: 2mm;
            border: 1px solid #3b82f6;
            font-weight: 700;
            text-align: center;
            font-family: 'Courier New', monospace;
            letter-spacing: 1px;
        }

        /* ===== STATUS BADGES ===== */
        .status {
            padding: 1mm 2mm;
            border-radius: 2mm;
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            text-align: center;
            border: 1px solid;
        }

        .status.status-pending {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            color: #92400e;
            border-color: #f59e0b;
        }

        .status.status-in_progress {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            color: #1e40af;
            border-color: #3b82f6;
        }

        .status.status-completed {
            background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
            color: #065f46;
            border-color: #10b981;
        }

        .status.status-cancelled {
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            color: #991b1b;
            border-color: #ef4444;
        }

        /* ===== DESCRIPTION BOX ===== */
        .description-box {
            grid-column: 1 / -1;
            padding: 4mm;
            border-top: 1px solid #f3f4f6;
            margin-top: 3mm;
            background: #fafbfc;
        }

        .description-box label {
            display: block;
            font-size: 8px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 2mm;
        }

        .description-box p {
            font-size: 10px;
            color: #374151;
            line-height: 1.4;
            margin: 0;
        }

        /* ===== PERSON INFO ===== */
        .person-details {
            padding: 4mm;
            display: flex;
            flex-direction: column;
            gap: 2mm;
        }

        .detail-row {
            display: grid;
            grid-template-columns: 20mm 1fr;
            gap: 3mm;
            align-items: start;
            padding: 2mm 0;
            border-bottom: 1px solid #f9fafb;
        }

        .detail-row:last-child {
            border-bottom: none;
        }

        .detail-row .label {
            font-size: 8px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .detail-row .value {
            font-size: 10px;
            font-weight: 500;
            color: #1f2937;
            line-height: 1.3;
        }

        .address-row {
            grid-template-columns: 20mm 1fr;
        }

        .address-block {
            font-size: 10px;
            color: #1f2937;
            line-height: 1.3;
            font-weight: 500;
        }

        /* ===== VEHICLE SECTION ===== */
        .vehicle-section {
            border-left: 3px solid #10b981;
        }

        .vehicle-details {
            padding: 4mm;
            display: flex;
            flex-direction: column;
            gap: 4mm;
        }

        .license-plate-display {
            text-align: center;
            padding: 3mm;
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 1px solid #10b981;
            border-radius: 2mm;
        }

        .license-plate-display label {
            display: block;
            font-size: 8px;
            font-weight: 600;
            color: #065f46;
            text-transform: uppercase;
            margin-bottom: 2mm;
        }

        .license-plate {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            color: #1e40af;
            padding: 3mm 4mm;
            border-radius: 2mm;
            border: 2px solid #3b82f6;
            font-weight: 700;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            font-size: 12px;
            display: inline-block;
            text-align: center;
            min-width: 25mm;
        }

        .vehicle-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 3mm;
        }

        .vehicle-item {
            display: flex;
            flex-direction: column;
            gap: 1mm;
            padding: 2mm;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 1mm;
        }

        .vehicle-item label {
            font-size: 8px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .vehicle-item span {
            font-size: 10px;
            font-weight: 500;
            color: #1f2937;
            line-height: 1.2;
        }

        .vin-item {
            grid-column: 1 / -1;
        }

        .vin-code {
            font-family: 'Courier New', monospace;
            font-size: 8px;
            background: #f3f4f6;
            padding: 1mm 2mm;
            border-radius: 1mm;
            letter-spacing: 0.5px;
            border: 1px solid #d1d5db;
        }

        /* ===== LOCATIONS ===== */
        .locations-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4mm;
            padding: 4mm;
        }

        .location-card {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 2mm;
            padding: 3mm;
            position: relative;
        }

        .location-card.pickup {
            border-left: 3px solid #f59e0b;
        }

        .location-card.delivery {
            border-left: 3px solid #10b981;
        }

        .location-card h3 {
            font-size: 9px;
            font-weight: 700;
            color: #2563eb;
            margin-bottom: 3mm;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .location-content {
            display: flex;
            flex-direction: column;
            gap: 2mm;
        }

        .main-address {
            font-weight: 600;
            font-size: 10px;
            color: #1f2937;
            line-height: 1.3;
        }

        .location-details {
            display: flex;
            flex-direction: column;
            gap: 1mm;
        }

        .detail-item {
            font-size: 8px;
            color: #6b7280;
            line-height: 1.3;
        }

        .no-data {
            color: #9ca3af;
            font-style: italic;
            font-size: 9px;
            text-align: center;
            padding: 2mm;
        }

        /* ===== EMPTY STATES ===== */
        .empty-state {
            padding: 4mm;
            text-align: center;
            font-size: 9px;
            font-weight: 500;
            border-radius: 2mm;
            margin: 4mm;
        }

        .empty-state.success {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            color: #065f46;
            border: 1px solid #10b981;
        }

        .empty-state:not(.success) {
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            color: #374151;
            border: 1px solid #d1d5db;
        }

        /* ===== EQUIPMENT ===== */
        .items-summary {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 3mm 4mm;
            border-bottom: 1px solid #e5e7eb;
            font-size: 9px;
            font-weight: 600;
            color: #4b5563;
        }

        .items-list {
            padding: 4mm;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(40mm, 1fr));
            gap: 2mm;
        }

        .equipment-item {
            display: flex;
            align-items: center;
            gap: 2mm;
            padding: 2mm 3mm;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 2mm;
            font-size: 9px;
            justify-content: space-between;
        }

        .equipment-item.available {
            border-left: 3px solid #10b981;
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        }

        .equipment-item.missing {
            border-left: 3px solid #ef4444;
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        }

        .item-name {
            font-weight: 500;
            color: #374151;
            flex: 1;
        }

        .item-status {
            font-size: 8px;
            font-weight: 700;
            color: #10b981;
            flex-shrink: 0;
            padding: 1mm 2mm;
            background: #dcfce7;
            border-radius: 1mm;
            border: 1px solid #10b981;
        }

        .equipment-item.missing .item-status {
            color: #ef4444;
            background: #fee2e2;
            border-color: #ef4444;
        }

        /* ===== DAMAGES ===== */
        .damages-summary {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            color: #92400e;
            padding: 3mm 4mm;
            border-bottom: 1px solid #f59e0b;
            font-size: 9px;
            font-weight: 600;
        }

        .damages-list {
            padding: 4mm;
            display: flex;
            flex-direction: column;
            gap: 3mm;
        }

        .damage-group {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-left: 3px solid #ef4444;
            border-radius: 2mm;
            padding: 3mm;
        }

        .damage-side {
            font-size: 9px;
            font-weight: 700;
            color: #dc2626;
            margin-bottom: 2mm;
            text-transform: uppercase;
        }

        .damage-items {
            display: flex;
            flex-direction: column;
            gap: 2mm;
        }

        .damage-entry {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 1mm;
            padding: 2mm 3mm;
            display: flex;
            flex-direction: column;
            gap: 1mm;
        }

        .damage-type {
            font-size: 8px;
            font-weight: 700;
            color: #dc2626;
        }

        .damage-desc {
            font-size: 8px;
            color: #6b7280;
            line-height: 1.3;
        }

        /* ===== EXPENSES TABLE ===== */
        .expenses-table {
            margin: 4mm;
            border-collapse: collapse;
            width: calc(100% - 8mm);
            font-size: 9px;
            border: 1px solid #e5e7eb;
            border-radius: 2mm;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .expenses-table thead th {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
            color: #374151;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            font-size: 8px;
        }

        .expenses-table th, .expenses-table td {
            padding: 3mm;
            text-align: left;
            border-bottom: 1px solid #f3f4f6;
        }

        .expenses-table th:first-child, .expenses-table td.pos {
            width: 10mm;
            text-align: center;
        }

        .expenses-table th:last-child, .expenses-table td.amount {
            width: 25mm;
            text-align: right;
            font-family: 'Courier New', monospace;
        }

        .expense-row td {
            color: #374151;
            font-weight: 500;
        }

        .subtotal-row, .tax-row {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            font-weight: 600;
            border-top: 1px solid #e5e7eb;
        }

        .total-row {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            font-weight: 700;
            font-size: 10px;
        }

        /* ===== SIGNATURES ===== */
        .signatures-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            margin: 4mm;
            margin-bottom: 6mm;
        }

        .signature-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 2mm;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .signature-box h3 {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 3mm;
            border-bottom: 1px solid #e5e7eb;
            font-size: 9px;
            font-weight: 700;
            color: #2563eb;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
        }

        .signature-area {
            height: 20mm;
            border: 1px dashed #d1d5db;
            margin: 3mm;
            border-radius: 1mm;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
        }

        .signature-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .no-signature, .signature-error {
            font-size: 8px;
            text-align: center;
            padding: 2mm;
        }

        .no-signature {
            color: #9ca3af;
        }

        .signature-error {
            color: #dc2626;
        }

        .signature-info {
            padding: 3mm;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-top: 1px solid #e5e7eb;
        }

        .signer-details {
            font-size: 8px;
            display: flex;
            flex-direction: column;
            gap: 1mm;
        }

        .signer-details .detail {
            color: #374151;
            line-height: 1.2;
        }

        .pending-signature {
            text-align: center;
            font-size: 8px;
            color: #dc2626;
            font-weight: 600;
            padding: 2mm;
        }

        .confirmation-box {
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 1px solid #3b82f6;
            border-radius: 2mm;
            padding: 4mm;
            margin: 4mm;
        }

        .confirmation-box h4 {
            font-size: 10px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 2mm;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .confirmation-box p {
            font-size: 9px;
            line-height: 1.4;
            color: #1e40af;
            margin: 0;
        }

        /* ===== LEGAL SECTION ===== */
        .legal-content {
            padding: 4mm;
            display: flex;
            flex-direction: column;
            gap: 3mm;
        }

        .legal-box {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1px solid #0ea5e9;
            border-radius: 2mm;
            padding: 3mm;
        }

        .legal-box h4 {
            font-size: 9px;
            font-weight: 700;
            color: #0c4a6e;
            margin-bottom: 2mm;
            text-transform: uppercase;
        }

        .legal-box p {
            font-size: 8px;
            line-height: 1.4;
            color: #0c4a6e;
            margin: 0;
        }

        .legal-footer {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            margin: 6mm 4mm 0 4mm;
            padding: 4mm;
            background: linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%);
            color: white;
            border-radius: 2mm;
            font-size: 8px;
        }

        .certification, .timestamp {
            line-height: 1.3;
        }

        .certification {
            font-weight: 700;
        }

        .timestamp {
            text-align: right;
        }

        /* ===== PAGE FOOTERS ===== */
        .page-footer {
            margin-top: auto;
            padding-top: 4mm;
            border-top: 1px solid #e5e7eb;
            flex-shrink: 0;
        }

        .footer-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5mm;
            font-size: 8px;
            color: #374151;
        }

        .footer-left, .footer-right {
            line-height: 1.3;
        }

        .footer-right {
            text-align: right;
        }

        /* ===== IMAGES PAGE STYLES ===== */
        .images-page-title {
            text-align: center;
            margin-bottom: 5mm;
            padding: 3mm;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            border: 1px solid #3b82f6;
            border-radius: 2mm;
        }

        .images-page-title h2 {
            font-size: 12px;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 1mm;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .images-page-title p {
            font-size: 9px;
            color: #1e40af;
            margin: 0;
        }

        .images-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 5mm;
            padding: 0;
            margin-bottom: 5mm;
        }

        .image-container {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 3mm;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            height: auto;
        }

        .image-header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 3mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }

        .image-number {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .image-timestamp {
            font-size: 7px;
            opacity: 0.9;
            font-weight: 500;
        }

        .image-content {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 40mm;
            background: #f9fafb;
        }

        .document-image {
            max-width: 100%;
            max-height: 40mm;
            object-fit: contain;
            border-radius: 1mm;
        }

        .image-placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
            padding: 4mm;
            text-align: center;
            min-height: 40mm;
        }

        .placeholder-icon {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 2mm;
            opacity: 0.7;
            color: #6b7280;
            background: #f3f4f6;
            padding: 2mm 3mm;
            border-radius: 2mm;
            border: 1px solid #d1d5db;
        }

        .placeholder-text {
            font-size: 9px;
            font-weight: 500;
        }

        .image-caption {
            padding: 3mm;
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-top: 1px solid #e5e7eb;
            font-size: 8px;
            color: #374151;
            line-height: 1.3;
            text-align: center;
            min-height: 8mm;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }

        .images-page-footer {
            margin-top: auto;
            padding: 3mm;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1px solid #0ea5e9;
            border-radius: 2mm;
            text-align: center;
            flex-shrink: 0;
        }

        .footer-note {
            font-size: 8px;
            color: #0c4a6e;
            line-height: 1.4;
            font-style: italic;
        }

        /* ===== RESPONSIVE FOR SCREEN VIEW ===== */
        @media screen and (max-width: 768px) {
            .page {
                width: 100%;
                padding: 5mm;
                margin: 0 0 10px 0;
                min-height: auto;
            }
            
            .header-container {
                flex-direction: column;
                gap: 5mm;
                text-align: center;
            }
            
            .content-row {
                grid-template-columns: 1fr;
                gap: 3mm;
            }
            
            .info-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 2mm;
            }
            
            .locations-grid, .signatures-container {
                grid-template-columns: 1fr;
                gap: 3mm;
            }
            
            .images-grid {
                grid-template-columns: 1fr;
                gap: 3mm;
            }
            
            .items-list {
                grid-template-columns: 1fr;
            }
            
            .vehicle-grid {
                grid-template-columns: 1fr;
            }
            
            .legal-footer {
                grid-template-columns: 1fr;
                gap: 2mm;
                text-align: center;
            }
            
            .timestamp {
                text-align: center !important;
            }
            
            .footer-content {
                grid-template-columns: 1fr;
                gap: 2mm;
                text-align: center;
            }
            
            .footer-right {
                text-align: center !important;
            }
        }

        /* ===== ADDITIONAL PRINT OPTIMIZATIONS ===== */
        @media print {
            /* تحسين أداء الطباعة */
            .images-grid {
                break-inside: avoid-page;
            }
            
            .image-container {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }
            
            /* تحسين جودة الصور في الطباعة */
            .document-image {
                image-rendering: -webkit-optimize-contrast;
                image-rendering: optimize-contrast;
                image-rendering: crisp-edges;
            }
            
            /* تحسين الألوان للطباعة بالأبيض والأسود */
            .legal-box, .confirmation-box {
                background: #f8f9fa !important;
                border-color: #6c757d !important;
                -webkit-print-color-adjust: exact !important;
            }
            
            .legal-box h4, .legal-box p, .confirmation-box h4, .confirmation-box p {
                color: #212529 !important;
            }
            
            /* تحسين التباين للنصوص المهمة */
            .company-name, .document-title h1, .section-title {
                color: #000000 !important;
            }
            
            /* تحسين حدود الجداول للطباعة */
            .expenses-table, .expenses-table th, .expenses-table td {
                border-color: #000000 !important;
                border-width: 1px !important;
            }
            
            /* ضمان ظهور الخلفيات المهمة */
            .value-highlight, .license-plate {
                background: #e6f2ff !important;
                border: 2px solid #000000 !important;
                color: #000000 !important;
            }
            
            /* تحسين التوقيعات للطباعة */
            .signature-area {
                border: 2px solid #000000 !important;
                background: #ffffff !important;
            }
            
            /* ضمان ظهور أيقونات الحالة */
            .status {
                border: 1px solid #000000 !important;
                background: #f0f0f0 !important;
                color: #000000 !important;
            }
        }

        /* ===== COMPACT SIGNATURES STYLES - إضافة جديدة ===== */
        .signatures-compact-container {
          margin: 4mm 0;
          display: flex;
          flex-direction: column;
          gap: 3mm;
        }

        .signatures-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4mm;
        }

        .signature-compact {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 2mm;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .signature-compact.driver-signature {
          border-top: 2px solid #3b82f6;
        }

        .signature-compact.customer-signature {
          border-top: 2px solid #10b981;
        }

        .signature-header {
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 2mm 3mm;
          border-bottom: 1px solid #e5e7eb;
        }

        .signature-role {
          font-size: 8px;
          font-weight: 700;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .signature-content {
          display: flex;
          align-items: center;
          gap: 3mm;
          padding: 3mm;
          min-height: 16mm;
        }

        .signature-image-area {
          flex: 1;
          height: 12mm;
          border: 1px dashed #d1d5db;
          border-radius: 1mm;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
          position: relative;
        }

        .signature-image-compact {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .signature-placeholder-compact, 
        .signature-error-compact {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 1mm;
        }

        .placeholder-content,
        .signature-error-compact {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1mm;
        }

        .placeholder-icon, .error-icon {
          font-size: 10px;
          opacity: 0.7;
        }

        .placeholder-label, .error-text {
          font-size: 6px;
          font-weight: 600;
          color: #9ca3af;
          text-align: center;
          line-height: 1.1;
        }

        .error-text {
          color: #dc2626;
        }

        .signature-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
        }

        .signer-info {
          display: flex;
          flex-direction: column;
          gap: 1mm;
        }

        .signer-name {
          font-size: 9px;
          font-weight: 600;
          color: #1f2937;
          line-height: 1.2;
          word-break: break-word;
        }

        .sign-datetime {
          font-size: 7px;
          font-weight: 500;
          color: #6b7280;
          line-height: 1.2;
        }

        .signature-missing {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .missing-text {
          font-size: 8px;
          font-weight: 600;
          color: #dc2626;
          text-align: center;
          font-style: italic;
        }

        .agreement-confirmation-compact {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 1px solid #3b82f6;
          border-radius: 2mm;
          padding: 3mm;
          margin-top: 2mm;
        }

        .confirmation-text {
          font-size: 8px;
          line-height: 1.4;
          color: #1e40af;
          text-align: center;
        }

        .confirmation-text strong {
          font-weight: 700;
          color: #1d4ed8;
        }

        /* ===== PRINT OPTIMIZATIONS FOR COMPACT SIGNATURES ===== */
        @media print {
          .signatures-compact-container {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          
          .signatures-row {
            break-inside: avoid;
            margin-bottom: 2mm !important;
          }
          
          .signature-compact {
            break-inside: avoid;
            box-shadow: none !important;
          }
          
          .signature-header {
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .agreement-confirmation-compact {
            background: #f0f9ff !important;
            border-color: #2563eb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .confirmation-text, .confirmation-text strong {
            color: #1e40af !important;
          }
          
          /* تقليل المسافات في الطباعة */
          .signatures-compact-container {
            margin: 2mm 0 !important;
            gap: 2mm !important;
          }
          
          .signatures-row {
            gap: 3mm !important;
          }
          
          .signature-content {
            min-height: 12mm !important;
            padding: 2mm !important;
          }
          
          .signature-image-area {
            height: 10mm !important;
          }
          
          .agreement-confirmation-compact {
            padding: 2mm !important;
          }
        }

        /* ===== RESPONSIVE FOR MOBILE ===== */
        @media screen and (max-width: 768px) {
          .signatures-row {
            grid-template-columns: 1fr;
            gap: 3mm;
          }
          
          .signature-content {
            flex-direction: column;
            align-items: stretch;
            min-height: auto;
            gap: 2mm;
          }
          
          .signature-image-area {
            height: 15mm;
          }
          
          .signature-details {
            text-align: center;
          }
          
          .signer-info {
            align-items: center;
          }
        }
          
      `;
    }

    // دالة تنسيق الموقع للطباعة
    private formatLocationForPrint(address: any): string {
      if (!address) {
        return '<div class="no-data">Keine Adresse verfügbar</div>';
      }

      let html = '<div class="location-content">';
      
      // العنوان الأساسي
      html += `<div class="main-address">${this.formatCompactAddress(address)}</div>`;

      // التفاصيل الإضافية
      const details = [];
      
      if (address.date) {
        details.push(`Termin: ${this.formatGermanDateTime(new Date(address.date))}`);
      }

      if (address.contactPersonName) {
        details.push(`Kontakt: ${address.contactPersonName}`);
      }

      if (address.contactPersonPhone) {
        details.push(`Tel.: ${address.contactPersonPhone}`);
      }

      if (address.fuelLevel !== null) {
        details.push(`Tankstand: ${address.fuelLevel}/8`);
      }

      if (address.fuelMeter !== null) {
        details.push(`Kilometerstand: ${address.fuelMeter.toLocaleString('de-DE')} km`);
      }

      if (details.length > 0) {
        html += '<div class="location-details">';
        details.forEach(detail => {
          html += `<div class="detail-item">${detail}</div>`;
        });
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    // دالة توليد المعدات للطباعة
    private async generateEquipmentForPrint(items: string[]): Promise<string> {
      if (!items || items.length === 0) {
        return '<div class="empty-state">Keine spezielle Ausstattung dokumentiert</div>';
      }

  const availableItems = items.filter(item => item && item.trim() !== '');
  
  if (availableItems.length === 0) {
    return '<div class="empty-state">Keine spezielle Ausstattung dokumentiert</div>';
  }

  let html = `<div class="items-summary">Dokumentierte Gegenstände: ${availableItems.length}</div>`;
  html += '<div class="items-list">';
  
  availableItems.forEach((item, index) => {
    const itemInfo = this.getVehicleItemInfo(item);
    html += `
      <div class="equipment-item ${itemInfo.available ? 'available' : 'missing'}">
        <span class="item-name">${itemInfo.name}</span>
      </div>
    `;
  });

  html += '</div>';
  return html;
}



// دالة تنسيق العنوان المضغوط
private formatCompactAddress(address: any): string {
  if (!address) return 'Keine Adresse verfügbar';
  
  const parts = [
    address.street,
    address.houseNumber,
    `${address.zipCode} ${address.city}`,
    address.country
  ].filter(Boolean);
  
  return parts.join(', ');
}




// دالة تنسيق الوقت الألماني فقط
private formatGermanTime(date: Date): string {
  return new Intl.DateTimeFormat(this.GERMAN_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: this.GERMAN_TIMEZONE
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

  private groupDamagesBySide(damages: any[]): { [key: string]: any[] } {
    return damages.reduce((acc, damage) => {
      const side = damage.side;
      if (!acc[side]) {
        acc[side] = [];
      }
      acc[side].push(damage);
      return acc;
    }, {});
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



    private async convertHtmlToPdf(htmlContent: string): Promise<Buffer> {
      try {
        console.log('🔄 بدء تحويل HTML إلى PDF باستخدام html-pdf-node...');
        
        const options = {
          format: 'A4',
          orientation: 'portrait',
          border: {
            top: '20mm',
            right: '15mm',
            bottom: '20mm',
            left: '15mm'
          },
          type: 'pdf',
          quality: '75',
          renderDelay: 1000,
          timeout: 30000,
          httpHeaders: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        };

        const file = { content: htmlContent };
        
        console.log('📄 توليد PDF...');
        const pdfBuffer: Buffer = await htmlPdf.generatePdf(file, options);
        
        console.log(`✅ تم إنشاء PDF بنجاح - الحجم: ${pdfBuffer.length} bytes`);
        return pdfBuffer;
        
      } catch (error) {
        console.error('❌ خطأ في تحويل HTML إلى PDF:', error);
        throw new InternalServerErrorException(`فشل في تحويل HTML إلى PDF: ${error.message}`);
      }
    }

    async generateOrderPdf(orderId: string): Promise<Buffer> {
      console.log(`📄 PDF-Generierung für Auftrag ${orderId} gestartet`);
      
      // توليد HTML أولاً
      const htmlContent = await this.generateOrderHtml(orderId);
      
      // تحويل HTML إلى PDF
      const pdfBuffer = await this.convertHtmlToPdf(htmlContent);
      
      console.log(`✅ PDF Report generated successfully for order ${orderId}`);
      return pdfBuffer;
    }

    // تعديل دالة إرسال البريد الإلكتروني
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

    // إضافة route جديد لتوليد PDF
    async generateAndDownloadOrderPdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
      const pdfBuffer = await this.generateOrderPdf(orderId);
      const filename = `fahrzeuguebergabe-${orderId}-${this.formatDateForFilename(new Date())}.pdf`;
      
      return {
        buffer: pdfBuffer,
        filename
      };
    }


   
  }