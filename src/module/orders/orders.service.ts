// src/orders/orders.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateAddressDto, CreateOrderDto, CreateVehicleDamageDto } from './dto/create-order.dto';
import { DamageType, OrderStatus, UserRole, VehicleSide } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

async create(createOrderDto: CreateOrderDto, userId: string) {
  console.log('📋 إنشاء طلبية جديدة...');
  console.log('User ID:', userId);
  console.log('Order Data:', createOrderDto);
  
  // التحقق من وجود المستخدم
  if (!userId) {
    throw new BadRequestException('معرف المستخدم مطلوب');
  }

  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('المستخدم غير موجود');
  }

  console.log('✅ تم التحقق من المستخدم:', user.name);

  const { pickupAddress, deliveryAddress, clientAddress, billingAddress, damages, ...orderData } = createOrderDto;

  try {
    const order = await this.prisma.order.create({
      data: {
        // بيانات الطلبية الأساسية
        client: orderData.client,
        clientPhone: orderData.clientPhone,
        clientEmail: orderData.clientEmail,
        
        // بيانات صاحب الفاتورة
        isSameBilling: orderData.isSameBilling ?? true,
        billingName: orderData.billingName,
        billingPhone: orderData.billingPhone,
        billingEmail: orderData.billingEmail,
        
        description: orderData.description,
        comments: orderData.comments,
        items: orderData.items || [],
        
        // ربط بالسائق
        driver: {
          connect: {
            id: userId
          }
        },
        
        // إنشاء عنوان العميل
        clientAddress: clientAddress ? {
          create: {
            street: clientAddress.street,
            houseNumber: clientAddress.houseNumber,
            zipCode: clientAddress.zipCode,
            city: clientAddress.city,
            country: clientAddress.country || 'Deutschland',
          }
        } : undefined,
        
        // إنشاء عنوان صاحب الفاتورة
        billingAddress: billingAddress ? {
          create: {
            street: billingAddress.street,
            houseNumber: billingAddress.houseNumber,
            zipCode: billingAddress.zipCode,
            city: billingAddress.city,
            country: billingAddress.country || 'Deutschland',
          }
        } : undefined,
        
        // إنشاء عنوان الاستلام
        pickupAddress: pickupAddress ? {
          create: {
            street: pickupAddress.street,
            houseNumber: pickupAddress.houseNumber,
            zipCode: pickupAddress.zipCode,
            city: pickupAddress.city,
            country: pickupAddress.country || 'Deutschland',

            date: pickupAddress.date ? new Date(pickupAddress.date) : null,
            companyName: pickupAddress.companyName,
            contactPersonName: pickupAddress.contactPersonName,
            contactPersonPhone: pickupAddress.contactPersonPhone,
            contactPersonEmail: pickupAddress.contactPersonEmail,
            fuelLevel: pickupAddress.fuelLevel,
            fuelMeter: pickupAddress.fuelMeter,

          }
        } : undefined,
        
        // إنشاء عنوان التسليم
        deliveryAddress: deliveryAddress ? {
          create: {
            street: deliveryAddress.street,
            houseNumber: deliveryAddress.houseNumber,
            zipCode: deliveryAddress.zipCode,
            city: deliveryAddress.city,
            country: deliveryAddress.country || 'Deutschland',

            date: deliveryAddress.date ? new Date(deliveryAddress.date) : null,
            companyName: deliveryAddress.companyName,
            contactPersonName: deliveryAddress.contactPersonName,
            contactPersonPhone: deliveryAddress.contactPersonPhone,
            contactPersonEmail: deliveryAddress.contactPersonEmail,
            fuelLevel: deliveryAddress.fuelLevel,
            fuelMeter: deliveryAddress.fuelMeter,
          }
        } : undefined,
        
        // إنشاء بيانات السيارة مع الحقول الجديدة
        vehicleData: {
          create: {
            vehicleOwner: orderData.vehicleOwner,
            licensePlateNumber: orderData.licensePlateNumber,
            vin: orderData.vin,
            brand: orderData.brand,
            model: orderData.model,
            year: orderData.year,
            color: orderData.color,
            
            // إضافة الحقول الجديدة
            ukz: orderData.ukz,
            fin: orderData.fin,
            bestellnummer: orderData.bestellnummer,
            leasingvertragsnummer: orderData.leasingvertragsnummer,
            kostenstelle: orderData.kostenstelle,
            bemerkung: orderData.bemerkung,
            typ: orderData.typ,
          }
        },
        
        // إنشاء بيانات الخدمة
        service: {
          create: {
            vehicleType: orderData.vehicleType,
            serviceType: orderData.serviceType,
            description: orderData.serviceDescription,
          }
        },

         // إضافة الأضرار
        damages: damages && damages.length > 0 ? {
          create: damages.map(damage => ({
            side: damage.side,
            type: damage.type,
            description: damage.description?.trim() || null,
          }))
        } : undefined,

        
      },
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
          }
        },
        images: true,
        driverSignature: true,
        customerSignature: true,
        expenses: true,
        // إضافة الأضرار إلى include
        damages: {
          orderBy: {
            createdAt: 'asc'
          }
        },
      },
    });

    console.log('✅ تم إنشاء الطلبية بنجاح، رقم:', order.orderNumber);
    return order;

  } catch (error) {
    console.error('❌ خطأ في إنشاء الطلبية:', error);
    throw new BadRequestException(`فشل في إنشاء الطلبية: ${error.message}`);
  }
}



  async findAll(userId: string, userRole: UserRole) {
  console.log('📋 عرض الطلبيات للمستخدم:', userId, 'الدور:', userRole);

  const where = userRole === UserRole.ADMIN ? {} : { driverId: userId };

  const orders = await this.prisma.order.findMany({
    where,
    include: {
      clientAddress: true, // إضافة جديدة
      billingAddress: true, // إضافة جديدة
      pickupAddress: true,
      deliveryAddress: true,
      vehicleData: true,
      service: true,
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      images: true,
      driverSignature: true,
      customerSignature: true,
      expenses: true,
      damages: {
        orderBy: {
          createdAt: 'asc'
        }
      },

    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`✅ تم العثور على ${orders.length} طلبية`);
  
  // تنسيق جميع الطلبيات
  const formattedOrders = orders.map(order => this.formatOrderResponse(order));
  
  console.log('📊 إحصائيات الطلبيات:', {
    total: formattedOrders.length,
    pending: formattedOrders.filter(o => o.status === 'pending').length,
    inProgress: formattedOrders.filter(o => o.status === 'in_progress').length,
    completed: formattedOrders.filter(o => o.status === 'completed').length,
    cancelled: formattedOrders.filter(o => o.status === 'cancelled').length,
  });
  
  return formattedOrders;
}

  async findOne(id: string, userId: string, userRole: UserRole) {
  console.log('🔍 البحث عن الطلبية:', id);

  const order = await this.prisma.order.findUnique({
    where: { id },
    include: {
      clientAddress: true, // إضافة جديدة
      billingAddress: true, // إضافة جديدة
      pickupAddress: true,
      deliveryAddress: true,
      vehicleData: true,
      service: true,
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      images: true,
      driverSignature: true,
      customerSignature: true,
      expenses: true,
      damages: {
        orderBy: {
          createdAt: 'asc'
        }
      },
    },
  });

  if (!order) {
    throw new NotFoundException('الطلبية غير موجودة');
  }

  // التحقق من الصلاحيات
  if (userRole !== UserRole.ADMIN && order.driverId !== userId) {
    throw new ForbiddenException('ليس لديك صلاحية للوصول لهذه الطلبية');
  }

  console.log('✅ تم العثور على الطلبية:', order.orderNumber);
  
  // إرجاع الطلبية بالتنسيق الصحيح
  return this.formatOrderResponse(order);
}


  async update(id: string, updateData: Partial<CreateOrderDto>, userId: string, userRole: UserRole) {
  

  // التحقق من وجود الطلبية والصلاحيات
  const existingOrder = await this.findOne(id, userId, userRole);
  if (!existingOrder) {
    throw new NotFoundException('الطلبية غير موجودة');
  }
  
  const { pickupAddress, deliveryAddress, clientAddress, billingAddress, damages, ...orderData } = updateData;
  
    console.log("===============");

    console.log(updateData);
      console.log("===============");

  try {
    // إعداد البيانات للتحديث مع التحقق من القيم
    const updatePayload: any = {
      updatedAt: new Date(),
    };

    // تحديث البيانات الأساسية
    if (orderData.client?.trim()) updatePayload.client = orderData.client.trim();
    if (orderData.clientPhone?.trim()) updatePayload.clientPhone = orderData.clientPhone.trim();
    if (orderData.clientEmail?.trim()) updatePayload.clientEmail = orderData.clientEmail.trim();
    
    // تحديث بيانات صاحب الفاتورة
    if (orderData.isSameBilling !== undefined) updatePayload.isSameBilling = orderData.isSameBilling;
    if (orderData.billingName?.trim()) updatePayload.billingName = orderData.billingName.trim();
    if (orderData.billingPhone?.trim()) updatePayload.billingPhone = orderData.billingPhone.trim();
    if (orderData.billingEmail?.trim()) updatePayload.billingEmail = orderData.billingEmail.trim();
    
    if (orderData.description !== undefined) updatePayload.description = orderData.description?.trim() || null;
    if (orderData.comments !== undefined) updatePayload.comments = orderData.comments?.trim() || null;
    if (orderData.items) updatePayload.items = orderData.items;

    // تحديث بيانات السيارة مع الحقول الجديدة
    if (this.hasVehicleDataUpdates(orderData)) {
      updatePayload.vehicleData = {
        update: {
          vehicleOwner: orderData.vehicleOwner?.trim() || undefined,
          licensePlateNumber: orderData.licensePlateNumber?.trim() || undefined,
          vin: orderData.vin?.trim() || undefined,
          brand: orderData.brand?.trim() || undefined,
          model: orderData.model?.trim() || undefined,
          year: orderData.year || undefined,
          color: orderData.color?.trim() || undefined,
          
          // تحديث الحقول الجديدة
          ukz: orderData.ukz?.trim() || undefined,
          fin: orderData.fin?.trim() || undefined,
          bestellnummer: orderData.bestellnummer?.trim() || undefined,
          leasingvertragsnummer: orderData.leasingvertragsnummer?.trim() || undefined,
          kostenstelle: orderData.kostenstelle?.trim() || undefined,
          bemerkung: orderData.bemerkung?.trim() || undefined,
          typ: orderData.typ?.trim() || undefined,
          updatedAt: new Date(),
        }
      };
    }

    // تحديث بيانات الخدمة
    if (this.hasServiceDataUpdates(orderData)) {
      updatePayload.service = {
        update: {
          vehicleType: orderData.vehicleType?.trim() || undefined,
          serviceType: orderData.serviceType || undefined,
          description: orderData.serviceDescription?.trim() || undefined,
          updatedAt: new Date(),
        }
      };
    }

    // باقي كود تحديث العناوين...
    if (clientAddress && this.validateAddress(clientAddress)) {
      updatePayload.clientAddress = {
        upsert: {
          create: {
            street: clientAddress.street.trim(),
            houseNumber: clientAddress.houseNumber.trim(),
            zipCode: clientAddress.zipCode.trim(),
            city: clientAddress.city.trim(),
            country: clientAddress.country?.trim() || 'Deutschland',
          },
          update: {
            street: clientAddress.street.trim(),
            houseNumber: clientAddress.houseNumber.trim(),
            zipCode: clientAddress.zipCode.trim(),
            city: clientAddress.city.trim(),
            country: clientAddress.country?.trim() || 'Deutschland',
            updatedAt: new Date(),
          }
        }
      };
    }

    if (billingAddress && this.validateAddress(billingAddress)) {
      updatePayload.billingAddress = {
        upsert: {
          create: {
            street: billingAddress.street.trim(),
            houseNumber: billingAddress.houseNumber.trim(),
            zipCode: billingAddress.zipCode.trim(),
            city: billingAddress.city.trim(),
            country: billingAddress.country?.trim() || 'Deutschland',
          },
          update: {
            street: billingAddress.street.trim(),
            houseNumber: billingAddress.houseNumber.trim(),
            zipCode: billingAddress.zipCode.trim(),
            city: billingAddress.city.trim(),
            country: billingAddress.country?.trim() || 'Deutschland',
            updatedAt: new Date(),
          }
        }
      };
    }

    if (pickupAddress && this.validateAddress(pickupAddress)) {
      updatePayload.pickupAddress = {
        update: {
          street: pickupAddress.street.trim(),
          houseNumber: pickupAddress.houseNumber.trim(),
          zipCode: pickupAddress.zipCode.trim(),
          city: pickupAddress.city.trim(),
          country: pickupAddress.country?.trim() || 'Deutschland',

          date: pickupAddress.date ? new Date(pickupAddress.date) : null,
          companyName: pickupAddress.companyName?.trim() || null,
          contactPersonName: pickupAddress.contactPersonName?.trim() || null,
          contactPersonPhone: pickupAddress.contactPersonPhone?.trim() || null,
          contactPersonEmail: pickupAddress.contactPersonEmail?.trim() || null,
          fuelLevel: pickupAddress.fuelLevel || null,
          fuelMeter: pickupAddress.fuelMeter || null,
          updatedAt: new Date(),
        }
      };
    }

    if (deliveryAddress && this.validateAddress(deliveryAddress)) {
      updatePayload.deliveryAddress = {
        update: {
          street: deliveryAddress.street.trim(),
          houseNumber: deliveryAddress.houseNumber.trim(),
          zipCode: deliveryAddress.zipCode.trim(),
          city: deliveryAddress.city.trim(),
          country: deliveryAddress.country?.trim() || 'Deutschland',
          
          date: deliveryAddress.date ? new Date(deliveryAddress.date) : null,
          companyName: deliveryAddress.companyName?.trim() || null,
          contactPersonName: deliveryAddress.contactPersonName?.trim() || null,
          contactPersonPhone: deliveryAddress.contactPersonPhone?.trim() || null,
          contactPersonEmail: deliveryAddress.contactPersonEmail?.trim() || null,
          fuelLevel: deliveryAddress.fuelLevel || null,
          fuelMeter: deliveryAddress.fuelMeter || null,
          updatedAt: new Date(),
                }
      };
    }
     // معالجة تحديث الأضرار
    if (damages !== undefined) {
      if (damages && damages.length > 0) {
        updatePayload.damages = {
          // حذف الأضرار الموجودة
          deleteMany: {},
          // إضافة الأضرار الجديدة
          create: damages.map(damage => ({
            side: damage.side,
            type: damage.type,
            description: damage.description?.trim() || null,
          }))
        };
        console.log('🔧 تحديث الأضرار:', damages.length, 'ضرر');
      } else {
        // حذف جميع الأضرار إذا كانت القائمة فارغة
        updatePayload.damages = {
          deleteMany: {}
        };
        console.log('🗑️ حذف جميع الأضرار');
      }
    }

    console.log('📦 البيانات المحضرة للتحديث:', JSON.stringify(updatePayload, null, 2));

    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: updatePayload,
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
          }
        },
        images: {
          orderBy: { createdAt: 'desc' }
        },
        driverSignature: true,
        customerSignature: true,
        expenses: true,

        damages: {
          orderBy: {
            createdAt: 'asc'
          }
        },
      },
    });

    console.log('✅ تم تحديث الطلبية بنجاح');
    
    // إرجاع البيانات بتنسيق متوافق مع الفرونت إند
    return this.formatOrderResponse(updatedOrder);

  } catch (error) {
    console.error('❌ خطأ في تحديث الطلبية:', error);
    
    if (error.code === 'P2002') {
      throw new BadRequestException('قيمة مكررة في أحد الحقول الفريدة');
    }
    
    if (error.code === 'P2025') {
      throw new NotFoundException('الطلبية أو أحد العناصر المرتبطة غير موجود');
    }
    
    throw new BadRequestException(`فشل في تحديث الطلبية: ${error.message}`);
  }
}


