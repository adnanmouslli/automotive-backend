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
  async findAll(@Request() req: AuthenticatedRequest) {
    console.log('📋 طلب عرض الطلبيات للمستخدم:', req.user.email);
    
    return this.ordersService.findAll(req.user.id, req.user.role as any);
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

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateOrderDto: Partial<CreateOrderDto>, 
    @Request() req: AuthenticatedRequest
  ) {
    console.log('📝 طلب تحديث الطلبية:', id, 'للمستخدم:', req.user.email);
    
    return this.ordersService.update(id, updateOrderDto, req.user.id, req.user.role as any);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string, 
    @Request() req: AuthenticatedRequest
  ) {
    console.log('🗑️ طلب حذف الطلبية:', id, 'للمستخدم:', req.user.email);
    
    return this.ordersService.remove(id, req.user.id, req.user.role as any);
  }
}
