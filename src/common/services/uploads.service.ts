import { Injectable } from '@nestjs/common';
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
    const imageUrl = `/uploads/${file.filename}`;
    
    return this.prisma.image.create({
      data: {
        name: file.originalname,
        imageUrl,
        category,
        description,
        orderId,
      },
    });
  }

  async addExpenses(orderId: string, expenses: any) {
    return this.prisma.expenses.upsert({
      where: { orderId },
      update: expenses,
      create: {
        ...expenses,
        orderId,
      },
    });
  }
}