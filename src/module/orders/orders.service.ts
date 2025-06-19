// src/orders/orders.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

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
    return orders;
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
    return order;
  }

  async update(id: string, updateData: Partial<CreateOrderDto>, userId: string, userRole: UserRole) {
    console.log('📝 تحديث الطلبية:', id);

    // التحقق من وجود الطلبية والصلاحيات
    const existingOrder = await this.findOne(id, userId, userRole);

    const { pickupAddress, deliveryAddress, ...orderData } = updateData;

    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: {
          // تحديث البيانات الأساسية فقط إذا كانت موجودة
          ...(orderData.client && { client: orderData.client }),
          ...(orderData.clientPhone && { clientPhone: orderData.clientPhone }),
          ...(orderData.clientEmail && { clientEmail: orderData.clientEmail }),
          ...(orderData.description && { description: orderData.description }),
          ...(orderData.comments && { comments: orderData.comments }),
          ...(orderData.items && { items: orderData.items }),
          
          // تحديث عنوان الاستلام
          ...(pickupAddress && {
            pickupAddress: {
              update: {
                street: pickupAddress.street,
                houseNumber: pickupAddress.houseNumber,
                zipCode: pickupAddress.zipCode,
                city: pickupAddress.city,
                country: pickupAddress.country || 'Deutschland',
              }
            }
          }),
          
          // تحديث عنوان التسليم
          ...(deliveryAddress && {
            deliveryAddress: {
              update: {
                street: deliveryAddress.street,
                houseNumber: deliveryAddress.houseNumber,
                zipCode: deliveryAddress.zipCode,
                city: deliveryAddress.city,
                country: deliveryAddress.country || 'Deutschland',
              }
            }
          }),
          
          // تحديث بيانات السيارة
          ...(orderData.vehicleOwner && {
            vehicleData: {
              update: {
                ...(orderData.vehicleOwner && { vehicleOwner: orderData.vehicleOwner }),
                ...(orderData.licensePlateNumber && { licensePlateNumber: orderData.licensePlateNumber }),
                ...(orderData.vin && { vin: orderData.vin }),
                ...(orderData.brand && { brand: orderData.brand }),
                ...(orderData.model && { model: orderData.model }),
                ...(orderData.year && { year: orderData.year }),
                ...(orderData.color && { color: orderData.color }),
              }
            }
          }),
          
          // تحديث بيانات الخدمة
          ...(orderData.vehicleType && {
            service: {
              update: {
                ...(orderData.vehicleType && { vehicleType: orderData.vehicleType }),
                ...(orderData.serviceType && { serviceType: orderData.serviceType }),
                ...(orderData.serviceDescription && { description: orderData.serviceDescription }),
              }
            }
          }),
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

      console.log('✅ تم تحديث الطلبية بنجاح');
      return updatedOrder;

    } catch (error) {
      console.error('❌ خطأ في تحديث الطلبية:', error);
      throw new BadRequestException(`فشل في تحديث الطلبية: ${error.message}`);
    }
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    console.log('🗑️ حذف الطلبية:', id);

    if (userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('فقط المديرون يمكنهم حذف الطلبيات');
    }

    // التحقق من وجود الطلبية
    const order = await this.findOne(id, userId, userRole);

    try {
      await this.prisma.order.delete({
        where: { id },
      });

      console.log('✅ تم حذف الطلبية بنجاح');
      return { message: 'تم حذف الطلبية بنجاح' };

    } catch (error) {
      console.error('❌ خطأ في حذف الطلبية:', error);
      throw new BadRequestException(`فشل في حذف الطلبية: ${error.message}`);
    }
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
}