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
    const htmlContent = await this.generateCompleteHtmlContent(order);
    console.log(`✅ HTML تم إنشاؤه بنجاح للطلبية ${orderId}`);
    return htmlContent;
  } catch (error) {
    console.error('❌ خطأ في إنشاء HTML:', error);
    throw new InternalServerErrorException('فشل في إنشاء ملف HTML');
  }
}

// دوال مساعدة مفقودة - أضف هذه الدوال في كلاس PdfService

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

private groupDamagesByType(damages: any[]): { [key: string]: any[] } {
  return damages.reduce((acc, damage) => {
    const type = damage.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(damage);
    return acc;
  }, {});
}

private getDamageTypeIcon(type: string): string {
  const icons = {
    'DENT_BUMP': '🔨',
    'STONE_CHIP': '🪨', 
    'SCRATCH_GRAZE': '✏️',
    'PAINT_DAMAGE': '🎨',
    'CRACK_BREAK': '💥',
    'MISSING': '❌'
  };
  return icons[type] || '⚠️';
}

private getVehicleSideIcon(side: string): string {
  const icons = {
    'FRONT': '🔼',
    'REAR': '🔽',
    'LEFT': '◀️', 
    'RIGHT': '▶️',
    'TOP': '🔺'
  };
  return icons[side] || '📍';
}

private getDamageSeverityLevel(damages: any[]): string {
  if (damages.length === 0) return 'NONE';
  if (damages.length <= 2) return 'LOW';
  if (damages.length <= 5) return 'MEDIUM';
  if (damages.length <= 8) return 'HIGH';
  return 'SEVERE';
}

private getDamageSeverityText(level: string): string {
  const severityTexts = {
    'NONE': 'Keine Schäden',
    'LOW': 'Geringe Schäden',
    'MEDIUM': 'Mittlere Schäden', 
    'HIGH': 'Hohe Schäden',
    'SEVERE': 'Schwere Schäden'
  };
  return severityTexts[level] || level;
}

private getMostDamagedSide(damages: any[]): string | null {
  if (damages.length === 0) return null;
  
  const sideCount = this.groupDamagesBySide(damages);
  const entries = Object.entries(sideCount);
  
  if (entries.length === 0) return null;
  
  const mostDamaged = entries.reduce((a, b) => 
    sideCount[a[0]].length > sideCount[b[0]].length ? a : b
  );
  
  return mostDamaged[0];
}

private getMostCommonDamageType(damages: any[]): string | null {
  if (damages.length === 0) return null;
  
  const typeCount = this.groupDamagesByType(damages);
  const entries = Object.entries(typeCount);
  
  if (entries.length === 0) return null;
  
  const mostCommon = entries.reduce((a, b) => 
    typeCount[a[0]].length > typeCount[b[0]].length ? a : b
  );
  
  return mostCommon[0];
}

private getUniqueDamageSides(damages: any[]): string[] {
  return [...new Set(damages.map(d => d.side))];
}

private getUniqueDamageTypes(damages: any[]): string[] {
  return [...new Set(damages.map(d => d.type))];
}

private calculateDamageStatistics(damages: any[]) {
  return {
    totalDamages: damages.length,
    damagesBySide: this.groupDamagesBySide(damages),
    damagesByType: this.groupDamagesByType(damages),
    mostDamagedSide: this.getMostDamagedSide(damages),
    mostCommonDamageType: this.getMostCommonDamageType(damages),
    hasDamages: damages.length > 0,
    sides: this.getUniqueDamageSides(damages),
    types: this.getUniqueDamageTypes(damages),
    damagesWithDescription: damages.filter(d => d.description && d.description.trim()).length,
    severityLevel: this.getDamageSeverityLevel(damages),
    severityText: this.getDamageSeverityText(this.getDamageSeverityLevel(damages))
  };
}

private formatDamageDescription(description: string | null): string {
  if (!description || !description.trim()) {
    return 'Keine detaillierte Beschreibung verfügbar';
  }
  
  // تنظيف وتنسيق الوصف
  return description.trim()
    .replace(/\n/g, '<br>')
    .replace(/\s+/g, ' ');
}

private getDamageCreatedDate(damage: any): string {
  if (!damage.createdAt) {
    return 'Datum unbekannt';
  }
  
  return this.formatGermanDate(new Date(damage.createdAt));
}

