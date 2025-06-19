import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UploadsService } from './uploads.service';
import { ImageCategory } from '@prisma/client';
import { JwtAuthGuard } from 'src/common';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/images',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        console.log('📁 فحص نوع ملف الصورة:', file.mimetype);
        console.log('📝 اسم الملف الأصلي:', file.originalname);
        console.log('📦 معلومات إضافية:', {
          encoding: file.encoding,
          fieldname: file.fieldname,
          size: file.size || 'غير محدد'
        });
        
        // قبول الصور بأنواعها المختلفة
        const allowedImageTypes = [
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/tiff',
          'image/svg+xml',
          // قبول application/octet-stream للصور من Flutter
          'application/octet-stream'
        ];
        
        // فحص إضافي للتأكد من أن الملف هو صورة حتى لو كان النوع octet-stream
        const isLikelyImage = file.originalname && 
          (file.originalname.toLowerCase().endsWith('.jpg') || 
           file.originalname.toLowerCase().endsWith('.jpeg') ||
           file.originalname.toLowerCase().endsWith('.png') ||
           file.originalname.toLowerCase().endsWith('.gif') ||
           file.originalname.toLowerCase().endsWith('.webp') ||
           file.originalname.toLowerCase().endsWith('.bmp') ||
           file.originalname.toLowerCase().endsWith('.tiff') ||
           file.originalname.toLowerCase().includes('image') ||
           file.originalname.toLowerCase().includes('photo') ||
           file.originalname.toLowerCase().includes('picture'));
        
        if (allowedImageTypes.includes(file.mimetype) || isLikelyImage) {
          console.log('✅ نوع ملف الصورة مقبول:', file.mimetype);
          if (file.mimetype === 'application/octet-stream') {
            console.log('ℹ️ تم قبول الملف كصورة بناءً على اسم الملف:', file.originalname);
          }
          cb(null, true);
        } else {
          console.error('❌ نوع ملف صورة غير مدعوم:', file.mimetype);
          console.error('📄 اسم الملف:', file.originalname);
          cb(new BadRequestException(`نوع الملف غير مدعوم: ${file.mimetype}. الملفات المدعومة: JPEG, PNG, GIF, WebP, BMP, أو ملفات بامتداد صور صحيح`), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { 
      orderId: string; 
      category: ImageCategory; 
      description?: string 
    },
  ) {
    console.log('📤 طلب رفع صورة:');
    console.log('  - اسم الملف:', file?.originalname);
    console.log('  - حجم الملف:', file?.size);
    console.log('  - نوع الملف:', file?.mimetype);
    console.log('  - مسار الملف:', file?.path);
    console.log('  - معرف الطلبية:', body.orderId);
    console.log('  - فئة الصورة:', body.category);
    console.log('  - وصف الصورة:', body.description);

    if (!file) {
      throw new BadRequestException('لم يتم العثور على ملف للرفع');
    }

    if (!body.orderId) {
      throw new BadRequestException('معرف الطلبية مطلوب');
    }

    if (!body.category) {
      throw new BadRequestException('فئة الصورة مطلوبة');
    }

    // التحقق من صحة فئة الصورة
    if (!Object.values(ImageCategory).includes(body.category)) {
      throw new BadRequestException(`فئة الصورة غير صحيحة: ${body.category}`);
    }

    try {
      const result = await this.uploadsService.uploadImage(
        file,
        body.orderId,
        body.category as ImageCategory,
        body.description || '',
      );

      console.log('✅ تم رفع الصورة بنجاح:', result.id);
      return result;
    } catch (error) {
      console.error('❌ خطأ في رفع الصورة:', error);
      throw new BadRequestException(`فشل في رفع الصورة: ${error.message}`);
    }
  }

  @Post('signature')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/signatures',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          // التأكد من أن التوقيع يحفظ كـ PNG
          cb(null, `${randomName}.png`);
        },
      }),
      fileFilter: (req, file, cb) => {
        console.log('✍️ فحص نوع ملف التوقيع:', file.mimetype);
        console.log('📝 اسم ملف التوقيع الأصلي:', file.originalname);
        console.log('📦 معلومات إضافية:', {
          encoding: file.encoding,
          fieldname: file.fieldname,
          size: file.size || 'غير محدد'
        });
        
        // قبول التوقيعات بصيغ متعددة
        const allowedSignatureTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/webp',
          // قبول application/octet-stream للتوقيعات من Flutter
          'application/octet-stream'
        ];
        
        // فحص إضافي للتأكد من أن الملف هو صورة حتى لو كان النوع octet-stream
        const isLikelyImage = file.originalname && 
          (file.originalname.endsWith('.png') || 
           file.originalname.endsWith('.jpg') || 
           file.originalname.endsWith('.jpeg') ||
           file.originalname.endsWith('.gif') ||
           file.originalname.includes('signature'));
        
        if (allowedSignatureTypes.includes(file.mimetype) || isLikelyImage) {
          console.log('✅ نوع ملف التوقيع مقبول:', file.mimetype);
          cb(null, true);
        } else {
          console.error('❌ نوع ملف توقيع غير مدعوم:', file.mimetype);
          console.error('📄 اسم الملف:', file.originalname);
          cb(new BadRequestException(`نوع ملف التوقيع غير مدعوم: ${file.mimetype}. الملفات المدعومة: PNG, JPEG, GIF`), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB للتوقيعات
      },
    }),
  )
  async uploadSignature(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { 
      orderId: string; 
      signerName: string; 
      isDriver: string 
    },
  ) {
    console.log('✍️ طلب رفع توقيع:');
    console.log('  - اسم الملف:', file?.originalname);
    console.log('  - حجم الملف:', file?.size);
    console.log('  - نوع الملف:', file?.mimetype);
    console.log('  - مسار الملف:', file?.path);
    console.log('  - معرف الطلبية:', body.orderId);
    console.log('  - اسم الموقع:', body.signerName);
    console.log('  - هل سائق:', body.isDriver);

    if (!file) {
      throw new BadRequestException('لم يتم العثور على ملف التوقيع');
    }

    if (!body.orderId || !body.signerName || body.isDriver === undefined) {
      throw new BadRequestException('جميع الحقول مطلوبة: orderId, signerName, isDriver');
    }

    if (!body.orderId.trim()) {
      throw new BadRequestException('معرف الطلبية لا يمكن أن يكون فارغاً');
    }

    if (!body.signerName.trim()) {
      throw new BadRequestException('اسم الموقع لا يمكن أن يكون فارغاً');
    }

    // تحويل isDriver إلى boolean بشكل آمن
    const isDriverBool = body.isDriver === 'true' || body.isDriver === "true";

    try {
      const result = await this.uploadsService.uploadSignature(
        file,
        body.orderId.toString(),
        body.signerName.trim(),
        isDriverBool,
      );

      console.log('✅ تم رفع التوقيع بنجاح:', result.id);
      return result;
    } catch (error) {
      console.error('❌ خطأ في رفع التوقيع:', error);
      throw new BadRequestException(`فشل في رفع التوقيع: ${error.message}`);
    }
  }

  @Post('expenses')
  async addExpenses(
    @Body() body: {
      orderId: string;
      fuel?: number;
      wash?: number;
      adBlue?: number;
      other?: number;
      tollFees?: number;
      parking?: number;
      notes?: string;
    },
  ) {
    console.log('💰 طلب إضافة مصروفات:');
    console.log('  - معرف الطلبية:', body.orderId);
    console.log('  - المصروفات:', { ...body, orderId: undefined });

    if (!body.orderId) {
      throw new BadRequestException('معرف الطلبية مطلوب');
    }

    if (!body.orderId.trim()) {
      throw new BadRequestException('معرف الطلبية لا يمكن أن يكون فارغاً');
    }

    // التحقق من أن المصروفات أرقام صحيحة
    const validateExpense = (value: any, name: string) => {
      if (value !== undefined && value !== null) {
        const num = Number(value);
        if (isNaN(num) || num < 0) {
          throw new BadRequestException(`${name} يجب أن يكون رقماً موجباً`);
        }
        return num;
      }
      return undefined;
    };

    try {
      const validatedExpenses = {
        fuel: validateExpense(body.fuel, 'الوقود'),
        wash: validateExpense(body.wash, 'الغسيل'),
        adBlue: validateExpense(body.adBlue, 'AdBlue'),
        other: validateExpense(body.other, 'أخرى'),
        tollFees: validateExpense(body.tollFees, 'رسوم الطريق'),
        parking: validateExpense(body.parking, 'مواقف السيارات'),
        notes: body.notes?.trim() || '',
      };

      // إزالة القيم undefined
      Object.keys(validatedExpenses).forEach(key => {
        if (validatedExpenses[key] === undefined) {
          delete validatedExpenses[key];
        }
      });

      console.log('✅ المصروفات المتحققة:', validatedExpenses);

      const result = await this.uploadsService.addExpenses(
        body.orderId.toString(),
        validatedExpenses
      );

      console.log('✅ تم إضافة المصروفات بنجاح:', result.id);
      return result;
    } catch (error) {
      console.error('❌ خطأ في إضافة المصروفات:', error);
      throw new BadRequestException(`فشل في إضافة المصروفات: ${error.message}`);
    }
  }
}