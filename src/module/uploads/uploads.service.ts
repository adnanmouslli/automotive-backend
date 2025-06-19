import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ImageCategory } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService) {}

  async uploadImage(
    file: Express.Multer.File,
    orderId: string,
    category: ImageCategory,
    description?: string,
  ) {
    console.log('🔄 حفظ الصورة في قاعدة البيانات...');
    
    // التحقق من وجود الطلبية
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`الطلبية ذات المعرف ${orderId} غير موجودة`);
    }

    const imageUrl = `/uploads/images/${file.filename}`;
    
    const image = await this.prisma.image.create({
      data: {
        name: file.originalname,
        imageUrl,
        category,
        description,
        orderId,
      },
    });

    console.log('✅ تم حفظ الصورة:', image.id);
    return image;
  }

  async uploadSignature(
    file: Express.Multer.File,
    orderId: string,
    signerName: string,
    isDriver: boolean,
  ) {
    console.log('🔄 حفظ التوقيع في قاعدة البيانات...');
    console.log(`📝 نوع التوقيع: ${isDriver ? 'سائق' : 'زبون'}`);
    
    // التحقق من وجود الطلبية
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        driverSignature: true,
        customerSignature: true,
      }
    });

    if (!order) {
      throw new NotFoundException(`الطلبية ذات المعرف ${orderId} غير موجودة`);
    }

    // التحقق من عدم وجود توقيع مسبق لنفس النوع
    if (isDriver && order.driverSignature) {
      throw new BadRequestException('توقيع السائق موجود بالفعل لهذه الطلبية');
    }

    if (!isDriver && order.customerSignature) {
      throw new BadRequestException('توقيع الزبون موجود بالفعل لهذه الطلبية');
    }

    const signUrl = `/uploads/signatures/${file.filename}`;
    
    // إنشاء التوقيع مع ربطه مباشرة بالطلبية
    const signature = await this.prisma.signature.create({
      data: {
        name: signerName,
        signUrl,
        orderId,
        isDriver, // إضافة هذا الحقل لتمييز نوع التوقيع
      },
    });

    // تحديث الطلبية بناءً على نوع التوقيع
    const updateData: any = {};
    
    if (isDriver) {
      updateData.driverSignatureId = signature.id;
      console.log('🚛 ربط التوقيع كتوقيع سائق');
    } else {
      updateData.customerSignatureId = signature.id;
      console.log('👤 ربط التوقيع كتوقيع زبون');
    }

    // تحديث الطلبية بمعرف التوقيع المناسب
    await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    console.log('✅ تم حفظ التوقيع وربطه بالطلبية:', signature.id);
    
    // إرجاع التوقيع مع معلومات إضافية
    return {
      ...signature,
      type: isDriver ? 'driver' : 'customer',
      orderId: orderId,
    };
  }

  async addExpenses(orderId: string, expenses: any) {
    console.log('🔄 حفظ المصروفات في قاعدة البيانات...');
    
    // التحقق من وجود الطلبية
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`الطلبية ذات المعرف ${orderId} غير موجودة`);
    }

    // حساب الإجمالي
    const total = Object.keys(expenses)
      .filter(key => key !== 'notes' && key !== 'orderId')
      .reduce((sum, key) => {
        const value = expenses[key];
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);

    const expensesData = {
      ...expenses,
      total,
      orderId,
    };

    const result = await this.prisma.expenses.upsert({
      where: { orderId },
      update: expensesData,
      create: expensesData,
    });

    console.log('✅ تم حفظ المصروفات:', result.id);
    return result;
  }

  // دالة للحصول على التوقيعات الخاصة بطلبية معينة
  async getOrderSignatures(orderId: string) {
    const signatures = await this.prisma.signature.findMany({
      where: { orderId },
    });

    const result = {
      driverSignature: signatures.find(s => s.isDriver) || null,
      customerSignature: signatures.find(s => !s.isDriver) || null,
    };

    console.log(`📋 توقيعات الطلبية ${orderId}:`, {
      hasDriverSignature: !!result.driverSignature,
      hasCustomerSignature: !!result.customerSignature,
    });

    return result;
  }

  // دالة لحذف توقيع معين
  async deleteSignature(signatureId: string, orderId: string) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
    });

    if (!signature) {
      throw new NotFoundException('التوقيع غير موجود');
    }

    if (signature.orderId !== orderId) {
      throw new BadRequestException('التوقيع لا ينتمي لهذه الطلبية');
    }

    // حذف ربط التوقيع من الطلبية
    const updateData: any = {};
    if (signature.isDriver) {
      updateData.driverSignatureId = null;
    } else {
      updateData.customerSignatureId = null;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // حذف التوقيع
    await this.prisma.signature.delete({
      where: { id: signatureId },
    });

    console.log('🗑️ تم حذف التوقيع:', signatureId);
    return true;
  }
}