private hasVehicleDataUpdates(orderData: Partial<CreateOrderDto>): boolean {
  return !!(
    orderData.vehicleOwner ||
    orderData.licensePlateNumber ||
    orderData.vin ||
    orderData.brand ||
    orderData.model ||
    orderData.year ||
    orderData.color ||
    orderData.ukz ||
    orderData.fin ||
    orderData.bestellnummer ||
    orderData.leasingvertragsnummer ||
    orderData.kostenstelle ||
    orderData.bemerkung ||
    orderData.typ
  );
}

private hasServiceDataUpdates(orderData: Partial<CreateOrderDto>): boolean {
  return !!(
    orderData.vehicleType ||
    orderData.serviceType ||
    orderData.serviceDescription
  );
}




  // دالة مساعدة للتحقق من صحة العنوان
  private validateAddress(address: CreateAddressDto): boolean {
    return !!(
      address.street?.trim() &&
      address.houseNumber?.trim() &&
      address.zipCode?.trim() &&
      address.city?.trim()
    );
  }


private formatOrderResponse(order: any) {
  console.log('📋 تنسيق استجابة الطلبية:', order.id);
  console.log('📊 الحالة الحالية:', order.status);
  
  // التأكد من تحويل الحالة إلى string صحيح
  const status = this.normalizeOrderStatus(order.status);
  
  // حساب معلومات التوقيعات
  const signatures = this.formatSignatures(order);
  
  // التحقق من المتطلبات
  const completionInfo = this.calculateCompletionInfo(order);
  
  const formattedOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    client: order.client,
    clientPhone: order.clientPhone,
    clientEmail: order.clientEmail,
    clientAddress: order.clientAddress,
    
    // بيانات صاحب الفاتورة
    isSameBilling: order.isSameBilling,
    billingName: order.billingName,
    billingPhone: order.billingPhone,
    billingEmail: order.billingEmail,
    billingAddress: order.billingAddress,

    description: order.description,
    comments: order.comments,
    items: order.items || [],
    
    // بيانات السيارة مع الحقول الجديدة
    vehicleOwner: order.vehicleData?.vehicleOwner,
    licensePlateNumber: order.vehicleData?.licensePlateNumber,
    vin: order.vehicleData?.vin,
    brand: order.vehicleData?.brand,
    model: order.vehicleData?.model,
    year: order.vehicleData?.year,
    color: order.vehicleData?.color,
    
    // إضافة الحقول الجديدة
    ukz: order.vehicleData?.ukz,
    fin: order.vehicleData?.fin,
    bestellnummer: order.vehicleData?.bestellnummer,
    leasingvertragsnummer: order.vehicleData?.leasingvertragsnummer,
    kostenstelle: order.vehicleData?.kostenstelle,
    bemerkung: order.vehicleData?.bemerkung,
    typ: order.vehicleData?.typ,
    
    // بيانات الخدمة
    vehicleType: order.service?.vehicleType,
    serviceType: order.service?.serviceType,
    serviceDescription: order.service?.description,
    
    // العناوين
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    
    damages: order.damages || [],


    // الحالة والسائق
    status: status,
    driverId: order.driverId,
    driver: order.driver,
    
    // الملفات والتوقيعات
    images: order.images || [],
    signatures: signatures,
    expenses: order.expenses,
    
    // معلومات الإكمال
    hasImages: (order.images || []).length > 0,
    hasDriverSignature: !!order.driverSignature,
    hasCustomerSignature: !!order.customerSignature,
    hasAllSignatures: !!order.driverSignature && !!order.customerSignature,
    isReadyForCompletion: completionInfo.isReady,
    completionPercentage: completionInfo.percentage,
    missingRequirements: completionInfo.missing,
    
    // التواريخ
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
  
  console.log('✅ تم تنسيق الطلبية:', {
    id: formattedOrder.id,
    status: formattedOrder.status,
    hasImages: formattedOrder.hasImages,
    hasSignatures: formattedOrder.hasAllSignatures,
    isReady: formattedOrder.isReadyForCompletion,
    damagesCount: formattedOrder.damages.length,

  });
  
  return formattedOrder;
}

