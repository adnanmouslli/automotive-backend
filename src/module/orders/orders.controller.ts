import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Put,
  HttpException,
  Query,
  NotFoundException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, CreateVehicleDamageDto, UpdateDamagesDto } from './dto/create-order.dto';
import { JwtAuthGuard } from 'src/common';
import { DamageType, UserRole, VehicleSide } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createOrderDto: CreateOrderDto, 
    @Request() req: AuthenticatedRequest
  ) {
    console.log('🎯 تلقي طلب إنشاء طلبية جديدة');
    console.log('👤 معلومات المستخدم:', {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    });

    // التأكد من وجود معرف المستخدم
    if (!req.user.id) {
      throw new Error('معرف المستخدم مفقود في الطلب');
    }

    return this.ordersService.create(createOrderDto, req.user.id);
  }

  // 1. تحديث المصاريف
@Put(':id/expenses')
async updateExpenses(
  @Param('id') orderId: string,
  @Body() expensesData: any,
  @Request() req: AuthenticatedRequest
) {
  console.log('🔄 تحديث مصاريف الطلبية:', orderId);
  console.log('📊 البيانات المستلمة:', expensesData);

  try {
    // التحقق من وجود orderId في البيانات
    if (!expensesData.orderId) {
      expensesData.orderId = orderId;
    }

    const result = await this.ordersService.updateOrderExpenses(
      orderId,
      expensesData,
      req.user.id,
      req.user.role as any
    );

    return {
      success: true,
      message: 'تم تحديث المصاريف بنجاح',
      data: result,
    };
  } catch (error) {
    throw new HttpException(
      {
        success: false,
        message: error.message || 'فشل في تحديث المصاريف',
        error: error.name,
      },
      error.status || HttpStatus.BAD_REQUEST,
    );
  }
}


