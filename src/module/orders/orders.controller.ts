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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from 'src/common';

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

}