// دالة تطبيع حالة الطلبية
private normalizeOrderStatus(status: any): string {
  if (!status) return 'pending';
  
  // إذا كانت الحالة من نوع enum، حولها إلى string
  const statusString = typeof status === 'string' ? status : status.toString();
  
  // تحويل إلى lowercase وإزالة المسافات
  const normalized = statusString.toLowerCase().trim();
  
  // التأكد من أن الحالة صحيحة
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  
  if (validStatuses.includes(normalized)) {
    return normalized;
  }
  
  // في حالة وجود حالة غير معروفة، إرجاع pending كقيمة افتراضية
  console.warn('⚠️ حالة غير معروفة:', status, '- سيتم استخدام pending');
  return 'pending';
}

// دالة تنسيق التوقيعات
private formatSignatures(order: any): any[] {
  const signatures = [];
  
  if (order.driverSignature) {
    signatures.push({
      ...order.driverSignature,
      isDriver: true,
      type: 'driver'
    });
  }
  
  if (order.customerSignature) {
    signatures.push({
      ...order.customerSignature,
      isDriver: false,
      type: 'customer'
    });
  }
  
  return signatures;
}

// دالة حساب معلومات الإكمال
private calculateCompletionInfo(order: any) {
  const hasImages = (order.images || []).length > 0;
  const hasDriverSignature = !!order.driverSignature;
  const hasCustomerSignature = !!order.customerSignature;
  
  const missing = [];
  if (!hasImages) missing.push('الصور');
  if (!hasDriverSignature) missing.push('توقيع السائق');
  if (!hasCustomerSignature) missing.push('توقيع العميل');
  
  const isReady = missing.length === 0;
  
  // حساب نسبة الإكمال
  let percentage = 0.4; // البيانات الأساسية 40%
  if (hasImages) percentage += 0.2; // الصور 20%
  if (hasDriverSignature && hasCustomerSignature) percentage += 0.3; // التوقيعات 30%
  else if (hasDriverSignature || hasCustomerSignature) percentage += 0.15; // توقيع واحد 15%
  if (order.expenses) percentage += 0.1; // المصاريف 10%
  
  return {
    isReady,
    percentage: Math.min(percentage, 1.0),
    missing
  };
}


  


  // دالة للحصول على إحصائيات الطلبيات
  async getOrderStats(userId: string, userRole: UserRole) {
    console.log('📊 حساب إحصائيات الطلبيات');

    const where = userRole === UserRole.ADMIN ? {} : { driverId: userId };

    const [totalOrders, todayOrders, thisWeekOrders, thisMonthOrders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      this.prisma.order.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      this.prisma.order.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
    ]);

    return {
      totalOrders,
      todayOrders,
      thisWeekOrders,
      thisMonthOrders,
    };
  }

  // 1. حذف الطلبية
