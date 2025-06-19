// prisma/seed.ts
import { PrismaClient, UserRole, ServiceType, ImageCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 بدء إضافة البيانات الأولية للنظام...');

  // ==== إنشاء المستخدمين ====
  console.log('👥 إنشاء المستخدمين...');

  // مستخدم المدير
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@carhandover.com' },
    update: {},
    create: {
      email: 'admin@carhandover.com',
      name: 'أحمد المدير',
      password: adminPassword,
      role: UserRole.ADMIN,
      phone: '+49123456789',
    },
  });
  console.log('✅ تم إنشاء المدير:', admin.email);

  // السائقين
  const driverPassword = await bcrypt.hash('123', 10);
  
  const driver1 = await prisma.user.upsert({
    where: { email: 'adnan@gmail.com' },
    update: {},
    create: {
      email: 'adnan@gmail.com',
      name: 'محمد الراشد',
      password: driverPassword,
      role: UserRole.DRIVER,
      phone: '+49987654321',
    },
  });
  console.log('✅ تم إنشاء السائق الأول:', driver1.email);

  const driver2 = await prisma.user.upsert({
    where: { email: 'driver2@carhandover.com' },
    update: {},
    create: {
      email: 'driver2@carhandover.com',
      name: 'علي حسن',
      password: driverPassword,
      role: UserRole.DRIVER,
      phone: '+49555666777',
    },
  });
  console.log('✅ تم إنشاء السائق الثاني:', driver2.email);

  const driver3 = await prisma.user.upsert({
    where: { email: 'driver3@carhandover.com' },
    update: {},
    create: {
      email: 'driver3@carhandover.com',
      name: 'خالد العبدالله',
      password: driverPassword,
      role: UserRole.DRIVER,
      phone: '+49111222333',
    },
  });
  console.log('✅ تم إنشاء السائق الثالث:', driver3.email);

  // ==== إنشاء الطلبيات التجريبية ====
  console.log('\n📦 إنشاء الطلبيات التجريبية...');

  // الطلبية الأولى - نقل سيارة BMW
  const order1 = await prisma.order.create({
    data: {
      client: 'فيصل محمد النور',
      clientPhone: '+49176987654321',
      clientEmail: 'faisal@example.com',
      description: 'نقل سيارة BMW X5 من ميونخ إلى برلين',
      comments: 'السيارة جديدة ونظيفة، يُرجى التعامل بحذر شديد',
      items: ['مفاتيح السيارة', 'وثائق التسجيل', 'دليل المالك', 'شاحن كهربائي'],
      driverId: driver1.id,

      // عنوان الاستلام
      pickupAddress: {
        create: {
          street: 'Maximilianstraße',
          houseNumber: '42',
          zipCode: '80539',
          city: 'München',
          country: 'Deutschland',
          coordinates: '48.1391,11.5802',
        },
      },

      // عنوان التسليم
      deliveryAddress: {
        create: {
          street: 'Unter den Linden',
          houseNumber: '77',
          zipCode: '10117',
          city: 'Berlin',
          country: 'Deutschland',
          coordinates: '52.5170,13.3888',
        },
      },

      // بيانات السيارة
      vehicleData: {
        create: {
          vehicleOwner: 'فيصل محمد النور',
          licensePlateNumber: 'M-FN-2024',
          vin: 'WBA1234567890ABCD',
          brand: 'BMW',
          model: 'X5',
          year: 2024,
          color: 'أزرق ميتاليك',
        },
      },

      // الخدمة
      service: {
        create: {
          vehicleType: 'SUV',
          serviceType: ServiceType.TRANSPORT,
          description: 'نقل السيارة بأمان مع التأمين الشامل',
        },
      },

      // المصروفات
      expenses: {
        create: {
          fuel: 85,
          wash: 20,
          tollFees: 35,
          parking: 15,
          notes: 'مصروفات الرحلة من ميونخ إلى برلين - طريق سريع',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الأولى - رقم:', order1.orderNumber);

  // الطلبية الثانية - صيانة سيارة مرسيدس
  const order2 = await prisma.order.create({
    data: {
      client: 'سارة أحمد الزهراني',
      clientPhone: '+49152123456789',
      clientEmail: 'sara.ahmed@email.de',
      description: 'صيانة دورية لسيارة مرسيدس C-Class',
      comments: 'الصيانة تشمل تغيير الزيت وفحص الفرامل',
      items: ['مفاتيح السيارة', 'كتيب الصيانة', 'فواتير الصيانة السابقة'],
      driverId: driver2.id,

      // عنوان الاستلام
      pickupAddress: {
        create: {
          street: 'Hauptstraße',
          houseNumber: '155',
          zipCode: '60313',
          city: 'Frankfurt am Main',
          country: 'Deutschland',
          coordinates: '50.1109,8.6821',
        },
      },

      // عنوان التسليم (نفس العنوان للصيانة)
      deliveryAddress: {
        create: {
          street: 'Hauptstraße',
          houseNumber: '155',
          zipCode: '60313',
          city: 'Frankfurt am Main',
          country: 'Deutschland',
          coordinates: '50.1109,8.6821',
        },
      },

      // بيانات السيارة
      vehicleData: {
        create: {
          vehicleOwner: 'سارة أحمد الزهراني',
          licensePlateNumber: 'F-SA-789',
          vin: 'WDD2040022A123456',
          brand: 'Mercedes-Benz',
          model: 'C-Class',
          year: 2021,
          color: 'أبيض لؤلؤي',
        },
      },

      // الخدمة
      service: {
        create: {
          vehicleType: 'سيدان',
          serviceType: ServiceType.MAINTENANCE,
          description: 'صيانة دورية شاملة مع فحص كامل',
        },
      },

      // المصروفات
      expenses: {
        create: {
          fuel: 25,
          wash: 15,
          other: 10,
          notes: 'مصروفات التنقل لورشة الصيانة',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الثانية - رقم:', order2.orderNumber);

  // الطلبية الثالثة - غسيل سيارة أودي
  const order3 = await prisma.order.create({
    data: {
      client: 'عمر كمال الدين',
      clientPhone: '+49171555444333',
      clientEmail: 'omar.kamal@web.de',
      description: 'غسيل شامل لسيارة أودي A4',
      comments: 'غسيل خارجي وداخلي مع تلميع',
      items: ['مفاتيح السيارة'],
      driverId: driver3.id,

      // عنوان الاستلام
      pickupAddress: {
        create: {
          street: 'Königsallee',
          houseNumber: '28',
          zipCode: '40212',
          city: 'Düsseldorf',
          country: 'Deutschland',
          coordinates: '51.2277,6.7735',
        },
      },

      // عنوان التسليم
      deliveryAddress: {
        create: {
          street: 'Königsallee',
          houseNumber: '28',
          zipCode: '40212',
          city: 'Düsseldorf',
          country: 'Deutschland',
          coordinates: '51.2277,6.7735',
        },
      },

      // بيانات السيارة
      vehicleData: {
        create: {
          vehicleOwner: 'عمر كمال الدين',
          licensePlateNumber: 'D-OK-456',
          vin: 'WAUZZZ8K1DA123789',
          brand: 'Audi',
          model: 'A4',
          year: 2020,
          color: 'رمادي داكن',
        },
      },

      // الخدمة
      service: {
        create: {
          vehicleType: 'سيدان',
          serviceType: ServiceType.VEHICLE_WASH,
          description: 'غسيل شامل خارجي وداخلي مع تلميع الجسم',
        },
      },

      // المصروفات
      expenses: {
        create: {
          wash: 35,
          other: 5,
          notes: 'تكلفة مواد التنظيف الخاصة',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الثالثة - رقم:', order3.orderNumber);

  // // ==== إضافة الصور التجريبية ====
  // console.log('\n📸 إضافة الصور التجريبية...');

  // // صور للطلبية الأولى
  // const images1 = await prisma.image.createMany({
  //   data: [
  //     {
  //       name: 'bmw_pickup_front.jpg',
  //       imageUrl: '/uploads/images/bmw_pickup_front.jpg',
  //       category: ImageCategory.PICKUP,
  //       description: 'صورة أمامية للسيارة قبل الاستلام',
  //       orderId: order1.id,
  //     },
  //     {
  //       name: 'bmw_pickup_interior.jpg',
  //       imageUrl: '/uploads/images/bmw_pickup_interior.jpg',
  //       category: ImageCategory.INTERIOR,
  //       description: 'صورة الجزء الداخلي للسيارة',
  //       orderId: order1.id,
  //     },
  //     {
  //       name: 'bmw_delivery_front.jpg',
  //       imageUrl: '/uploads/images/bmw_delivery_front.jpg',
  //       category: ImageCategory.DELIVERY,
  //       description: 'صورة أمامية للسيارة بعد التسليم',
  //       orderId: order1.id,
  //     },
  //   ],
  // });

  // // صور للطلبية الثانية
  // const images2 = await prisma.image.createMany({
  //   data: [
  //     {
  //       name: 'mercedes_before_maintenance.jpg',
  //       imageUrl: '/uploads/images/mercedes_before_maintenance.jpg',
  //       category: ImageCategory.PICKUP,
  //       description: 'صورة السيارة قبل الصيانة',
  //       orderId: order2.id,
  //     },
  //     {
  //       name: 'mercedes_engine_check.jpg',
  //       imageUrl: '/uploads/images/mercedes_engine_check.jpg',
  //       category: ImageCategory.ADDITIONAL,
  //       description: 'صورة فحص المحرك',
  //       orderId: order2.id,
  //     },
  //   ],
  // });

  // console.log('✅ تم إضافة الصور التجريبية');

  // // ==== إضافة التوقيعات ====
  // console.log('\n✍️ إضافة التوقيعات التجريبية...');

  // // توقيعات للطلبية الأولى
  // const driverSignature1 = await prisma.signature.create({
  //   data: {
  //     name: driver1.name,
  //     signUrl: '/uploads/signatures/driver1_signature.png',
  //     location: 'برلين، ألمانيا',
  //     driverOrderId: order1.id,
  //   },
  // });

  // const customerSignature1 = await prisma.signature.create({
  //   data: {
  //     name: 'فيصل محمد النور',
  //     signUrl: '/uploads/signatures/customer1_signature.png',
  //     location: 'برلين، ألمانيا',
  //     customerOrderId: order1.id,
  //   },
  // });

  // // توقيعات للطلبية الثانية
  // const driverSignature2 = await prisma.signature.create({
  //   data: {
  //     name: driver2.name,
  //     signUrl: '/uploads/signatures/driver2_signature.png',
  //     location: 'فرانكفورت، ألمانيا',
  //     driverOrderId: order2.id,
  //   },
  // });

  // const customerSignature2 = await prisma.signature.create({
  //   data: {
  //     name: 'سارة أحمد الزهراني',
  //     signUrl: '/uploads/signatures/customer2_signature.png',
  //     location: 'فرانكفورت، ألمانيا',
  //     customerOrderId: order2.id,
  //   },
  // });

  // console.log('✅ تم إضافة التوقيعات التجريبية');

  // ==== ملخص البيانات المُضافة ====
  console.log('\n🎉 تم إكمال إضافة جميع البيانات الأولية بنجاح!');
  console.log('\n📋 ملخص البيانات المُضافة:');
  console.log('='.repeat(50));
  
  console.log('\n👥 المستخدمون:');
  console.log(`👑 المدير: ${admin.email} / admin123`);
  console.log(`🚗 السائق 1: ${driver1.email} / driver123`);
  console.log(`🚗 السائق 2: ${driver2.email} / driver123`);
  console.log(`🚗 السائق 3: ${driver3.email} / driver123`);

  console.log('\n📦 الطلبيات:');
  console.log(`📄 الطلبية #${order1.orderNumber}: ${order1.description}`);
  console.log(`📄 الطلبية #${order2.orderNumber}: ${order2.description}`);
  console.log(`📄 الطلبية #${order3.orderNumber}: ${order3.description}`);

  console.log('\n📊 إحصائيات:');
  const userCount = await prisma.user.count();
  const orderCount = await prisma.order.count();
  // const imageCount = await prisma.image.count();
  // const signatureCount = await prisma.signature.count();

  console.log(`👥 إجمالي المستخدمين: ${userCount}`);
  console.log(`📦 إجمالي الطلبيات: ${orderCount}`);
  // console.log(`📸 إجمالي الصور: ${imageCount}`);
  // console.log(`✍️ إجمالي التوقيعات: ${signatureCount}`);

  console.log('\n🔗 روابط مفيدة:');
  console.log('🖥️  Prisma Studio: http://localhost:5555');
  console.log('📚 API Documentation: http://localhost:3000/api');
  console.log('🏠 Application: http://localhost:3000');

  console.log('\n✨ النظام جاهز للاستخدام!');
}

main()
  .catch((e) => {
    console.error('❌ خطأ في إضافة البيانات:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('\n🔌 تم قطع الاتصال بقاعدة البيانات');
  });