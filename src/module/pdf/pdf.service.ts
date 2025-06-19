// src/pdf/pdf.service.ts - إصدار احترافي محسّن
import { Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PdfService {
  constructor(private prisma: PrismaService) {}

  async generateOrderPdf(orderId: string): Promise<Buffer> {
    console.log(`📄 إنشاء PDF للطلبية ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        vehicleData: true,
        service: true,
        driver: true,
        images: true,
        driverSignature: true ,
        customerSignature: true ,
        expenses: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`الطلبية ${orderId} غير موجودة`);
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        bufferPages: true
      });
      
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        this.generatePdfContent(doc, order);
        doc.end();
      } catch (error) {
        console.error('❌ خطأ في إنشاء PDF:', error);
        reject(error);
      }
    });
  }

  private generatePdfContent(doc: PDFKit.PDFDocument, order: any) {
    let currentY = 40;

    // === HEADER ===
    currentY = this.addHeader(doc, order, currentY);
    
    // === MAIN CONTENT TABLE ===
    currentY = this.addMainContentTable(doc, order, currentY);
    
    // === ADDRESSES SECTION ===
    currentY = this.addAddressesSection(doc, order, currentY);
    
    // === VEHICLE DETAILS ===
    currentY = this.addVehicleDetails(doc, order, currentY);
    
    // === EXPENSES ===
    currentY = this.addExpensesSection(doc, order, currentY);
    
    // === COMMENTS ===
    if (order.comments) {
      currentY = this.addCommentsSection(doc, order, currentY);
    }
    
    // === SIGNATURES ===
    currentY = this.addSignaturesSection(doc, order, currentY);
    
    // === FOOTER ===
    this.addFooter(doc, order);
  }

  private addHeader(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    // Company Header
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('Car Handover Report', { align: 'center' });
    
    currentY += 30;
    
    // Order Number Box
    const boxY = currentY;
    doc.rect(40, boxY, 515, 60)
       .stroke();
    
    // Order Details in Box
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(`Auftragsnummer: ${order.orderNumber}`, 60, boxY + 15);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Datum: ${this.formatGermanDate(order.createdAt)}`, 60, boxY + 35)
       .text(`Fahrer: ${order.driver.name}`, 300, boxY + 35);
    
    return boxY + 80;
  }

  private addMainContentTable(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    // Service Type Section
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Service', 60, currentY);
    
    const serviceBoxY = currentY + 20;
    doc.rect(60, serviceBoxY, 100, 80).stroke();
    
    // Service checkboxes
    if (order.service) {
      doc.fontSize(10)
         .font('Helvetica');
      
      const isWash = order.service.serviceType === 'VEHICLE_WASH';
      const isRegistration = order.service.serviceType === 'REGISTRATION';
      
      doc.text('☐ Fahrzeugwäsche', 70, serviceBoxY + 10);
      doc.text('☐ Zulassung', 70, serviceBoxY + 30);
      
      if (isWash) {
        doc.text('☑', 70, serviceBoxY + 10);
      }
      if (isRegistration) {
        doc.text('☑', 70, serviceBoxY + 30);
      }
    }
    
    // Vehicle Type
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Kfz-Typ:', 200, serviceBoxY + 10);
    
    if (order.service?.vehicleType) {
      doc.font('Helvetica')
         .text(order.service.vehicleType, 200, serviceBoxY + 25);
    }
    
    return serviceBoxY + 100;
  }

  private addAddressesSection(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    // Two columns for pickup and delivery
    const leftColX = 60;
    const rightColX = 320;
    const colWidth = 215;
    const sectionHeight = 140;
    
    // Pickup Address (Abholung)
    doc.rect(leftColX, currentY, colWidth, sectionHeight).stroke();
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Abholung:', leftColX + 10, currentY + 10);
    
    if (order.pickupAddress) {
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Datum/Uhrzeit: ${this.formatGermanDate(order.createdAt)}`, leftColX + 10, currentY + 30)
         .text(`Straße: ${order.pickupAddress.street} ${order.pickupAddress.houseNumber}`, leftColX + 10, currentY + 50)
         .text(`PLZ, Ort: ${order.pickupAddress.zipCode} ${order.pickupAddress.city}`, leftColX + 10, currentY + 70)
         .text(`Land: ${order.pickupAddress.country}`, leftColX + 10, currentY + 90);
    }
    
    // Delivery Address (Ziel)
    doc.rect(rightColX, currentY, colWidth, sectionHeight).stroke();
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Ziel:', rightColX + 10, currentY + 10);
    
    if (order.deliveryAddress) {
      doc.fontSize(10)
         .font('Helvetica')
         .text(`Datum/Uhrzeit: ${this.formatGermanDate(order.createdAt)}`, rightColX + 10, currentY + 30)
         .text(`Straße: ${order.deliveryAddress.street} ${order.deliveryAddress.houseNumber}`, rightColX + 10, currentY + 50)
         .text(`PLZ, Ort: ${order.deliveryAddress.zipCode} ${order.deliveryAddress.city}`, rightColX + 10, currentY + 70)
         .text(`Land: ${order.deliveryAddress.country}`, rightColX + 10, currentY + 90);
    }
    
    return currentY + sectionHeight + 20;
  }

  private addVehicleDetails(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    // Vehicle Information Section
    doc.rect(60, currentY, 475, 120).stroke();
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Fahrzeugdaten', 70, currentY + 10);
    
    if (order.vehicleData) {
      const vehicle = order.vehicleData;
      
      // Left column
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Fahrzeuginhaber:', 70, currentY + 35)
         .text('Kennzeichen:', 70, currentY + 55)
         .text('FIN:', 70, currentY + 75)
         .text('Marke/Modell:', 70, currentY + 95);
      
      doc.font('Helvetica')
         .text(vehicle.vehicleOwner || '', 180, currentY + 35)
         .text(vehicle.licensePlateNumber || '', 180, currentY + 55)
         .text(vehicle.vin || '', 180, currentY + 75)
         .text(`${vehicle.brand || ''} ${vehicle.model || ''}`.trim(), 180, currentY + 95);
      
      // Right column
      if (vehicle.year || vehicle.color) {
        doc.font('Helvetica-Bold')
           .text('Baujahr:', 350, currentY + 35)
           .text('Farbe:', 350, currentY + 55);
        
        doc.font('Helvetica')
           .text(vehicle.year?.toString() || '', 420, currentY + 35)
           .text(vehicle.color || '', 420, currentY + 55);
      }
    }
    
    return currentY + 140;
  }

  private addExpensesSection(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    if (!order.expenses) return currentY;
    
    // Expenses Section
    doc.rect(60, currentY, 475, 100).stroke();
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Auslagen:', 70, currentY + 10);
    
    const expenses = order.expenses;
    
    // Left column
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Kraftstoff:', 70, currentY + 35)
       .text('Waschen:', 70, currentY + 55)
       .text('AdBlue:', 70, currentY + 75);
    
    doc.font('Helvetica')
       .text(`${expenses.fuel || 0} €`, 150, currentY + 35)
       .text(`${expenses.wash || 0} €`, 150, currentY + 55)
       .text(`${expenses.adBlue || 0} €`, 150, currentY + 75);
    
    // Right column
    doc.font('Helvetica-Bold')
       .text('Mautgebühren:', 250, currentY + 35)
       .text('Parken:', 250, currentY + 55)
       .text('Sonstiges:', 250, currentY + 75);
    
    doc.font('Helvetica')
       .text(`${expenses.tollFees || 0} €`, 350, currentY + 35)
       .text(`${expenses.parking || 0} €`, 350, currentY + 55)
       .text(`${expenses.other || 0} €`, 350, currentY + 75);
    
    // Total
    const total = (expenses.fuel || 0) + (expenses.wash || 0) + (expenses.adBlue || 0) + 
                  (expenses.tollFees || 0) + (expenses.parking || 0) + (expenses.other || 0);
    
    doc.font('Helvetica-Bold')
       .text(`Gesamt: ${total} €`, 400, currentY + 10);
    
    return currentY + 120;
  }

  private addCommentsSection(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    doc.rect(60, currentY, 475, 60).stroke();
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Bemerkungen:', 70, currentY + 10);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(order.comments, 70, currentY + 30, { width: 450 });
    
    return currentY + 80;
  }

  private addSignaturesSection(doc: PDFKit.PDFDocument, order: any, startY: number): number {
    let currentY = startY;
    
    // Check if we need a new page
    if (currentY > 650) {
      doc.addPage();
      currentY = 40;
    }
    
    const sectionHeight = 120;
    
    // Signatures Section
    doc.rect(60, currentY, 475, sectionHeight).stroke();
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('Unterschriften', 70, currentY + 10);
    
    // Driver Signature (left)
    const driverSignature = order.signatures?.find(s => s.signatureType === 'DRIVER');
    
    doc.rect(70, currentY + 30, 200, 80).stroke();
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Fahrer-Unterschrift:', 80, currentY + 40);
    
    if (driverSignature) {
      doc.font('Helvetica')
         .text(driverSignature.name, 80, currentY + 60)
         .text(this.formatGermanDate(driverSignature.createdAt), 80, currentY + 80);
    }
    
    // Customer Signature (right)
    const customerSignature = order.signatures?.find(s => s.signatureType === 'CUSTOMER');
    
    doc.rect(300, currentY + 30, 200, 80).stroke();
    doc.font('Helvetica-Bold')
       .text('Kunden-Unterschrift:', 310, currentY + 40);
    
    if (customerSignature) {
      doc.font('Helvetica')
         .text(customerSignature.name, 310, currentY + 60)
         .text(this.formatGermanDate(customerSignature.createdAt), 310, currentY + 80);
    }
    
    return currentY + sectionHeight + 20;
  }

  private addFooter(doc: PDFKit.PDFDocument, order: any) {
    const pageCount = doc.bufferedPageRange().count;
    
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      
      // Footer line
      doc.moveTo(40, 780)
         .lineTo(555, 780)
         .stroke();
      
      // Company info
      doc.fontSize(8)
         .font('Helvetica')
         .text('Car Handover System • Automatisierte Fahrzeugübergabe', 40, 790)
         .text(`Seite ${i + 1} von ${pageCount}`, 450, 790)
         .text(`Erstellt am: ${this.formatGermanDateTime(new Date())}`, 40, 800);
    }
  }

  // Helper methods for date formatting
  private formatGermanDate(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  }

  private formatGermanDateTime(date: Date): string {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }
}