async remove(id: string, userId: string, userRole: UserRole) {
  console.log('🗑️ حذف الطلبية:', id);

  try {
    // التحقق من وجود الطلبية والصلاحية
    const existingOrder = await this.findOne(id, userId, userRole);

    // حذف الملفات المرتبطة بالطلبية
    await this.deleteOrderFiles(existingOrder);

    // حذف الطلبية من قاعدة البيانات (سيتم حذف الأضرار تلقائياً بسبب onDelete: Cascade)
    await this.prisma.order.delete({
      where: { id },
    });

    console.log('✅ تم حذف الطلبية وجميع الأضرار المرتبطة بها بنجاح');
    
    return {
      success: true,
      message: 'تم حذف الطلبية وجميع الأضرار المرتبطة بها بنجاح',
      deletedOrderId: id,
      deletedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في حذف الطلبية:', error);
    throw new BadRequestException(`فشل في حذف الطلبية: ${error.message}`);
  }
}


// 2. حذف الملفات المرتبطة بالطلبية
private async deleteOrderFiles(order: any) {
  console.log('🗑️ حذف الملفات المرتبطة بالطلبية:', order.id);

  try {
    // حذف الصور
    if (order.images && order.images.length > 0) {
      for (const image of order.images) {
        await this.deleteFile(image.imageUrl, 'images');
      }
    }

    // حذف التوقيعات
    const signatures = [
      ...(order.signatures || []),
      order.driverSignature,
      order.customerSignature,
    ].filter(Boolean);

    for (const signature of signatures) {
      await this.deleteFile(signature.signUrl, 'signatures');
    }

    console.log('✅ تم حذف جميع الملفات المرتبطة');
  } catch (error) {
    console.error('⚠️ خطأ في حذف بعض الملفات:', error);
    // لا نرمي خطأ هنا لأن حذف الملفات ليس بالغ الأهمية
  }
}

// 3. دالة مساعدة لحذف ملف واحد
private async deleteFile(fileUrl: string, type: 'images' | 'signatures') {
  try {
    if (!fileUrl) return;

    // استخراج اسم الملف من URL
    const filename = fileUrl.split('/').pop();
    if (!filename) return;

    const filePath = join('./uploads', type, filename);
    
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`🗑️ تم حذف الملف: ${filePath}`);
    }
  } catch (error) {
    console.error(`⚠️ فشل حذف الملف ${fileUrl}:`, error);
  }
}

