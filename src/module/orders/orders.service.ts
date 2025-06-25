// src/orders/orders.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateAddressDto, CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, UserRole } from '@prisma/client';
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

    const { pickupAddress, deliveryAddress, ...orderData } = createOrderDto;

    try {
      const order = await this.prisma.order.create({
        data: {
          // بيانات الطلبية الأساسية
          client: orderData.client,
          clientPhone: orderData.clientPhone,
          clientEmail: orderData.clientEmail,
          description: orderData.description,
          comments: orderData.comments,
          items: orderData.items || [],
          
          // ربط بالسائق
          driver: {
            connect: {
              id: userId
            }
          },
          
          // إنشاء عنوان الاستلام
          pickupAddress: pickupAddress ? {
            create: {
              street: pickupAddress.street,
              houseNumber: pickupAddress.houseNumber,
              zipCode: pickupAddress.zipCode,
              city: pickupAddress.city,
              country: pickupAddress.country || 'Deutschland',
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
            }
          } : undefined,
          
          // إنشاء بيانات السيارة
          vehicleData: {
            create: {
              vehicleOwner: orderData.vehicleOwner,
              licensePlateNumber: orderData.licensePlateNumber,
              vin: orderData.vin,
              brand: orderData.brand,
              model: orderData.model,
              year: orderData.year,
              color: orderData.color,
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
          images: true,
          driverSignature: true,
          customerSignature: true,
          expenses: true,
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
    console.log('📝 تحديث الطلبية:', id);
    console.log('📊 البيانات المستلمة:', updateData);

    // التحقق من وجود الطلبية والصلاحيات
    const existingOrder = await this.findOne(id, userId, userRole);
    if (!existingOrder) {
      throw new NotFoundException('الطلبية غير موجودة');
    }

    const { pickupAddress, deliveryAddress, ...orderData } = updateData;

    try {
      // إعداد البيانات للتحديث مع التحقق من القيم
      const updatePayload: any = {
        updatedAt: new Date(),
      };

      // تحديث البيانات الأساسية
      if (orderData.client?.trim()) updatePayload.client = orderData.client.trim();
      if (orderData.clientPhone?.trim()) updatePayload.clientPhone = orderData.clientPhone.trim();
      if (orderData.clientEmail?.trim()) updatePayload.clientEmail = orderData.clientEmail.trim();
      if (orderData.description !== undefined) updatePayload.description = orderData.description?.trim() || null;
      if (orderData.comments !== undefined) updatePayload.comments = orderData.comments?.trim() || null;
      if (orderData.items) updatePayload.items = orderData.items;

      // تحديث عنوان الاستلام
      if (pickupAddress && this.validateAddress(pickupAddress)) {
        updatePayload.pickupAddress = {
          update: {
            street: pickupAddress.street.trim(),
            houseNumber: pickupAddress.houseNumber.trim(),
            zipCode: pickupAddress.zipCode.trim(),
            city: pickupAddress.city.trim(),
            country: pickupAddress.country?.trim() || 'Deutschland',
            updatedAt: new Date(),
          }
        };
      }

      // تحديث عنوان التسليم
      if (deliveryAddress && this.validateAddress(deliveryAddress)) {
        updatePayload.deliveryAddress = {
          update: {
            street: deliveryAddress.street.trim(),
            houseNumber: deliveryAddress.houseNumber.trim(),
            zipCode: deliveryAddress.zipCode.trim(),
            city: deliveryAddress.city.trim(),
            country: deliveryAddress.country?.trim() || 'Deutschland',
            updatedAt: new Date(),
          }
        };
      }

      // تحديث بيانات السيارة
      const vehicleUpdateData: any = {};
      if (orderData.vehicleOwner?.trim()) vehicleUpdateData.vehicleOwner = orderData.vehicleOwner.trim();
      if (orderData.licensePlateNumber?.trim()) vehicleUpdateData.licensePlateNumber = orderData.licensePlateNumber.trim();
      if (orderData.vin?.trim()) vehicleUpdateData.vin = orderData.vin.trim();
      if (orderData.brand?.trim()) vehicleUpdateData.brand = orderData.brand.trim();
      if (orderData.model?.trim()) vehicleUpdateData.model = orderData.model.trim();
      if (orderData.year) vehicleUpdateData.year = orderData.year;
      if (orderData.color?.trim()) vehicleUpdateData.color = orderData.color.trim();

      if (Object.keys(vehicleUpdateData).length > 0) {
        vehicleUpdateData.updatedAt = new Date();
        updatePayload.vehicleData = {
          update: vehicleUpdateData
        };
      }

      // تحديث بيانات الخدمة
      const serviceUpdateData: any = {};
      if (orderData.vehicleType?.trim()) serviceUpdateData.vehicleType = orderData.vehicleType.trim();
      if (orderData.serviceType) serviceUpdateData.serviceType = orderData.serviceType;
      if (orderData.serviceDescription !== undefined) {
        serviceUpdateData.description = orderData.serviceDescription?.trim() || null;
      }

      if (Object.keys(serviceUpdateData).length > 0) {
        serviceUpdateData.updatedAt = new Date();
        updatePayload.service = {
          update: serviceUpdateData
        };
      }

      console.log('📦 البيانات المحضرة للتحديث:', JSON.stringify(updatePayload, null, 2));

      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: updatePayload,
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
    description: order.description,
    comments: order.comments,
    items: order.items || [],
    
    // بيانات السيارة
    vehicleOwner: order.vehicleData?.vehicleOwner,
    licensePlateNumber: order.vehicleData?.licensePlateNumber,
    vin: order.vehicleData?.vin,
    brand: order.vehicleData?.brand,
    model: order.vehicleData?.model,
    year: order.vehicleData?.year,
    color: order.vehicleData?.color,
    
    // بيانات الخدمة
    vehicleType: order.service?.vehicleType,
    serviceType: order.service?.serviceType,
    serviceDescription: order.service?.description,
    
    // العناوين
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    
    // الحالة والسائق
    status: status, // الحالة المُنسَّقة
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
    isReady: formattedOrder.isReadyForCompletion
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

    // حذف الطلبية من قاعدة البيانات
    await this.prisma.order.delete({
      where: { id },
    });

    console.log('✅ تم حذف الطلبية بنجاح');
    
    // إرجاع object مع تفاصيل أكثر
    return {
      success: true,
      message: 'تم حذف الطلبية بنجاح',
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

}