// دالة إضافية لإنشاء ملخص الأضرار
private generateDamageSummaryHtml(damages: any[]): string {
  if (!damages || damages.length === 0) {
    return `
      <div class="damage-summary success">
        <h4>✅ Fahrzeugzustand: Ausgezeichnet</h4>
        <p>Keine Schäden oder Mängel dokumentiert.</p>
      </div>
    `;
  }

  const stats = this.calculateDamageStatistics(damages);
  
  return `
    <div class="damage-summary warning">
      <h4>⚠️ Schadenszusammenfassung</h4>
      <div class="damage-stats">
        <div class="stat-row">
          <span class="stat-label">Gesamtschäden:</span>
          <span class="stat-value">${stats.totalDamages}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Betroffene Bereiche:</span>
          <span class="stat-value">${stats.sides.length}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Schadensschwere:</span>
          <span class="stat-value severity-${stats.severityLevel.toLowerCase()}">${stats.severityText}</span>
        </div>
        ${stats.mostDamagedSide ? `
        <div class="stat-row">
          <span class="stat-label">Meist betroffener Bereich:</span>
          <span class="stat-value">${this.getVehicleSideText(stats.mostDamagedSide)}</span>
        </div>
        ` : ''}
        ${stats.mostCommonDamageType ? `
        <div class="stat-row">
          <span class="stat-label">Häufigster Schadentyp:</span>
          <span class="stat-value">${this.getDamageTypeText(stats.mostCommonDamageType)}</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// دالة إضافية لتنسيق عنوان مفصل
private formatDetailedGermanAddress(address: any): string {
  if (!address) {
    return `
      <div class="no-data">
        <span class="no-data-icon">❌</span>
        <p>Adresse nicht verfügbar</p>
      </div>
    `;
  }

  let html = `
    <div class="address-main">
      <div class="address-line">
        <span class="address-icon">🏠</span>
        <span class="address-text">${address.street || 'Straße unbekannt'} ${address.houseNumber || ''}</span>
      </div>
      <div class="address-line">
        <span class="address-icon">📮</span>
        <span class="address-text">${address.zipCode || ''} ${address.city || 'Stadt unbekannt'}</span>
      </div>
      <div class="address-line">
        <span class="address-icon">🌍</span>
        <span class="address-text">${address.country || 'Deutschland'}</span>
      </div>
    </div>
  `;

  // إضافة معلومات إضافية إذا توفرت
  const additionalInfo = [];
  
  if (address.date) {
    additionalInfo.push({
      icon: '📅',
      label: 'Termin',
      value: this.formatGermanDateTime(new Date(address.date))
    });
  }
  
  if (address.companyName) {
    additionalInfo.push({
      icon: '🏢',
      label: 'Unternehmen',
      value: address.companyName
    });
  }

  if (address.contactPersonName) {
    additionalInfo.push({
      icon: '👤',
      label: 'Ansprechpartner',
      value: address.contactPersonName
    });
  }

  if (address.contactPersonPhone) {
    additionalInfo.push({
      icon: '📞',
      label: 'Telefon',
      value: address.contactPersonPhone
    });
  }

  if (address.contactPersonEmail) {
    additionalInfo.push({
      icon: '📧', 
      label: 'E-Mail',
      value: address.contactPersonEmail
    });
  }

  if (address.fuelLevel !== null && address.fuelLevel !== undefined) {
    const percentage = ((address.fuelLevel / 8) * 100).toFixed(1);
    additionalInfo.push({
      icon: '⛽',
      label: 'Tankstand',
      value: `${address.fuelLevel}/8 (${percentage}%)`
    });
  }

  if (address.fuelMeter !== null && address.fuelMeter !== undefined) {
    additionalInfo.push({
      icon: '🔢',
      label: 'Kilometerstand', 
      value: `${address.fuelMeter.toLocaleString('de-DE')} km`
    });
  }

  if (additionalInfo.length > 0) {
    html += `
      <div class="address-additional">
        <h5>Zusätzliche Informationen:</h5>
        <div class="additional-grid">
    `;
    
    additionalInfo.forEach(info => {
      html += `
        <div class="additional-item">
          <span class="additional-icon">${info.icon}</span>
          <div class="additional-content">
            <span class="additional-label">${info.label}:</span>
            <span class="additional-value">${info.value}</span>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  }

  return html;
}

private async generateCompleteHtmlContent(order: any): Promise<string> {
  // تحضير البيانات
  const currentDate = this.formatGermanDateTime(new Date());
  const logoBase64 = await this.getLogoAsBase64();
  const imagesHtml = await this.generateImagesHtml(order.images);
  const signaturesHtml = await this.generateSignaturesHtml([order.driverSignature, order.customerSignature].filter(Boolean));
  const damagesHtml = this.generateDamagesHtml(order.damages || []);
  const vehicleItemsHtml = this.generateVehicleItemsHtml(order.items || []);

  return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fahrzeugübergabebericht - ${order.orderNumber}</title>
    <style>
        ${this.getEnhancedHtmlStyles()}
    </style>
</head>
<body>
    <!-- Print Controls -->
    <div class="print-controls no-print">
        <button onclick="window.print()" class="print-btn">🖨️ Dokument drucken</button>
        <button onclick="window.close()" class="close-btn">❌ Schließen</button>
    </div>

    <!-- COVER PAGE -->
    <div class="cover-page">
        <div class="header-section">
            <div class="logo-container">
                ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Logo" class="logo">` : '<div class="logo-placeholder">🏢<br>LOGO</div>'}
            </div>
            <div class="header-content">
                <h1 class="main-title">FAHRZEUGÜBERGABE</h1>
                <h2 class="sub-title">VOLLSTÄNDIGER BERICHT</h2>
                <p class="header-description">Umfassende Dokumentation der Fahrzeugübergabe mit allen Details</p>
            </div>
        </div>
        
        <div class="order-info-card">
            <h3>📋 Auftragsinformationen</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Auftragsnummer:</span>
                    <span class="info-value highlight">${order.orderNumber}</span>
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
                    <span class="info-value">${this.translateServiceType(order.service?.serviceType)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Fahrzeugtyp:</span>
                    <span class="info-value">${order.service?.vehicleType || 'Nicht angegeben'}</span>
                </div>
            </div>
        </div>
        
        <div class="statistics-card">
            <h3>📊 Dokumentationsübersicht</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-icon">📷</span>
                    <span class="stat-number">${(order.images || []).length}</span>
                    <span class="stat-label">Bilder</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">✍️</span>
                    <span class="stat-number">${[order.driverSignature, order.customerSignature].filter(Boolean).length}/2</span>
                    <span class="stat-label">Unterschriften</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">⚠️</span>
                    <span class="stat-number">${(order.damages || []).length}</span>
                    <span class="stat-label">Schäden</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">💰</span>
                    <span class="stat-number">${order.expenses ? '✓' : '❌'}</span>
                    <span class="stat-label">Kosten</span>
                </div>
            </div>
        </div>
        
        <div class="cover-footer">
            <p>Erstellt am: ${currentDate}</p>
            <p>Fahrzeugübergabe-Managementsystem</p>
        </div>
    </div>

    <!-- TABLE OF CONTENTS -->
    <div class="page-break">
        <div class="section-header">
            <h1>📑 INHALTSVERZEICHNIS</h1>
        </div>
        
        <div class="toc-container">
            <div class="toc-item">
                <span class="toc-title">1. Kundeninformationen</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 3</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">2. Fahrzeugdaten</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 4</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">3. Serviceinformationen</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 5</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">4. Standortinformationen</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 6</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">5. Fahrzeugausstattung</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 7</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">6. Schadensdokumentation</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 8</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">7. Bilddokumentation</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 9</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">8. Unterschriftennachweis</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 10</span>
            </div>
            <div class="toc-item">
                <span class="toc-title">9. Kostenaufstellung</span>
                <span class="toc-dots"></span>
                <span class="toc-page">Seite 11</span>
            </div>
        </div>
    </div>

    <!-- 1. CUSTOMER INFORMATION -->
    <div class="page-break">
        <div class="section-header">
            <h1>👤 1. KUNDENINFORMATIONEN</h1>
        </div>
        
        <!-- Client Information -->
        <div class="content-card">
            <h3>📋 Hauptkunde</h3>
            <div class="customer-grid">
                <div class="customer-item primary">
                    <span class="customer-icon">👤</span>
                    <div class="customer-content">
                        <span class="customer-label">Name</span>
                        <span class="customer-value">${order.client || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="customer-item">
                    <span class="customer-icon">📞</span>
                    <div class="customer-content">
                        <span class="customer-label">Telefonnummer</span>
                        <span class="customer-value">${order.clientPhone || 'Nicht verfügbar'}</span>
                    </div>
                </div>
                <div class="customer-item">
                    <span class="customer-icon">📧</span>
                    <div class="customer-content">
                        <span class="customer-label">E-Mail</span>
                        <span class="customer-value">${order.clientEmail || 'Nicht verfügbar'}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Client Address -->
        ${order.clientAddress ? `
        <div class="content-card">
            <h3>🏠 Kundenadresse</h3>
            <div class="address-content">
                ${this.formatGermanAddress(order.clientAddress)}
            </div>
        </div>` : ''}

        <!-- Billing Information -->
        <div class="content-card">
            <h3>💳 Rechnungsinformationen</h3>
            <div class="billing-info">
                <div class="billing-same">
                    <span class="billing-icon">${order.isSameBilling ? '✅' : '❌'}</span>
                    <span class="billing-text">
                        ${order.isSameBilling ? 'Rechnungsadresse identisch mit Kundenadresse' : 'Separate Rechnungsadresse'}
                    </span>
                </div>
                
                ${!order.isSameBilling ? `
                <div class="billing-details">
                    <div class="billing-grid">
                        <div class="billing-item">
                            <span class="billing-label">Rechnungsname:</span>
                            <span class="billing-value">${order.billingName || 'Nicht angegeben'}</span>
                        </div>
                        <div class="billing-item">
                            <span class="billing-label">Telefonnummer:</span>
                            <span class="billing-value">${order.billingPhone || 'Nicht verfügbar'}</span>
                        </div>
                        <div class="billing-item">
                            <span class="billing-label">E-Mail:</span>
                            <span class="billing-value">${order.billingEmail || 'Nicht verfügbar'}</span>
                        </div>
                    </div>
                    ${order.billingAddress ? `
                    <div class="billing-address">
                        <h4>📍 Rechnungsadresse</h4>
                        ${this.formatGermanAddress(order.billingAddress)}
                    </div>` : ''}
                </div>` : ''}
            </div>
        </div>

        <!-- Driver Information -->
        ${order.driver ? `
        <div class="content-card">
            <h3>🚗 Fahrerinformationen</h3>
            <div class="driver-grid">
                <div class="driver-item">
                    <span class="driver-icon">👨‍💼</span>
                    <div class="driver-content">
                        <span class="driver-label">Fahrername</span>
                        <span class="driver-value">${order.driver.name || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="driver-item">
                    <span class="driver-icon">📧</span>
                    <div class="driver-content">
                        <span class="driver-label">E-Mail</span>
                        <span class="driver-value">${order.driver.email || 'Nicht verfügbar'}</span>
                    </div>
                </div>
                ${order.driver.phone ? `
                <div class="driver-item">
                    <span class="driver-icon">📞</span>
                    <div class="driver-content">
                        <span class="driver-label">Telefonnummer</span>
                        <span class="driver-value">${order.driver.phone}</span>
                    </div>
                </div>` : ''}
            </div>
        </div>` : ''}
    </div>

    <!-- 2. VEHICLE INFORMATION -->
    <div class="page-break">
        <div class="section-header">
            <h1>🚗 2. FAHRZEUGDATEN</h1>
        </div>
        
        <!-- Basic Vehicle Data -->
        <div class="content-card">
            <h3>🔍 Grunddaten</h3>
            <div class="vehicle-grid">
                <div class="vehicle-item primary">
                    <span class="vehicle-icon">🚗</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Kennzeichen</span>
                        <span class="vehicle-value highlight">${order.vehicleData?.licensePlateNumber || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item primary">
                    <span class="vehicle-icon">👤</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Fahrzeughalter</span>
                        <span class="vehicle-value">${order.vehicleData?.vehicleOwner || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🔢</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">VIN</span>
                        <span class="vehicle-value">${order.vehicleData?.vin || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🆔</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">FIN</span>
                        <span class="vehicle-value">${order.vehicleData?.fin || 'Nicht angegeben'}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Technical Specifications -->
        <div class="content-card">
            <h3>🔧 Technische Daten</h3>
            <div class="vehicle-grid">
                <div class="vehicle-item">
                    <span class="vehicle-icon">🏭</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Marke</span>
                        <span class="vehicle-value">${order.vehicleData?.brand || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🚙</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Modell</span>
                        <span class="vehicle-value">${order.vehicleData?.model || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">📅</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Baujahr</span>
                        <span class="vehicle-value">${order.vehicleData?.year || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🎨</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Farbe</span>
                        <span class="vehicle-value">${order.vehicleData?.color || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">🔤</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Typ</span>
                        <span class="vehicle-value">${order.vehicleData?.typ || 'Nicht angegeben'}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Administrative Data -->
        <div class="content-card">
            <h3>📋 Verwaltungsdaten</h3>
            <div class="vehicle-grid">
                <div class="vehicle-item">
                    <span class="vehicle-icon">🏢</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">ÜKZ</span>
                        <span class="vehicle-value">${order.vehicleData?.ukz || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">📄</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Bestellnummer</span>
                        <span class="vehicle-value">${order.vehicleData?.bestellnummer || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">📑</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Leasingvertragsnummer</span>
                        <span class="vehicle-value">${order.vehicleData?.leasingvertragsnummer || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="vehicle-item">
                    <span class="vehicle-icon">💼</span>
                    <div class="vehicle-content">
                        <span class="vehicle-label">Kostenstelle</span>
                        <span class="vehicle-value">${order.vehicleData?.kostenstelle || 'Nicht angegeben'}</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Vehicle Notes -->
        ${order.vehicleData?.bemerkung ? `
        <div class="content-card">
            <h3>💬 Fahrzeugbemerkungen</h3>
            <div class="description-content">
                <p>${order.vehicleData.bemerkung}</p>
            </div>
        </div>` : ''}
    </div>

    <!-- 3. SERVICE INFORMATION -->
    <div class="page-break">
        <div class="section-header">
            <h1>🔧 3. SERVICEINFORMATIONEN</h1>
        </div>
        
        <div class="content-card">
            <h3>🛠️ Service Details</h3>
            <div class="service-grid">
                <div class="service-item primary">
                    <span class="service-icon">🚛</span>
                    <div class="service-content">
                        <span class="service-label">Fahrzeugtyp</span>
                        <span class="service-value">${order.service?.vehicleType || 'Nicht angegeben'}</span>
                    </div>
                </div>
                <div class="service-item primary">
                    <span class="service-icon">⚙️</span>
                    <div class="service-content">
                        <span class="service-label">Servicetyp</span>
                        <span class="service-value">${this.translateServiceType(order.service?.serviceType)}</span>
                    </div>
                </div>
            </div>
        </div>

        ${order.service?.description ? `
        <div class="content-card">
            <h3>📝 Servicebeschreibung</h3>
            <div class="description-content">
                <p>${order.service.description}</p>
            </div>
        </div>` : ''}

        ${order.description ? `
        <div class="content-card">
            <h3>📋 Auftragsbeschreibung</h3>
            <div class="description-content">
                <p>${order.description}</p>
            </div>
        </div>` : ''}

        ${order.comments ? `
        <div class="content-card">
            <h3>💭 Zusätzliche Kommentare</h3>
            <div class="description-content">
                <p>${order.comments}</p>
            </div>
        </div>` : ''}
    </div>

    <!-- 4. LOCATION INFORMATION -->
    <div class="page-break">
        <div class="section-header">
            <h1>📍 4. STANDORTINFORMATIONEN</h1>
        </div>
        
        <div class="locations-container">
            <!-- Pickup Address -->
            <div class="location-card pickup">
                <div class="location-header">
                    <span class="location-icon">📍</span>
                    <h3>Abholadresse</h3>
                </div>
                <div class="location-content">
                    ${this.formatDetailedAddress(order.pickupAddress, 'pickup')}
                </div>
            </div>

            <!-- Delivery Address -->
            <div class="location-card delivery">
                <div class="location-header">
                    <span class="location-icon">🎯</span>
                    <h3>Lieferadresse</h3>
                </div>
                <div class="location-content">
                    ${this.formatDetailedAddress(order.deliveryAddress, 'delivery')}
                </div>
            </div>
        </div>
    </div>

    <!-- 5. VEHICLE EQUIPMENT -->
    <div class="page-break">
        <div class="section-header">
            <h1>🎒 5. FAHRZEUGAUSSTATTUNG</h1>
        </div>
        ${vehicleItemsHtml}
    </div>

    <!-- 6. DAMAGE DOCUMENTATION -->
    <div class="page-break">
        <div class="section-header">
            <h1>⚠️ 6. SCHADENSDOKUMENTATION</h1>
        </div>
        ${damagesHtml}
    </div>

    <!-- 7. IMAGE DOCUMENTATION -->
    <div class="page-break">
        <div class="section-header">
            <h1>📷 7. BILDDOKUMENTATION</h1>
        </div>
        ${imagesHtml}
    </div>

    <!-- 8. SIGNATURES -->
    <div class="page-break">
        <div class="section-header">
            <h1>✍️ 8. UNTERSCHRIFTENNACHWEIS</h1>
        </div>
        
        <div class="legal-notice">
            <div class="notice-icon">ℹ️</div>
            <div class="notice-content">
                <p><strong>Rechtlicher Hinweis:</strong> Die nachfolgenden digitalen Unterschriften entsprechen den Anforderungen des deutschen Signaturgesetzes (SigG) für einfache elektronische Signaturen.</p>
            </div>
        </div>
        
        ${signaturesHtml}
    </div>

    <!-- 9. EXPENSES -->
    <div class="page-break">
        <div class="section-header">
            <h1>💰 9. KOSTENAUFSTELLUNG</h1>
        </div>
        ${this.generateExpensesHtml(order.expenses)}
    </div>

    <!-- FOOTER PAGE -->
    <div class="page-break">
        <div class="footer-page">
            <div class="footer-content">
                <h2>📋 DOKUMENTATIONSABSCHLUSS</h2>
                <p>Dieser Bericht wurde automatisch generiert und enthält alle verfügbaren Informationen zum Zeitpunkt der Erstellung.</p>
                
                <div class="document-info">
                    <div class="info-row">
                        <span class="info-label">Dokument erstellt:</span>
                        <span class="info-value">${currentDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Auftragsnummer:</span>
                        <span class="info-value">${order.orderNumber}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status:</span>
                        <span class="info-value">${this.translateStatus(order.status)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Gesamtseiten:</span>
                        <span class="info-value">11 Seiten</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>`;
}

// دوال مساعدة جديدة

private formatDetailedAddress(address: any, type: 'pickup' | 'delivery'): string {
  if (!address) {
    return `
      <div class="no-data">
        <span class="no-data-icon">❌</span>
        <p>Adresse nicht verfügbar</p>
      </div>
    `;
  }

  return `
    <div class="address-basic">
      <p class="address-line">${address.street || ''} ${address.houseNumber || ''}`.trim() + `</p>
      <p class="address-line">${address.zipCode || ''} ${address.city || ''}</p>
      <p class="address-line">${address.country || 'Deutschland'}</p>
    </div>

    ${address.date ? `
    <div class="address-timing">
      <span class="timing-icon">📅</span>
      <div class="timing-content">
        <span class="timing-label">${type === 'pickup' ? 'Abholtermin' : 'Liefertermin'}:</span>
        <span class="timing-value">${this.formatGermanDateTime(new Date(address.date))}</span>
      </div>
    </div>` : ''}

    ${address.companyName ? `
    <div class="address-company">
      <span class="company-icon">🏢</span>
      <div class="company-content">
        <span class="company-label">Unternehmen:</span>
        <span class="company-value">${address.companyName}</span>
      </div>
    </div>` : ''}

    ${address.contactPersonName || address.contactPersonPhone || address.contactPersonEmail ? `
    <div class="contact-info">
      <h4 class="contact-header">👤 Ansprechpartner</h4>
      ${address.contactPersonName ? `
      <div class="contact-item">
        <span class="contact-icon">👨‍💼</span>
        <span class="contact-label">Name:</span>
        <span class="contact-value">${address.contactPersonName}</span>
      </div>` : ''}
      ${address.contactPersonPhone ? `
      <div class="contact-item">
        <span class="contact-icon">📞</span>
        <span class="contact-label">Telefon:</span>
        <span class="contact-value">${address.contactPersonPhone}</span>
      </div>` : ''}
      ${address.contactPersonEmail ? `
      <div class="contact-item">
        <span class="contact-icon">📧</span>
        <span class="contact-label">E-Mail:</span>
        <span class="contact-value">${address.contactPersonEmail}</span>
      </div>` : ''}
    </div>` : ''}

    ${address.fuelLevel !== null || address.fuelMeter !== null ? `
    <div class="fuel-info">
      <h4 class="fuel-header">⛽ Kraftstoffinformationen</h4>
      ${address.fuelLevel !== null ? `
      <div class="fuel-item">
        <span class="fuel-icon">📊</span>
        <span class="fuel-label">Tankfüllung:</span>
        <span class="fuel-value">${address.fuelLevel}/8 (${((address.fuelLevel / 8) * 100).toFixed(1)}%)</span>
      </div>` : ''}
      ${address.fuelMeter !== null ? `
      <div class="fuel-item">
        <span class="fuel-icon">🔢</span>
        <span class="fuel-label">Kilometerstand:</span>
        <span class="fuel-value">${address.fuelMeter.toLocaleString('de-DE')} km</span>
      </div>` : ''}
    </div>` : ''}
  `;
}

private generateVehicleItemsHtml(items: string[]): string {
  if (!items || items.length === 0) {
    return `
      <div class="no-data">
        <span class="no-data-icon">📦</span>
        <p>Keine Fahrzeugausstattung dokumentiert</p>
      </div>
    `;
  }

  const categorizedItems = this.categorizeVehicleItems(items);
  let html = '';

  Object.entries(categorizedItems).forEach(([category, categoryItems]) => {
    html += `
      <div class="content-card">
        <h3>${this.getItemCategoryIcon(category)} ${this.translateItemCategory(category)}</h3>
        <div class="items-grid">
    `;
    
    categoryItems.forEach(item => {
      const itemInfo = this.getVehicleItemInfo(item);
      html += `
        <div class="item-card ${itemInfo.available ? 'available' : 'missing'}">
          <span class="item-icon">${itemInfo.icon}</span>
          <div class="item-content">
            <span class="item-name">${itemInfo.name}</span>
            <span class="item-status">${itemInfo.available ? 'Vorhanden' : 'Fehlend'}</span>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  return html;
}

private generateDamagesHtml(damages: any[]): string {
  if (!damages || damages.length === 0) {
    return `
      <div class="no-data-success">
        <span class="no-data-icon">✅</span>
        <p><strong>Keine Schäden dokumentiert</strong></p>
        <p>Das Fahrzeug wurde ohne erkennbare Schäden übergeben.</p>
      </div>
    `;
  }

  const damagesBySide = this.groupDamagesBySide(damages);
  let html = `
    <div class="damages-summary">
      <div class="summary-card">
        <span class="summary-icon">⚠️</span>
        <div class="summary-content">
          <span class="summary-number">${damages.length}</span>
          <span class="summary-label">Schäden dokumentiert</span>
        </div>
      </div>
      <div class="summary-card">
        <span class="summary-icon">📍</span>
        <div class="summary-content">
          <span class="summary-number">${Object.keys(damagesBySide).length}</span>
          <span class="summary-label">Betroffene Bereiche</span>
        </div>
      </div>
    </div>
  `;

  // Vehicle diagram with damages
  html += `
    <div class="content-card">
      <h3>🚗 Schadenübersicht nach Fahrzeugbereich</h3>
      <div class="vehicle-diagram">
        ${this.generateVehicleDiagram(damagesBySide)}
      </div>
    </div>
  `;

  // Detailed damage list
  Object.entries(damagesBySide).forEach(([side, sideDamages]) => {
    html += `
      <div class="content-card">
        <h3>${this.getVehicleSideIcon(side)} ${this.getVehicleSideText(side as any)}</h3>
        <div class="damages-list">
    `;
    
    (sideDamages as any[]).forEach((damage, index) => {
      html += `
        <div class="damage-item">
          <div class="damage-header">
            <span class="damage-number">#${index + 1}</span>
            <span class="damage-type">${this.getDamageTypeIcon(damage.type)} ${this.getDamageTypeText(damage.type)}</span>
            <span class="damage-date">${this.formatGermanDate(new Date(damage.createdAt))}</span>
          </div>
          ${damage.description ? `
          <div class="damage-description">
            <span class="description-icon">📝</span>
            <span class="description-text">${damage.description}</span>
          </div>` : ''}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  return html;
}

private categorizeVehicleItems(items: string[]): { [key: string]: string[] } {
  const categories = {
    'SAFETY': ['SAFETY_VEST', 'WARNING_TRIANGLE', 'FIRST_AID_KIT'],
    'TIRES': ['WINTER_TIRES', 'SUMMER_TIRES', 'ALLOY_WHEELS', 'HUBCAPS', 'SECOND_SET_OF_TIRES', 'EMERGENCY_WHEEL', 'SPARE_TIRE'],
    'TOOLS': ['TOOLS_JACK', 'COMPRESSOR_REPAIR_KIT'],
    'INTERIOR': ['PARTITION_NET', 'REAR_PARCEL_SHELF', 'TRUNK_ROLL_COVER'],
    'ELECTRONICS': ['NAVIGATION_SYSTEM', 'RADIO', 'ANTENNA'],
    'DOCUMENTS': ['OPERATING_MANUAL', 'REGISTRATION_DOCUMENT', 'SERVICE_BOOK', 'FUEL_CARD'],
    'KEYS': ['VEHICLE_KEYS']
  };

  const categorized: { [key: string]: string[] } = {};
  
  Object.entries(categories).forEach(([category, categoryItems]) => {
    const foundItems = items.filter(item => categoryItems.includes(item));
    if (foundItems.length > 0) {
      categorized[category] = foundItems;
    }
  });

  // Add uncategorized items
  const categorizedItems = Object.values(categorized).flat();
  const uncategorized = items.filter(item => !categorizedItems.includes(item));
  if (uncategorized.length > 0) {
    categorized['OTHER'] = uncategorized;
  }

  return categorized;
}

private getItemCategoryIcon(category: string): string {
  const icons = {
    'SAFETY': '🦺',
    'TIRES': '🛞',
    'TOOLS': '🔧',
    'INTERIOR': '🪑',
    'ELECTRONICS': '📱',
    'DOCUMENTS': '📄',
    'KEYS': '🗝️',
    'OTHER': '📦'
  };
  return icons[category] || '📦';
}

private translateItemCategory(category: string): string {
  const translations = {
    'SAFETY': 'Sicherheitsausrüstung',
    'TIRES': 'Reifen & Räder',
    'TOOLS': 'Werkzeuge',
    'INTERIOR': 'Innenausstattung',
    'ELECTRONICS': 'Elektronik',
    'DOCUMENTS': 'Dokumente',
    'KEYS': 'Schlüssel',
    'OTHER': 'Sonstiges'
  };
  return translations[category] || 'Sonstiges';
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

private generateVehicleDiagram(damagesBySide: { [key: string]: any[] }): string {
  return `
    <div class="vehicle-outline">
      <div class="vehicle-part front ${damagesBySide['FRONT'] ? 'has-damage' : ''}">
        <span class="part-label">FRONT</span>
        ${damagesBySide['FRONT'] ? `<span class="damage-count">${damagesBySide['FRONT'].length}</span>` : ''}
      </div>
      <div class="vehicle-middle">
        <div class="vehicle-part left ${damagesBySide['LEFT'] ? 'has-damage' : ''}">
          <span class="part-label">LINKS</span>
          ${damagesBySide['LEFT'] ? `<span class="damage-count">${damagesBySide['LEFT'].length}</span>` : ''}
        </div>
        <div class="vehicle-part top ${damagesBySide['TOP'] ? 'has-damage' : ''}">
          <span class="part-label">DACH</span>
          ${damagesBySide['TOP'] ? `<span class="damage-count">${damagesBySide['TOP'].length}</span>` : ''}
        </div>
        <div class="vehicle-part right ${damagesBySide['RIGHT'] ? 'has-damage' : ''}">
          <span class="part-label">RECHTS</span>
          ${damagesBySide['RIGHT'] ? `<span class="damage-count">${damagesBySide['RIGHT'].length}</span>` : ''}
        </div>
      </div>
      <div class="vehicle-part rear ${damagesBySide['REAR'] ? 'has-damage' : ''}">
        <span class="part-label">HECK</span>
        ${damagesBySide['REAR'] ? `<span class="damage-count">${damagesBySide['REAR'].length}</span>` : ''}
      </div>
    </div>
  `;
}


private getEnhancedHtmlStyles(): string {
  return `
    ${this.getGermanHtmlStyles()}
    
    /* Enhanced Styles for New Features */
    .highlight {
      background: linear-gradient(120deg, #a8e6cf 0%, #dcedc1 100%);
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }

    .statistics-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 12px;
      margin: 20px 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-top: 20px;
    }

    .stat-item {
      text-align: center;
      background: rgba(255,255,255,0.1);
      padding: 15px;
      border-radius: 8px;
    }

    .stat-icon {
      font-size: 24px;
      display: block;
      margin-bottom: 8px;
    }

    .stat-number {
      font-size: 28px;
      font-weight: bold;
      display: block;
      margin-bottom: 5px;
    }

    .stat-label {
      font-size: 12px;
      opacity: 0.9;
    }

    /* Customer & Driver Styles */
    .customer-grid, .driver-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 15px;
    }

    .customer-item, .driver-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #3498db;
    }

    .customer-item.primary, .driver-item.primary {
      border-left-color: #e74c3c;
      background: #fdf2f2;
    }

    .customer-icon, .driver-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .customer-content, .driver-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .customer-label, .driver-label {
      font-size: 12px;
      color: #7f8c8d;
      font-weight: 600;
      text-transform: uppercase;
    }

    .customer-value, .driver-value {
      font-weight: 500;
      color: #2c3e50;
    }

    /* Billing Information */
    .billing-info {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
    }

    .billing-same {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 15px;
      background: white;
      border-radius: 6px;
      margin-bottom: 15px;
    }

    .billing-icon {
      font-size: 20px;
    }

    .billing-text {
      font-weight: 500;
    }

    .billing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .billing-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .billing-label {
      font-size: 12px;
      color: #7f8c8d;
      font-weight: 600;
    }

    .billing-value {
      font-weight: 500;
      color: #2c3e50;
    }

    /* Service Styles */
    .service-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 15px;
    }

    .service-item {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #27ae60;
    }

    .service-item.primary {
      border-left-color: #e74c3c;
      background: #fdf2f2;
    }

    .service-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .service-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .service-label {
      font-size: 12px;
      color: #7f8c8d;
      font-weight: 600;
      text-transform: uppercase;
    }

    .service-value {
      font-weight: 500;
      color: #2c3e50;
    }

    /* Location Styles */
    .locations-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
    }

    .location-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      border-top: 4px solid;
    }

    .location-card.pickup {
      border-top-color: #3498db;
    }

    .location-card.delivery {
      border-top-color: #27ae60;
    }

    .location-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }

    .location-icon {
      font-size: 24px;
    }

    .address-basic {
      margin-bottom: 15px;
    }

    .address-timing, .address-company {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
      margin-bottom: 10px;
    }

    .timing-icon, .company-icon {
      font-size: 18px;
    }

    .timing-content, .company-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .timing-label, .company-label {
      font-size: 11px;
      color: #7f8c8d;
      font-weight: 600;
    }

    .timing-value, .company-value {
      font-weight: 500;
      color: #2c3e50;
    }

    .contact-info, .fuel-info {
      background: #e3f2fd;
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
    }

    .contact-header, .fuel-header {
      font-size: 14px;
      font-weight: 600;
      color: #2980b9;
      margin-bottom: 10px;
    }

    .contact-item, .fuel-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }

    .contact-icon, .fuel-icon {
      font-size: 16px;
    }

    .contact-label, .fuel-label {
      font-size: 12px;
      color: #7f8c8d;
      font-weight: 600;
      min-width: 60px;
    }

    .contact-value, .fuel-value {
      font-weight: 500;
      color: #2c3e50;
    }

    /* Vehicle Items */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .item-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      border: 2px solid;
    }

    .item-card.available {
      background: #eafaf1;
      border-color: #27ae60;
    }

    .item-card.missing {
      background: #fdf2f2;
      border-color: #e74c3c;
    }

    .item-icon {
      font-size: 20px;
    }

    .item-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item-name {
      font-weight: 500;
      color: #2c3e50;
      font-size: 13px;
    }

    .item-status {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .item-card.available .item-status {
      color: #27ae60;
    }

    .item-card.missing .item-status {
      color: #e74c3c;
    }

    /* Damages */
    .no-data-success {
      text-align: center;
      color: #27ae60;
      padding: 40px;
      background: #eafaf1;
      border-radius: 8px;
      border: 2px solid #27ae60;
    }

    .damages-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .summary-card {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 20px;
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
    }

    .summary-icon {
      font-size: 32px;
    }

    .summary-content {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .summary-number {
      font-size: 24px;
      font-weight: bold;
      color: #856404;
    }

    .summary-label {
      font-size: 12px;
      color: #856404;
      font-weight: 500;
    }

    .vehicle-diagram {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 12px;
      margin: 20px 0;
    }

    .vehicle-outline {
      display: grid;
      grid-template-areas: 
        "front front"
        "middle middle"
        "rear rear";
      gap: 10px;
      max-width: 400px;
      margin: 0 auto;
    }

    .vehicle-part {
      background: #e9ecef;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      position: relative;
      transition: all 0.3s ease;
    }

    .vehicle-part.front {
      grid-area: front;
    }

    .vehicle-part.rear {
      grid-area: rear;
    }

    .vehicle-middle {
      grid-area: middle;
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      gap: 10px;
    }

    .vehicle-part.has-damage {
      background: #f8d7da;
      border-color: #dc3545;
      color: #721c24;
    }

    .part-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .damage-count {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #dc3545;
      color: white;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }

    .damages-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .damage-item {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
    }

    .damage-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 10px;
    }

    .damage-number {
      background: #ffc107;
      color: #856404;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    .damage-type {
      flex: 1;
      font-weight: 500;
      color: #856404;
    }

    .damage-date {
      font-size: 12px;
      color: #6c757d;
    }

    .damage-description {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: white;
      padding: 10px;
      border-radius: 6px;
    }

    .description-icon {
      font-size: 16px;
      margin-top: 2px;
    }

    .description-text {
      flex: 1;
      font-size: 14px;
      line-height: 1.4;
    }

    /* Footer Page */
    .footer-page {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    }

    .footer-content {
      text-align: center;
      max-width: 600px;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }

    .footer-content h2 {
      color: #2c3e50;
      margin-bottom: 20px;
    }

    .document-info {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #dee2e6;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 600;
      color: #495057;
    }

    .info-value {
      color: #2c3e50;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .locations-container {
        grid-template-columns: 1fr;
      }
      
      .customer-grid, .driver-grid, .service-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
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