// 4. تحديث حالة الطلبية (إتمام الطلب)
async updateOrderStatus(id: string, status: string, userId: string, userRole: UserRole) {
  console.log('📋 تحديث حالة الطلبية:', id, 'إلى:', status);

  try {
    // التحقق من وجود الطلبية
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        images: true,
        driverSignature: true,
        customerSignature: true,
        expenses: true,
        pickupAddress: true,
        deliveryAddress: true,
        vehicleData: true,
        service: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`الطلبية غير موجودة: ${id}`);
    }

    console.log('📊 الطلبية الحالية:', {
      id: order.id,
      currentStatus: order.status,
      targetStatus: status,
      hasImages: (order.images || []).length > 0,
      hasDriverSignature: !!order.driverSignature,
      hasCustomerSignature: !!order.customerSignature,
    });

    // التحقق من الصلاحية
    if (userRole !== 'ADMIN' && order.driverId !== userId) {
      throw new ForbiddenException('ليس لديك صلاحية لتحديث هذه الطلبية');
    }

    // التحقق من صحة الحالة وتحويلها إلى enum
    let orderStatus: OrderStatus;
    const normalizedStatus = status.toLowerCase().trim();
    
    switch (normalizedStatus) {
      case 'pending':
        orderStatus = OrderStatus.PENDING;
        break;
      case 'in_progress':
        orderStatus = OrderStatus.IN_PROGRESS;
        break;
      case 'completed':
        orderStatus = OrderStatus.COMPLETED;
        break;
      case 'cancelled':
        orderStatus = OrderStatus.CANCELLED;
        break;
      default:
        throw new BadRequestException(
          `حالة غير صحيحة: ${status}. الحالات المتاحة: pending, in_progress, completed, cancelled`
        );
    }

    // التحقق من صحة تدفق الحالات
    const currentStatus = order.status;
    const isValidTransition = this.isValidStatusTransition(currentStatus, orderStatus);
    
    if (!isValidTransition) {
      throw new BadRequestException(
        `لا يمكن تغيير حالة الطلب من "${this.getStatusDisplayName(currentStatus)}" إلى "${this.getStatusDisplayName(orderStatus)}"`
      );
    }

    // التحقق من متطلبات الإكمال إذا كانت الحالة "completed"
    if (orderStatus === OrderStatus.COMPLETED) {
      const missingRequirements = [];
      
      if (!order.images || order.images.length === 0) {
        missingRequirements.push('الصور');
      }
      
      if (!order.driverSignature) {
        missingRequirements.push('توقيع السائق');
      }
      
      if (!order.customerSignature) {
        missingRequirements.push('توقيع العميل');
      }

      if (missingRequirements.length > 0) {
        throw new BadRequestException(
          `لا يمكن إتمام الطلب. المتطلبات المفقودة: ${missingRequirements.join(', ')}`
        );
      }
    }

    console.log(`✅ تحديث الحالة من ${currentStatus} إلى ${orderStatus}`);

    // تحديث الحالة
    const updatedOrder = await this.prisma.order.update({
      where: { id },
      data: {
        status: orderStatus,
        updatedAt: new Date(),
      },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        vehicleData: true,
        service: true,
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        images: {
          orderBy: { createdAt: 'desc' }
        },
        driverSignature: true,
        customerSignature: true,
        expenses: true,
      },
    });

    console.log('✅ تم تحديث حالة الطلبية بنجاح:', {
      id: updatedOrder.id,
      newStatus: updatedOrder.status,
      updatedAt: updatedOrder.updatedAt
    });
    
    // إرجاع البيانات بتنسيق متوافق مع الفرونت إند
    const formattedResponse = this.formatOrderResponse(updatedOrder);
    
    console.log('📤 إرسال الاستجابة:', {
      id: formattedResponse.id,
      status: formattedResponse.status,
      hasImages: formattedResponse.hasImages,
      hasAllSignatures: formattedResponse.hasAllSignatures,
      isReadyForCompletion: formattedResponse.isReadyForCompletion
    });
    
    return formattedResponse;
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في تحديث حالة الطلبية:', error);
    throw new BadRequestException(`فشل في تحديث حالة الطلبية: ${error.message}`);
  }
}


// دالة مساعدة للتحقق من صحة تدفق الحالات
private isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const statusTransitions = {
    [OrderStatus.PENDING]: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED],
    [OrderStatus.IN_PROGRESS]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [], // لا يمكن تغيير الحالة من مكتمل
    [OrderStatus.CANCELLED]: [], // لا يمكن تغيير الحالة من ملغي
  };

  const allowedTransitions = statusTransitions[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

// دالة مساعدة لترجمة أسماء الحالات
private getStatusDisplayName(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.PENDING:
      return 'قيد الانتظار';
    case OrderStatus.IN_PROGRESS:
      return 'قيد التنفيذ';
    case OrderStatus.COMPLETED:
      return 'مكتمل';
    case OrderStatus.CANCELLED:
      return 'ملغي';
    default:
      return status;
  }
}

// دالة إضافية للحصول على معلومات تفصيلية عن حالة الطلبية
async getOrderStatusInfo(id: string, userId: string, userRole: UserRole) {
  console.log('📊 جلب معلومات حالة الطلبية:', id);

  try {
    const order = await this.findOne(id, userId, userRole);
    
    const statusInfo = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusDisplayName: this.getStatusDisplayName(order.status as OrderStatus),
      canTransitionTo: this.getAvailableStatusTransitions(order.status as OrderStatus),
      completionRequirements: this.getCompletionRequirements(order),
      isReadyForCompletion: this.isOrderReadyForCompletion(order),
      updatedAt: order.updatedAt,
    };

    return statusInfo;
  } catch (error) {
    console.error('❌ خطأ في جلب معلومات حالة الطلبية:', error);
    throw error;
  }
}


validateOrderResponse(order: any): boolean {
  const requiredFields = [
    'id', 'orderNumber', 'client', 'status', 'driverId',
    'hasImages', 'hasDriverSignature', 'hasCustomerSignature',
    'hasAllSignatures', 'isReadyForCompletion'
  ];
  
  for (const field of requiredFields) {
    if (order[field] === undefined) {
      console.warn('⚠️ حقل مفقود في استجابة الطلبية:', field);
      return false;
    }
  }
  
  // التحقق من صحة الحالة
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(order.status)) {
    console.warn('⚠️ حالة غير صحيحة في الاستجابة:', order.status);
    return false;
  }
  
  return true;
}

// دالة للحصول على الحالات المتاحة للانتقال إليها
private getAvailableStatusTransitions(currentStatus: OrderStatus): string[] {
  const transitions = {
    [OrderStatus.PENDING]: ['in_progress', 'cancelled'],
    [OrderStatus.IN_PROGRESS]: ['completed', 'cancelled'],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  return transitions[currentStatus] || [];
}

// دالة للتحقق من متطلبات الإكمال
private getCompletionRequirements(order: any) {
  return {
    hasImages: order.images && order.images.length > 0,
    hasDriverSignature: !!order.driverSignature,
    hasCustomerSignature: !!order.customerSignature,
    hasExpenses: !!order.expenses,
    missingRequirements: this.getMissingRequirements(order),
  };
}

// دالة للحصول على المتطلبات المفقودة
private getMissingRequirements(order: any): string[] {
  const missing = [];
  
  if (!order.images || order.images.length === 0) {
    missing.push('الصور');
  }
  
  if (!order.driverSignature) {
    missing.push('توقيع السائق');
  }
  
  if (!order.customerSignature) {
    missing.push('توقيع العميل');
  }
  
  return missing;
}

// دالة للتحقق من جاهزية الطلبية للإكمال
private isOrderReadyForCompletion(order: any): boolean {
  return this.getMissingRequirements(order).length === 0;
}


// 5. حذف صورة معينة
async deleteImage(orderId: string, imageId: string, userId: string, userRole: UserRole) {
  console.log('🗑️ حذف صورة:', imageId, 'من الطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // العثور على الصورة
    const image = await this.prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException(`الصورة غير موجودة: ${imageId}`);
    }

    if (image.orderId !== orderId) {
      throw new BadRequestException('الصورة لا تنتمي لهذه الطلبية');
    }

    // حذف الملف الفعلي
    await this.deleteFile(image.imageUrl, 'images');

    // حذف الصورة من قاعدة البيانات
    await this.prisma.image.delete({
      where: { id: imageId },
    });

    console.log('✅ تم حذف الصورة بنجاح');
    return { message: 'تم حذف الصورة بنجاح' };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في حذف الصورة:', error);
    throw new BadRequestException(`فشل في حذف الصورة: ${error.message}`);
  }
}