// 2. إضافة المصاريف (endpoint منفصل للوضوح)
@Post(':id/expenses')
async addExpenses(
  @Param('id') orderId: string,
  @Body() expensesData: any,
  @Request() req: AuthenticatedRequest
) {
  console.log('📤 إضافة مصاريف للطلبية:', orderId);
  console.log('📊 البيانات المستلمة:', expensesData);

  try {
    // التحقق من وجود orderId في البيانات
    if (!expensesData.orderId) {
      expensesData.orderId = orderId;
    }

    const result = await this.ordersService.addOrderExpenses(
      orderId,
      expensesData,
      req.user.id,
      req.user.role as any
    );

    return {
      success: true,
      message: 'تم إضافة المصاريف بنجاح',
      data: result,
    };
  } catch (error) {
    throw new HttpException(
      {
        success: false,
        message: error.message || 'فشل في إضافة المصاريف',
        error: error.name,
      },
      error.status || HttpStatus.BAD_REQUEST,
    );
  }
}



  @Get()
  async findAll(@Request() req, @Query('status') status?: string) {
    try {
      
      const orders = await this.ordersService.findAll(req.user.id, req.user.role);
      
      // تطبيق فلتر الحالة إذا تم تمريره
      let filteredOrders = orders;
      if (status && status !== 'all') {
        filteredOrders = orders.filter(order => order.status === status.toLowerCase());
      }

      
      
      return {
        success: true,
        message: 'تم جلب الطلبيات بنجاح',
        data: filteredOrders,
        total: orders.length,
        filtered: filteredOrders.length,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'فشل في جلب الطلبيات',
          error: error.name,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


  @Get('stats')
  async getStats(@Request() req: AuthenticatedRequest) {
    console.log('📊 طلب إحصائيات الطلبيات للمستخدم:', req.user.email);
    
    return this.ordersService.getOrderStats(req.user.id, req.user.role as any);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string, 
    @Request() req: AuthenticatedRequest
  ) {
    console.log('🔍 طلب عرض الطلبية:', id, 'للمستخدم:', req.user.email);
    
    return this.ordersService.findOne(id, req.user.id, req.user.role as any);
  }

 @Put(':id')
async update(
  @Param('id') id: string, 
  @Body() updateOrderDto: Partial<CreateOrderDto>, 
  @Request() req: AuthenticatedRequest
) {
  console.log('📝 طلب تحديث الطلبية:', id, 'للمستخدم:', req.user.email);
  console.log('📊 البيانات المستلمة:', updateOrderDto);
  
  return this.ordersService.update(id, updateOrderDto, req.user.id, req.user.role as any);
}


  @Delete(':id')
  async remove(
    @Param('id') id: string, 
    @Request() req: AuthenticatedRequest
  ) {
    console.log('🗑️ طلب حذف الطلبية:', id, 'للمستخدم:', req.user.email);
    
    return this.ordersService.remove(id, req.user.id, req.user.role as any);
  }


  // 1. تحديث حالة الطلبية (إتمام الطلب)
@Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req,
  ) {
    try {
      
      // التحقق من صحة الحالة
      if (!status || typeof status !== 'string') {
        throw new HttpException(
          {
            success: false,
            message: 'الحالة مطلوبة ويجب أن تكون نص',
            error: 'INVALID_STATUS',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      const normalizedStatus = status.toLowerCase().trim();
      
      if (!validStatuses.includes(normalizedStatus)) {
        throw new HttpException(
          {
            success: false,
            message: `حالة غير صحيحة: ${status}. الحالات المتاحة: ${validStatuses.join(', ')}`,
            error: 'INVALID_STATUS',
            validStatuses: validStatuses,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const order = await this.ordersService.updateOrderStatus(
        id,
        normalizedStatus,
        req.user.id,
        req.user.role,
      );
      
      
      return {
        success: true,
        message: `تم تحديث حالة الطلبية`,
        data: order,
        previousStatus: status, // الحالة السابقة للمرجع
        newStatus: order.status, // الحالة الجديدة
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'فشل في تحديث حالة الطلبية',
          error: error.name,
          orderId: id,
          requestedStatus: status,
        },
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }


@Get(':id/status')
  async getOrderStatus(@Param('id') id: string, @Request() req) {
    try {
      
      const statusInfo = await this.ordersService.getOrderStatusInfo(
        id,
        req.user.id,
        req.user.role,
      );
      
      
      return {
        success: true,
        message: 'تم جلب معلومات الحالة بنجاح',
        data: statusInfo,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'فشل في جلب معلومات الحالة',
          error: error.name,
        },
        error.status || HttpStatus.NOT_FOUND,
      );
    }
  }


// 2. حذف صورة من الطلبية
@Delete(':id/images/:imageId')
@HttpCode(HttpStatus.NO_CONTENT)
async deleteImage(
  @Param('id') orderId: string,
  @Param('imageId') imageId: string,
  @Request() req: AuthenticatedRequest
) {
  console.log('🗑️ طلب حذف صورة:', imageId, 'من الطلبية:', orderId);
  
  return this.ordersService.deleteImage(
    orderId,
    imageId,
    req.user.id,
    req.user.role as any
  );
}

// 3. حذف توقيع من الطلبية
@Delete(':id/signatures/:signatureId')
@HttpCode(HttpStatus.NO_CONTENT)
async deleteSignature(
  @Param('id') orderId: string,
  @Param('signatureId') signatureId: string,
  @Request() req: AuthenticatedRequest
) {
  console.log('🗑️ طلب حذف توقيع:', signatureId, 'من الطلبية:', orderId);
  
  return this.ordersService.deleteSignature(
    orderId,
    signatureId,
    req.user.id,
    req.user.role as any
  );
}


@Patch(':id/damages')
@UseGuards(JwtAuthGuard)
async updateOrderDamages(
  @Param('id') id: string,
  @Body() updateDamagesDto: UpdateDamagesDto,
  @Req() req: any,
) {
  console.log('🔧 تحديث أضرار الطلبية:', id);
  console.log('📊 الأضرار الجديدة:', updateDamagesDto.damages);

  try {
    const updatedOrder = await this.ordersService.updateOrderDamages(
      id,
      updateDamagesDto.damages,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      message: 'تم تحديث أضرار السيارة بنجاح',
      data: updatedOrder,
    };
  } catch (error) {
    console.error('❌ خطأ في تحديث الأضرار:', error);
    throw error;
  }
}

// 2. الحصول على أضرار طلبية معينة
@Get(':id/damages')
@UseGuards(JwtAuthGuard)
async getOrderDamages(
  @Param('id') id: string,
  @Req() req: any,
) {
  console.log('📋 جلب أضرار الطلبية:', id);

  try {
    const damages = await this.ordersService.getOrderDamages(
      id,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: damages,
    };
  } catch (error) {
    console.error('❌ خطأ في جلب الأضرار:', error);
    throw error;
  }
}

// 3. حذف ضرر معين
@Delete(':id/damages/:damageId')
@UseGuards(JwtAuthGuard)
async deleteSpecificDamage(
  @Param('id') id: string,
  @Param('damageId') damageId: string,
  @Req() req: any,
) {
  console.log('🗑️ حذف ضرر معين:', damageId, 'من الطلبية:', id);

  try {
    await this.ordersService.deleteSpecificDamage(
      id,
      damageId,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      message: 'تم حذف الضرر بنجاح',
    };
  } catch (error) {
    console.error('❌ خطأ في حذف الضرر:', error);
    throw error;
  }
}

// 4. إحصائيات الأضرار
@Get(':id/damages/statistics')
@UseGuards(JwtAuthGuard)
async getDamageStatistics(
  @Param('id') id: string,
  @Req() req: any,
) {
  console.log('📊 جلب إحصائيات الأضرار للطلبية:', id);

  try {
    const statistics = await this.ordersService.getDamageStatistics(
      id,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: statistics,
    };
  } catch (error) {
    console.error('❌ خطأ في جلب إحصائيات الأضرار:', error);
    throw error;
  }
}


// 5. إضافة ضرر واحد
@Post(':id/damages')
@UseGuards(JwtAuthGuard)
async addSingleDamage(
  @Param('id') id: string,
  @Body() damageDto: CreateVehicleDamageDto,
  @Req() req: any,
) {
  console.log('➕ إضافة ضرر جديد للطلبية:', id);

  try {
    const newDamage = await this.ordersService.addSingleDamage(
      id,
      damageDto,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      message: 'تم إضافة الضرر بنجاح',
      data: newDamage,
    };
  } catch (error) {
    console.error('❌ خطأ في إضافة الضرر:', error);
    throw error;
  }
}

// 6. تحديث ضرر معين
@Patch(':id/damages/:damageId')
@UseGuards(JwtAuthGuard)
async updateSingleDamage(
  @Param('id') id: string,
  @Param('damageId') damageId: string,
  @Body() damageDto: Partial<CreateVehicleDamageDto>,
  @Req() req: any,
) {
  console.log('📝 تحديث ضرر معين:', damageId);

  try {
    const updatedDamage = await this.ordersService.updateSingleDamage(
      id,
      damageId,
      damageDto,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      message: 'تم تحديث الضرر بنجاح',
      data: updatedDamage,
    };
  } catch (error) {
    console.error('❌ خطأ في تحديث الضرر:', error);
    throw error;
  }
}

// 7. حذف جميع أضرار الطلبية
@Delete(':id/damages')
@UseGuards(JwtAuthGuard)
async clearAllOrderDamages(
  @Param('id') id: string,
  @Req() req: any,
) {
  console.log('🗑️ حذف جميع أضرار الطلبية:', id);

  try {
    const result = await this.ordersService.clearAllOrderDamages(
      id,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      message: 'تم حذف جميع الأضرار بنجاح',
      data: result,
    };
  } catch (error) {
    console.error('❌ خطأ في حذف جميع الأضرار:', error);
    throw error;
  }
}

// 8. الحصول على الأضرار حسب الجانب
@Get(':id/damages/side/:side')
@UseGuards(JwtAuthGuard)
async getDamagesBySide(
  @Param('id') id: string,
  @Param('side') side: string,
  @Req() req: any,
) {
  console.log('📋 جلب أضرار الجانب:', side, 'للطلبية:', id);

  try {
    // التحقق من صحة الجانب
    const validSides = Object.values(VehicleSide);
    if (!validSides.includes(side as VehicleSide)) {
      throw new BadRequestException(`جانب غير صحيح: ${side}`);
    }

    const damages = await this.ordersService.getDamagesBySide(
      id,
      side as VehicleSide,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: damages,
    };
  } catch (error) {
    console.error('❌ خطأ في جلب أضرار الجانب:', error);
    throw error;
  }
}

// 9. الحصول على الأضرار حسب النوع
@Get(':id/damages/type/:type')
@UseGuards(JwtAuthGuard)
async getDamagesByType(
  @Param('id') id: string,
  @Param('type') type: string,
  @Req() req: any,
) {
  console.log('📋 جلب أضرار النوع:', type, 'للطلبية:', id);

  try {
    // التحقق من صحة نوع الضرر
    const validTypes = Object.values(DamageType);
    if (!validTypes.includes(type as DamageType)) {
      throw new BadRequestException(`نوع ضرر غير صحيح: ${type}`);
    }

    const damages = await this.ordersService.getDamagesByType(
      id,
      type as DamageType,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: damages,
    };
  } catch (error) {
    console.error('❌ خطأ في جلب أضرار النوع:', error);
    throw error;
  }
}

// 10. تصدير تقرير الأضرار
@Get(':id/damages/report')
@UseGuards(JwtAuthGuard)
async generateDamageReport(
  @Param('id') id: string,
  @Req() req: any,
) {
  console.log('📊 إنشاء تقرير الأضرار للطلبية:', id);

  try {
    const report = await this.ordersService.generateDamageReport(
      id,
      req.user.id,
      req.user.role,
    );

    return {
      success: true,
      data: report,
    };
  } catch (error) {
    console.error('❌ خطأ في إنشاء تقرير الأضرار:', error);
    throw error;
  }
}

}
