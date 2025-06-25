import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  UseGuards,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { UploadsService } from './uploads.service';
import { ImageCategory } from '@prisma/client';
import { JwtAuthGuard } from 'src/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';

// تكوين تخزين الملفات المحسن
const createImageStorage = () => diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads/images';
    
    // التأكد من وجود المجلد
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    try {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1E9);
      const ext = extname(file.originalname).toLowerCase();
      
      // قائمة الامتدادات المدعومة
      const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
      const finalExt = validExtensions.includes(ext) ? ext : '.jpg';
      
      const filename = `img_${timestamp}_${randomSuffix}${finalExt}`;
      
      console.log(`📁 إنشاء اسم ملف: ${filename} من ${file.originalname}`);
      cb(null, filename);
    } catch (error) {
      console.error('❌ خطأ في إنشاء اسم الملف:', error);
      cb(error, null);
    }
  },
});

// مرشح ملفات محسن للصور
const imageFileFilter = (req: any, file: Express.Multer.File, cb: Function) => {
  console.log('🔍 فحص ملف الصورة:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size || 'غير محدد',
    encoding: file.encoding,
  });

  // أنواع MIME المقبولة
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/svg+xml',
    'application/octet-stream', // لدعم Flutter
  ];

  // فحص الامتداد
  const hasValidExtension = file.originalname && 
    /\.(jpe?g|png|gif|webp|bmp|tiff?|svg)$/i.test(file.originalname);

  // فحص كلمات مفتاحية للصور
  const hasImageKeywords = file.originalname && 
    /(image|photo|picture|img|pic|camera)/i.test(file.originalname);

  // قبول الملف إذا كان يطابق أحد المعايير
  if (allowedMimeTypes.includes(file.mimetype) || hasValidExtension || hasImageKeywords) {
    console.log('✅ ملف مقبول:', {
      mimetype: file.mimetype,
      validExtension: hasValidExtension,
      hasKeywords: hasImageKeywords,
    });
    cb(null, true);
  } else {
    const errorMessage = `نوع الملف غير مدعوم: ${file.mimetype}. اسم الملف: ${file.originalname}`;
    console.error('❌ ملف مرفوض:', errorMessage);
    cb(new BadRequestException(errorMessage), false);
  }
};

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // رفع صورة واحدة (الطريقة الأصلية محسنة)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: createImageStorage(),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1,
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
    console.log('📤 طلب رفع صورة واحدة:');
    console.log('  - الملف:', file ? {
      name: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path,
      filename: file.filename,
    } : 'غير موجود');
    console.log('  - البيانات:', body);

    return this._processImageUpload(file, body);
  }

  // رفع صور متعددة (طريقة جديدة)
  @Post('images/multiple')
  @UseInterceptors(
    FilesInterceptor('files', 10, { // حد أقصى 10 ملفات
      storage: createImageStorage(),
      fileFilter: imageFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB لكل ملف
        files: 10,
      },
    }),
  )
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: {
      orderId: string;
      category: ImageCategory;
      description?: string;
    },
  ) {
    console.log('📤 طلب رفع صور متعددة:');
    console.log('  - عدد الملفات:', files?.length || 0);
    console.log('  - البيانات:', body);

    if (!files || files.length === 0) {
      throw new BadRequestException('لم يتم العثور على ملفات للرفع');
    }

    // التحقق من البيانات الأساسية
    this._validateBasicUploadData(body);

    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        console.log(`📷 معالجة الصورة ${i + 1}/${files.length}: ${file.originalname}`);
        
        // إضافة رقم تسلسلي للوصف إذا كان هناك أكثر من صورة
        const fileDescription = files.length > 1 
          ? `${body.description || ''} (${i + 1}/${files.length})`.trim()
          : body.description || '';

        const result = await this._processSingleImageUpload(file, {
          ...body,
          description: fileDescription,
        });

        results.push(result);
        console.log(`✅ تم رفع الصورة ${i + 1} بنجاح: ${result.id}`);

      } catch (error) {
        console.error(`❌ فشل رفع الصورة ${i + 1}:`, error.message);
        
        // حذف الملف في حالة الفشل
        try {
          if (file.path && existsSync(file.path)) {
            unlinkSync(file.path);
            console.log(`🗑️ تم حذف الملف الفاشل: ${file.path}`);
          }
        } catch (deleteError) {
          console.error('⚠️ فشل حذف الملف:', deleteError);
        }

        errors.push({
          filename: file.originalname,
          error: error.message,
          index: i + 1,
        });
      }
    }

    // إرجاع النتائج مع تفاصيل الأخطاء
    const response = {
      success: results.length > 0,
      totalFiles: files.length,
      successCount: results.length,
      errorCount: errors.length,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
      message: this._generateMultipleUploadMessage(results.length, files.length),
    };

    console.log('📊 نتائج رفع الصور المتعددة:', {
      نجح: results.length,
      فشل: errors.length,
      المجموع: files.length,
    });

    return response;
  }

  // معالجة رفع صورة واحدة (دالة مساعدة)
  private async _processImageUpload(
    file: Express.Multer.File,
    body: { orderId: string; category: ImageCategory; description?: string },
  ) {
    // التحقق من وجود الملف
    if (!file) {
      throw new BadRequestException('لم يتم العثور على ملف للرفع');
    }

    // التحقق من البيانات الأساسية
    this._validateBasicUploadData(body);

    // التحقق من حجم الملف
    if (file.size === 0) {
      await this._cleanupFile(file.path);
      throw new BadRequestException('الملف فارغ');
    }

    try {
      return await this._processSingleImageUpload(file, body);
    } catch (error) {
      // تنظيف الملف في حالة الفشل
      await this._cleanupFile(file.path);
      throw error;
    }
  }

  // معالجة صورة واحدة (منطق الرفع الفعلي)
  private async _processSingleImageUpload(
    file: Express.Multer.File,
    body: { orderId: string; category: ImageCategory; description?: string },
  ): Promise<any> {
    
    const result = await this.uploadsService.uploadImage(
      file,
      body.orderId.trim(),
      body.category as ImageCategory,
      body.description?.trim() || '',
    );

    console.log('✅ تم رفع الصورة بنجاح:', {
      id: result.id,
      name: result.name,
      imageUrl: result.imageUrl,
      category: result.category,
    });

    return {
      id: result.id,
      name: result.name,
      imageUrl: result.imageUrl,
      category: result.category,
      description: result.description,
      orderId: result.orderId,
      createdAt: result.createdAt,
    };
  }

  // التحقق من البيانات الأساسية
  private _validateBasicUploadData(body: { orderId: string; category: ImageCategory }) {
    if (!body.orderId?.trim()) {
      throw new BadRequestException('معرف الطلبية مطلوب');
    }

    if (!body.category) {
      throw new BadRequestException('فئة الصورة مطلوبة');
    }

    if (!Object.values(ImageCategory).includes(body.category)) {
      throw new BadRequestException(`فئة الصورة غير صحيحة: ${body.category}`);
    }
  }

  // تنظيف الملف
  private async _cleanupFile(filePath: string): Promise<void> {
    try {
      if (filePath && existsSync(filePath)) {
        unlinkSync(filePath);
        console.log('🗑️ تم حذف الملف المؤقت:', filePath);
      }
    } catch (error) {
      console.error('⚠️ فشل حذف الملف المؤقت:', error);
    }
  }

  // إنشاء رسالة نتائج الرفع المتعدد
  private _generateMultipleUploadMessage(successCount: number, totalCount: number): string {
    if (successCount === totalCount) {
      return `تم رفع جميع الصور بنجاح (${successCount}/${totalCount})`;
    } else if (successCount > 0) {
      return `تم رفع ${successCount} من ${totalCount} صورة بنجاح`;
    } else {
      return `فشل في رفع جميع الصور (${totalCount})`;
    }
  }

  // رفع التوقيع (بدون تغيير)
  @Post('signature')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/signatures';
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const timestamp = Date.now();
          const randomSuffix = Math.round(Math.random() * 1E9);
          cb(null, `signature_${timestamp}_${randomSuffix}.png`);
        },
      }),
      fileFilter: (req, file, cb) => {
        console.log('✍️ فحص ملف التوقيع:', {
          mimetype: file.mimetype,
          originalname: file.originalname,
        });
        
        const allowedTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/gif',
          'image/webp',
          'application/octet-stream'
        ];
        
        const isValidFile = allowedTypes.includes(file.mimetype) || 
          (file.originalname && /\.(png|jpe?g|gif|webp)$/i.test(file.originalname)) ||
          (file.originalname && file.originalname.includes('signature'));
        
        if (isValidFile) {
          console.log('✅ ملف التوقيع مقبول');
          cb(null, true);
        } else {
          console.error('❌ ملف التوقيع مرفوض:', file.mimetype);
          cb(new BadRequestException(`نوع ملف التوقيع غير مدعوم: ${file.mimetype}`), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
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
    console.log('✍️ طلب رفع توقيع:', {
      file: file ? {
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      } : 'غير موجود',
      ...body,
    });

    if (!file) {
      throw new BadRequestException('لم يتم العثور على ملف التوقيع');
    }

    if (!body.orderId?.trim() || !body.signerName?.trim() || body.isDriver === undefined) {
      await this._cleanupFile(file.path);
      throw new BadRequestException('جميع الحقول مطلوبة: orderId, signerName, isDriver');
    }

    const isDriverBool = body.isDriver === 'true' || body.isDriver === "true";

    try {
      const result = await this.uploadsService.uploadSignature(
        file,
        body.orderId.trim(),
        body.signerName.trim(),
        isDriverBool,
      );

      console.log('✅ تم رفع التوقيع بنجاح:', result.id);
      return result;
    } catch (error) {
      await this._cleanupFile(file.path);
      console.error('❌ خطأ في رفع التوقيع:', error);
      throw new BadRequestException(`فشل في رفع التوقيع: ${error.message}`);
    }
  }

  // إضافة المصروفات (بدون تغيير)
 @Post('expenses')
async addExpenses(
  @Body() body: {
    orderId: string;
    fuel?: number | string;
    wash?: number | string;
    adBlue?: number | string;
    other?: number | string;
    tollFees?: number | string;
    parking?: number | string;
    notes?: string;
  },
) {
  console.log('💰 طلب إضافة مصروفات:', body);

  if (!body.orderId?.trim()) {
    throw new BadRequestException('معرف الطلبية مطلوب');
  }

  // دالة تحويل محسنة
  const parseExpense = (value: any): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    
    if (isNaN(num) || num < 0) {
      return undefined;
    }
    
    return num > 0 ? num : undefined;
  };

  try {
    const validatedExpenses: any = {
      orderId: body.orderId.trim(),
      notes: body.notes?.trim() || '',
    };

    // معالجة كل حقل بشكل منفصل
    const fuel = parseExpense(body.fuel);
    if (fuel !== undefined) validatedExpenses.fuel = fuel;

    const wash = parseExpense(body.wash);
    if (wash !== undefined) validatedExpenses.wash = wash;

    const adBlue = parseExpense(body.adBlue);
    if (adBlue !== undefined) validatedExpenses.adBlue = adBlue;

    const other = parseExpense(body.other);
    if (other !== undefined) validatedExpenses.other = other;

    const tollFees = parseExpense(body.tollFees);
    if (tollFees !== undefined) validatedExpenses.tollFees = tollFees;

    const parking = parseExpense(body.parking);
    if (parking !== undefined) validatedExpenses.parking = parking;

    console.log('✅ المصروفات المتحققة:', validatedExpenses);

    const result = await this.uploadsService.addExpenses(
      body.orderId.trim(),
      validatedExpenses
    );

    console.log('✅ تم إضافة المصروفات بنجاح:', result.id);
    return result;
    
  } catch (error) {
    console.error('❌ خطأ في إضافة المصروفات:', error);
    throw new HttpException(
      `فشل في إضافة المصروفات: ${error.message}`,
      HttpStatus.BAD_REQUEST
    );
  }
}


}