// 6. حذف توقيع معين
async deleteSignature(orderId: string, signatureId: string, userId: string, userRole: UserRole) {
  console.log('🗑️ حذف توقيع:', signatureId, 'من الطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // العثور على التوقيع
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
    });

    if (!signature) {
      throw new NotFoundException(`التوقيع غير موجود: ${signatureId}`);
    }

    if (signature.orderId !== orderId) {
      throw new BadRequestException('التوقيع لا ينتمي لهذه الطلبية');
    }

    // حذف الملف الفعلي
    await this.deleteFile(signature.signUrl, 'signatures');

    // إزالة العلاقة من الطلبية أولاً
    await this.prisma.order.updateMany({
      where: {
        OR: [
          { driverSignatureId: signatureId },
          { customerSignatureId: signatureId },
        ],
      },
      data: {
        driverSignatureId: signature.isDriver ? null : undefined,
        customerSignatureId: !signature.isDriver ? null : undefined,
      },
    });

    // حذف التوقيع من قاعدة البيانات
    await this.prisma.signature.delete({
      where: { id: signatureId },
    });

    console.log('✅ تم حذف التوقيع بنجاح');
    return { message: 'تم حذف التوقيع بنجاح' };
  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في حذف التوقيع:', error);
    throw new BadRequestException(`فشل في حذف التوقيع: ${error.message}`);
  }
}


// 1. تحديث مصاريف الطلبية
async updateOrderExpenses(
  orderId: string,
  expensesData: any,
  userId: string,
  userRole: UserRole
) {
  console.log('🔄 تحديث مصاريف الطلبية:', orderId);
  console.log('📊 البيانات المستلمة:', expensesData);

  try {
    // التحقق من وجود الطلبية والصلاحية
    const order = await this.findOne(orderId, userId, userRole);
    
    if (!order) {
      throw new NotFoundException('الطلبية غير موجودة');
    }

    // البحث عن المصاريف الحالية
    const existingExpenses = await this.prisma.expenses.findFirst({
      where: { orderId },
    });

    let expenses;

    if (existingExpenses) {
      // تحديث المصاريف الموجودة
      expenses = await this.prisma.expenses.update({
        where: { id: existingExpenses.id },
        data: {
          fuel: expensesData.fuel || 0,
          wash: expensesData.wash || 0,
          adBlue: expensesData.adBlue || 0,
          other: expensesData.other || 0,
          tollFees: expensesData.total || 0,
          notes: expensesData.notes || null,
          updatedAt: new Date(),
        },
      });
    } else {
      // إنشاء مصاريف جديدة
      expenses = await this.prisma.expenses.create({
        data: {
          orderId: orderId,
          fuel: expensesData.fuel || 0,
          wash: expensesData.wash || 0,
          adBlue: expensesData.adBlue || 0,
          other: expensesData.other || 0,
          tollFees: expensesData.total || 0,
          notes: expensesData.notes || null,
        },
      });
    }

    console.log('✅ تم تحديث المصاريف بنجاح');
    return expenses;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في تحديث المصاريف:', error);
    throw new BadRequestException(`فشل في تحديث المصاريف: ${error.message}`);
  }
}





// 2. إضافة مصاريف جديدة
async addOrderExpenses(
  orderId: string,
  expensesData: any,
  userId: string,
  userRole: UserRole
) {
  console.log('📤 إضافة مصاريف للطلبية:', orderId);
  console.log('📊 البيانات المستلمة:', expensesData);

  try {
    // التحقق من وجود الطلبية والصلاحية
    const order = await this.findOne(orderId, userId, userRole);
    
    if (!order) {
      throw new NotFoundException('الطلبية غير موجودة');
    }

    // التحقق من عدم وجود مصاريف مسبقة
    const existingExpenses = await this.prisma.expenses.findFirst({
      where: { orderId },
    });

    if (existingExpenses) {
      throw new BadRequestException('توجد مصاريف مسجلة بالفعل لهذه الطلبية. استخدم تحديث المصاريف بدلاً من ذلك.');
    }

    // إنشاء مصاريف جديدة
    const expenses = await this.prisma.expenses.create({
      data: {
        orderId: orderId,
        fuel: expensesData.fuel || 0,
        wash: expensesData.wash || 0,
        adBlue: expensesData.adBlue || 0,
        other: expensesData.other || 0,
        tollFees: expensesData.total || 0,
        notes: expensesData.notes || null,
      },
    });

    console.log('✅ تم إضافة المصاريف بنجاح');
    return expenses;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في إضافة المصاريف:', error);
    throw new BadRequestException(`فشل في إضافة المصاريف: ${error.message}`);
  }
}



// 1. تحديث أضرار الطلبية
async updateOrderDamages(
  orderId: string,
  damages: CreateVehicleDamageDto[],
  userId: string,
  userRole: UserRole,
) {
  console.log('🔧 تحديث أضرار الطلبية:', orderId);
  console.log('📊 عدد الأضرار الجديدة:', damages.length);

  try {
    // التحقق من وجود الطلبية والصلاحية
    const order = await this.findOne(orderId, userId, userRole);
    
    if (!order) {
      throw new NotFoundException('الطلبية غير موجودة');
    }

    // تحديث الأضرار باستخدام transaction
    const updatedOrder = await this.prisma.$transaction(async (prisma) => {
      // حذف جميع الأضرار الموجودة
      await prisma.vehicleDamage.deleteMany({
        where: { orderId },
      });

      // إضافة الأضرار الجديدة
      if (damages && damages.length > 0) {
        await prisma.vehicleDamage.createMany({
          data: damages.map(damage => ({
            orderId,
            side: damage.side,
            type: damage.type,
            description: damage.description?.trim() || null,
          })),
        });
      }

      // الحصول على الطلبية المحدثة
      return await prisma.order.findUnique({
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
            }
          },
          images: true,
          driverSignature: true,
          customerSignature: true,
          expenses: true,
          damages: {
            orderBy: {
              createdAt: 'asc'
            }
          },
        },
      });
    });

    console.log('✅ تم تحديث الأضرار بنجاح');
    console.log('🔧 عدد الأضرار بعد التحديث:', updatedOrder?.damages?.length || 0);
    
    return this.formatOrderResponse(updatedOrder);

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في تحديث الأضرار:', error);
    throw new BadRequestException(`فشل في تحديث الأضرار: ${error.message}`);
  }
}

// 2. الحصول على أضرار طلبية معينة
async getOrderDamages(
  orderId: string,
  userId: string,
  userRole: UserRole,
) {
  console.log('📋 جلب أضرار الطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // جلب الأضرار
    const damages = await this.prisma.vehicleDamage.findMany({
      where: { orderId },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('✅ تم جلب الأضرار:', damages.length, 'ضرر');
    
    return damages;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في جلب الأضرار:', error);
    throw new BadRequestException(`فشل في جلب الأضرار: ${error.message}`);
  }
}

// 3. حذف ضرر معين
async deleteSpecificDamage(
  orderId: string,
  damageId: string,
  userId: string,
  userRole: UserRole,
) {
  console.log('🗑️ حذف ضرر معين:', damageId, 'من الطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // العثور على الضرر
    const damage = await this.prisma.vehicleDamage.findUnique({
      where: { id: damageId },
    });

    if (!damage) {
      throw new NotFoundException(`الضرر غير موجود: ${damageId}`);
    }

    if (damage.orderId !== orderId) {
      throw new BadRequestException('الضرر لا ينتمي لهذه الطلبية');
    }

    // حذف الضرر
    await this.prisma.vehicleDamage.delete({
      where: { id: damageId },
    });

    console.log('✅ تم حذف الضرر بنجاح');
    return { message: 'تم حذف الضرر بنجاح' };

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في حذف الضرر:', error);
    throw new BadRequestException(`فشل في حذف الضرر: ${error.message}`);
  }
}

// 4. إحصائيات الأضرار
async getDamageStatistics(
  orderId: string,
  userId: string,
  userRole: UserRole,
) {
  console.log('📊 حساب إحصائيات الأضرار للطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // جلب الأضرار
    const damages = await this.prisma.vehicleDamage.findMany({
      where: { orderId },
    });

    // حساب الإحصائيات
    const statistics = {
      totalDamages: damages.length,
      damagesBySide: this.groupDamagesBySide(damages),
      damagesByType: this.groupDamagesByType(damages),
      mostDamagedSide: this.getMostDamagedSide(damages),
      mostCommonDamageType: this.getMostCommonDamageType(damages),
      hasDamages: damages.length > 0,
      sides: this.getUniqueSides(damages),
      types: this.getUniqueTypes(damages),
      damagesWithDescription: damages.filter(d => d.description).length,
      severityLevel: this.calculateSeverityLevel(damages),
    };

    console.log('📊 إحصائيات الأضرار:', statistics);
    return statistics;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في حساب إحصائيات الأضرار:', error);
    throw new BadRequestException(`فشل في حساب الإحصائيات: ${error.message}`);
  }
}

// 5. دوال مساعدة للإحصائيات
private groupDamagesBySide(damages: any[]) {
  const grouped = {};
  damages.forEach(damage => {
    const side = damage.side;
    if (!grouped[side]) {
      grouped[side] = 0;
    }
    grouped[side]++;
  });
  return grouped;
}

private groupDamagesByType(damages: any[]) {
  const grouped = {};
  damages.forEach(damage => {
    const type = damage.type;
    if (!grouped[type]) {
      grouped[type] = 0;
    }
    grouped[type]++;
  });
  return grouped;
}

private getMostDamagedSide(damages: any[]): string | null {
  if (damages.length === 0) return null;
  
  const sideCount = this.groupDamagesBySide(damages);
  const mostDamaged = Object.entries(sideCount).reduce((a, b) => 
    sideCount[a[0]] > sideCount[b[0]] ? a : b
  );
  
  return mostDamaged[0];
}

private getMostCommonDamageType(damages: any[]): string | null {
  if (damages.length === 0) return null;
  
  const typeCount = this.groupDamagesByType(damages);
  const mostCommon = Object.entries(typeCount).reduce((a, b) => 
    typeCount[a[0]] > typeCount[b[0]] ? a : b
  );
  
  return mostCommon[0];
}

private getUniqueSides(damages: any[]): string[] {
  return [...new Set(damages.map(d => d.side))];
}

private getUniqueTypes(damages: any[]): string[] {
  return [...new Set(damages.map(d => d.type))];
}

private calculateSeverityLevel(damages: any[]): string {
  if (damages.length === 0) return 'NONE';
  if (damages.length <= 2) return 'LOW';
  if (damages.length <= 5) return 'MEDIUM';
  if (damages.length <= 8) return 'HIGH';
  return 'SEVERE';
}

// 6. إضافة ضرر واحد
async addSingleDamage(
  orderId: string,
  damageData: CreateVehicleDamageDto,
  userId: string,
  userRole: UserRole,
) {
  console.log('➕ إضافة ضرر جديد للطلبية:', orderId);
  console.log('📊 بيانات الضرر:', damageData);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // التحقق من عدم وجود نفس الضرر
    const existingDamage = await this.prisma.vehicleDamage.findFirst({
      where: {
        orderId,
        side: damageData.side,
        type: damageData.type,
      },
    });

    if (existingDamage) {
      throw new BadRequestException('هذا الضرر موجود بالفعل في نفس الجانب');
    }

    // إضافة الضرر الجديد
    const newDamage = await this.prisma.vehicleDamage.create({
      data: {
        orderId,
        side: damageData.side,
        type: damageData.type,
        description: damageData.description?.trim() || null,
      },
    });

    console.log('✅ تم إضافة الضرر بنجاح:', newDamage.id);
    return newDamage;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في إضافة الضرر:', error);
    throw new BadRequestException(`فشل في إضافة الضرر: ${error.message}`);
  }
}

// 7. تحديث ضرر معين
async updateSingleDamage(
  orderId: string,
  damageId: string,
  damageData: Partial<CreateVehicleDamageDto>,
  userId: string,
  userRole: UserRole,
) {
  console.log('📝 تحديث ضرر معين:', damageId);
  console.log('📊 البيانات الجديدة:', damageData);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // العثور على الضرر
    const existingDamage = await this.prisma.vehicleDamage.findUnique({
      where: { id: damageId },
    });

    if (!existingDamage) {
      throw new NotFoundException(`الضرر غير موجود: ${damageId}`);
    }

    if (existingDamage.orderId !== orderId) {
      throw new BadRequestException('الضرر لا ينتمي لهذه الطلبية');
    }

    // تحديث الضرر
    const updatedDamage = await this.prisma.vehicleDamage.update({
      where: { id: damageId },
      data: {
        side: damageData.side || existingDamage.side,
        type: damageData.type || existingDamage.type,
        description: damageData.description !== undefined 
          ? (damageData.description?.trim() || null)
          : existingDamage.description,
        updatedAt: new Date(),
      },
    });

    console.log('✅ تم تحديث الضرر بنجاح');
    return updatedDamage;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    console.error('❌ خطأ في تحديث الضرر:', error);
    throw new BadRequestException(`فشل في تحديث الضرر: ${error.message}`);
  }
}

// 8. حذف جميع أضرار طلبية
async clearAllOrderDamages(
  orderId: string,
  userId: string,
  userRole: UserRole,
) {
  console.log('🗑️ حذف جميع أضرار الطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // حذف جميع الأضرار
    const deleteResult = await this.prisma.vehicleDamage.deleteMany({
      where: { orderId },
    });

    console.log('✅ تم حذف جميع الأضرار:', deleteResult.count, 'ضرر');
    
    return {
      message: 'تم حذف جميع الأضرار بنجاح',
      deletedCount: deleteResult.count,
    };

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في حذف جميع الأضرار:', error);
    throw new BadRequestException(`فشل في حذف الأضرار: ${error.message}`);
  }
}


// إضافة دوال إضافية في OrdersService

// 9. الحصول على الأضرار حسب الجانب
async getDamagesBySide(
  orderId: string,
  side: VehicleSide,
  userId: string,
  userRole: UserRole,
) {
  console.log('📋 جلب أضرار الجانب:', side, 'للطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // جلب الأضرار حسب الجانب
    const damages = await this.prisma.vehicleDamage.findMany({
      where: {
        orderId,
        side,
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('✅ تم جلب أضرار الجانب:', damages.length, 'ضرر');
    return damages;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في جلب أضرار الجانب:', error);
    throw new BadRequestException(`فشل في جلب أضرار الجانب: ${error.message}`);
  }
}

// 10. الحصول على الأضرار حسب النوع
async getDamagesByType(
  orderId: string,
  type: DamageType,
  userId: string,
  userRole: UserRole,
) {
  console.log('📋 جلب أضرار النوع:', type, 'للطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    await this.findOne(orderId, userId, userRole);

    // جلب الأضرار حسب النوع
    const damages = await this.prisma.vehicleDamage.findMany({
      where: {
        orderId,
        type,
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log('✅ تم جلب أضرار النوع:', damages.length, 'ضرر');
    return damages;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في جلب أضرار النوع:', error);
    throw new BadRequestException(`فشل في جلب أضرار النوع: ${error.message}`);
  }
}

// 11. إنشاء تقرير الأضرار
async generateDamageReport(
  orderId: string,
  userId: string,
  userRole: UserRole,
) {
  console.log('📊 إنشاء تقرير الأضرار للطلبية:', orderId);

  try {
    // التحقق من الصلاحية
    const order = await this.findOne(orderId, userId, userRole);

    // جلب جميع الأضرار
    const damages = await this.prisma.vehicleDamage.findMany({
      where: { orderId },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // حساب الإحصائيات المفصلة
    const statistics = await this.getDamageStatistics(orderId, userId, userRole);

    // إنشاء التقرير
    const report = {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        client: order.client,
        vehicleOwner: order.vehicleOwner,
        licensePlateNumber: order.licensePlateNumber,
        createdAt: order.createdAt,
      },
      damages: {
        total: damages.length,
        list: damages.map(damage => ({
          id: damage.id,
          side: damage.side,
          sideText: this.getVehicleSideText(damage.side),
          type: damage.type,
          typeText: this.getDamageTypeText(damage.type),
          description: damage.description,
          createdAt: damage.createdAt,
        })),
        statistics,
      },
      summary: {
        hasDamages: damages.length > 0,
        severityLevel: statistics.severityLevel,
        affectedSides: statistics.sides.length,
        differentDamageTypes: statistics.types.length,
        damagesWithDescription: statistics.damagesWithDescription,
        reportGeneratedAt: new Date(),
      },
      recommendations: this.generateDamageRecommendations(damages, statistics),
    };

    console.log('📊 تم إنشاء تقرير الأضرار بنجاح');
    return report;

  } catch (error) {
    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      throw error;
    }
    console.error('❌ خطأ في إنشاء تقرير الأضرار:', error);
    throw new BadRequestException(`فشل في إنشاء التقرير: ${error.message}`);
  }
}

// 12. دوال مساعدة للنصوص
private getVehicleSideText(side: VehicleSide): string {
  const sideTexts = {
    [VehicleSide.FRONT]: 'الأمام',
    [VehicleSide.REAR]: 'الخلف',
    [VehicleSide.LEFT]: 'اليسار',
    [VehicleSide.RIGHT]: 'اليمين',
    [VehicleSide.TOP]: 'الأعلى',
  };
  return sideTexts[side] || side;
}

private getDamageTypeText(type: DamageType): string {
  const typeTexts = {
    [DamageType.DENT_BUMP]: 'خدش/نتوء',
    [DamageType.STONE_CHIP]: 'رقائق حجرية',
    [DamageType.SCRATCH_GRAZE]: 'خدش/كشط',
    [DamageType.PAINT_DAMAGE]: 'ضرر طلاء',
    [DamageType.CRACK_BREAK]: 'تشقق/كسر',
    [DamageType.MISSING]: 'مفقود',
  };
  return typeTexts[type] || type;
}

// 13. إنشاء التوصيات بناءً على الأضرار
private generateDamageRecommendations(damages: any[], statistics: any): string[] {
  const recommendations = [];

  if (damages.length === 0) {
    recommendations.push('لا توجد أضرار مسجلة - السيارة في حالة جيدة');
    return recommendations;
  }

  // توصيات حسب مستوى الخطورة
  switch (statistics.severityLevel) {
    case 'LOW':
      recommendations.push('أضرار طفيفة - يُنصح بالإصلاح عند الحاجة');
      break;
    case 'MEDIUM':
      recommendations.push('أضرار متوسطة - يُنصح بالإصلاح في أقرب وقت');
      break;
    case 'HIGH':
      recommendations.push('أضرار كثيرة - يتطلب إصلاح فوري');
      break;
    case 'SEVERE':
      recommendations.push('أضرار جسيمة - يتطلب فحص شامل وإصلاح عاجل');
      break;
  }

  // توصيات حسب نوع الأضرار
  const damageTypes = statistics.types;
  
  if (damageTypes.includes('CRACK_BREAK')) {
    recommendations.push('يوجد تشققات أو كسور - يتطلب فحص هيكلي');
  }
  
  if (damageTypes.includes('MISSING')) {
    recommendations.push('يوجد أجزاء مفقودة - يتطلب استبدال فوري');
  }
  
  if (damageTypes.includes('PAINT_DAMAGE')) {
    recommendations.push('يوجد أضرار في الطلاء - يُنصح بإعادة الطلاء لمنع الصدأ');
  }

  // توصيات حسب الجوانب المتضررة
  if (statistics.sides.length >= 4) {
    recommendations.push('أضرار في معظم جوانب السيارة - يتطلب فحص شامل');
  }

  if (statistics.mostDamagedSide === 'FRONT') {
    recommendations.push('أضرار مركزة في المقدمة - فحص أنظمة السلامة الأمامية');
  }

  return recommendations;
}


}