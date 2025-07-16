// prisma/seed.ts - مُصحح للعمل مع النموذج الجديد والحقول المضافة
import { PrismaClient, UserRole, ServiceType, ImageCategory, OrderStatus, VehicleItem } from '@prisma/client';
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
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      name: 'admin',
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

  // ==== إنشاء العناوين أولاً مع الحقول الجديدة ====
  console.log('\n🏠 إنشاء العناوين...');

  // عناوين العملاء
  const clientAddress1 = await prisma.address.create({
    data: {
      street: 'Maximilianstraße',
      houseNumber: '42',
      zipCode: '80539',
      city: 'München',
      country: 'Deutschland',
      // الحقول الجديدة - اختيارية للعناوين العادية
      date: null,
      companyName: null,
      contactPersonName: null,
      contactPersonPhone: null,
      contactPersonEmail: null,
      fuelLevel: null,
      fuelMeter: null,
    },
  });

  const clientAddress2 = await prisma.address.create({
    data: {
      street: 'Hauptstraße',
      houseNumber: '155',
      zipCode: '60313',
      city: 'Frankfurt am Main',
      country: 'Deutschland',
    },
  });

  const clientAddress3 = await prisma.address.create({
    data: {
      street: 'Königsallee',
      houseNumber: '28',
      zipCode: '40212',
      city: 'Düsseldorf',
      country: 'Deutschland',
    },
  });

  const clientAddress4 = await prisma.address.create({
    data: {
      street: 'Berliner Straße',
      houseNumber: '88',
      zipCode: '10713',
      city: 'Berlin',
      country: 'Deutschland',
    },
  });

  // عناوين أصحاب الفواتير (للطلبيات التي تحتاج عناوين مختلفة)
  const billingAddress1 = await prisma.address.create({
    data: {
      street: 'Geschäftsstraße',
      houseNumber: '25',
      zipCode: '60313',
      city: 'Frankfurt am Main',
      country: 'Deutschland',
    },
  });

  const billingAddress2 = await prisma.address.create({
    data: {
      street: 'Am Stadtpark',
      houseNumber: '15',
      zipCode: '40213',
      city: 'Düsseldorf',
      country: 'Deutschland',
    },
  });

  // عناوين الاستلام مع الحقول الجديدة
  const pickupAddress1 = await prisma.address.create({
    data: {
      street: 'Maximilianstraße',
      houseNumber: '42',
      zipCode: '80539',
      city: 'München',
      country: 'Deutschland',
      // الحقول الجديدة للاستلام
      date: new Date('2024-01-15T09:00:00Z'),
      companyName: 'BMW Zentrum München',
      contactPersonName: 'هانز شميت',
      contactPersonPhone: '+4989123456789',
      contactPersonEmail: 'hans.schmidt@bmw.de',
      fuelLevel: 7, // مستوى وقود عالي
      fuelMeter: 245.5, // عداد الوقود
    },
  });

  const pickupAddress2 = await prisma.address.create({
    data: {
      street: 'Hauptstraße',
      houseNumber: '155',
      zipCode: '60313',
      city: 'Frankfurt am Main',
      country: 'Deutschland',
      // الحقول الجديدة للاستلام
      date: new Date('2024-01-16T10:30:00Z'),
      companyName: 'Mercedes-Benz Service Frankfurt',
      contactPersonName: 'ماريا مولر',
      contactPersonPhone: '+4969987654321',
      contactPersonEmail: 'maria.mueller@mercedes.de',
      fuelLevel: 3, // مستوى وقود متوسط
      fuelMeter: 128.2,
    },
  });

  const pickupAddress3 = await prisma.address.create({
    data: {
      street: 'Königsallee',
      houseNumber: '28',
      zipCode: '40212',
      city: 'Düsseldorf',
      country: 'Deutschland',
      // الحقول الجديدة للاستلام
      date: new Date('2024-01-17T14:00:00Z'),
      companyName: 'Audi Zentrum Düsseldorf',
      contactPersonName: 'توماس بيكر',
      contactPersonPhone: '+49211555123456',
      contactPersonEmail: 'thomas.becker@audi.de',
      fuelLevel: 5, // مستوى وقود جيد
      fuelMeter: 89.7,
    },
  });

  const pickupAddress4 = await prisma.address.create({
    data: {
      street: 'Berliner Straße',
      houseNumber: '88',
      zipCode: '10713',
      city: 'Berlin',
      country: 'Deutschland',
      // الحقول الجديدة للاستلام
      date: new Date('2024-01-18T11:15:00Z'),
      companyName: 'Volkswagen Showroom Berlin',
      contactPersonName: 'إنجا فيبر',
      contactPersonPhone: '+49301234567890',
      contactPersonEmail: 'inga.weber@vw.de',
      fuelLevel: 8, // مستوى وقود ممتلئ
      fuelMeter: 0.0, // سيارة جديدة
    },
  });

  // عناوين التسليم مع الحقول الجديدة
  const deliveryAddress1 = await prisma.address.create({
    data: {
      street: 'Unter den Linden',
      houseNumber: '77',
      zipCode: '10117',
      city: 'Berlin',
      country: 'Deutschland',
      // الحقول الجديدة للتسليم
      date: new Date('2024-01-16T16:00:00Z'),
      companyName: 'BMW Delivery Center Berlin',
      contactPersonName: 'أندرياس كلاين',
      contactPersonPhone: '+4930987654321',
      contactPersonEmail: 'andreas.klein@bmw.de',
      fuelLevel: 6, // مستوى وقود بعد الرحلة
      fuelMeter: 445.8, // عداد بعد الرحلة
    },
  });

  const deliveryAddress2 = await prisma.address.create({
    data: {
      street: 'Hauptstraße',
      houseNumber: '155',
      zipCode: '60313',
      city: 'Frankfurt am Main',
      country: 'Deutschland',
      // الحقول الجديدة للتسليم
      date: new Date('2024-01-17T15:30:00Z'),
      companyName: 'Mercedes-Benz Service Frankfurt',
      contactPersonName: 'ماريا مولر',
      contactPersonPhone: '+4969987654321',
      contactPersonEmail: 'maria.mueller@mercedes.de',
      fuelLevel: 3, // نفس المستوى (صيانة محلية)
      fuelMeter: 130.5, // زيادة طفيفة
    },
  });

  const deliveryAddress3 = await prisma.address.create({
    data: {
      street: 'Königsallee',
      houseNumber: '28',
      zipCode: '40212',
      city: 'Düsseldorf',
      country: 'Deutschland',
      // الحقول الجديدة للتسليم
      date: new Date('2024-01-18T12:00:00Z'),
      companyName: 'Premium Car Wash Düsseldorf',
      contactPersonName: 'ميشائيل براون',
      contactPersonPhone: '+49211666789012',
      contactPersonEmail: 'michael.braun@carwash.de',
      fuelLevel: 5, // نفس المستوى (غسيل فقط)
      fuelMeter: 89.9, // زيادة طفيفة جداً
    },
  });

  const deliveryAddress4 = await prisma.address.create({
    data: {
      street: 'Puttkamerstraße',
      houseNumber: '16-18',
      zipCode: '10969',
      city: 'Berlin',
      country: 'Deutschland',
      // الحقول الجديدة للتسليم
      date: new Date('2024-01-19T13:45:00Z'),
      companyName: 'KFZ-Zulassungsstelle Berlin',
      contactPersonName: 'فرانك شولز',
      contactPersonPhone: '+493012345678',
      contactPersonEmail: 'frank.schulz@berlin.de',
      fuelLevel: 7, // مستوى وقود جيد
      fuelMeter: 15.3, // بعد رحلة قصيرة للتسجيل
    },
  });

  console.log('✅ تم إنشاء العناوين مع الحقول الجديدة');

  // ==== إنشاء الطلبيات التجريبية مع الأغراض الجديدة ====
  console.log('\n📦 إنشاء الطلبيات التجريبية...');

  // الطلبية الأولى - نقل سيارة BMW مع أغراض متنوعة
  const order1 = await prisma.order.create({
    data: {
      client: 'فيصل محمد النور',
      clientPhone: '+49176987654321',
      clientEmail: 'faisal@example.com',
      
      // ربط عنوان العميل
      clientAddressId: clientAddress1.id,
      
      // بيانات صاحب الفاتورة - نفس العميل
      isSameBilling: true,
      billingName: null,
      billingPhone: null,
      billingEmail: null,
      
      description: 'نقل سيارة BMW X5 من ميونخ إلى برلين',
      comments: 'السيارة جديدة ونظيفة، يُرجى التعامل بحذر شديد',
      
      // استخدام الأغراض الجديدة من enum VehicleItem
      items: [
        VehicleItem.VEHICLE_KEYS,
        VehicleItem.REGISTRATION_DOCUMENT,
        VehicleItem.OPERATING_MANUAL,
        VehicleItem.NAVIGATION_SYSTEM,
        VehicleItem.FIRST_AID_KIT,
        VehicleItem.WARNING_TRIANGLE,
        VehicleItem.ALLOY_WHEELS,
        VehicleItem.WINTER_TIRES
      ],
      
      status: OrderStatus.COMPLETED,
      driverId: driver1.id,

      // ربط عناوين الاستلام والتسليم
      pickupAddressId: pickupAddress1.id,
      deliveryAddressId: deliveryAddress1.id,

      // بيانات السيارة مع الحقول الجديدة
      vehicleData: {
        create: {
          vehicleOwner: 'فيصل محمد النور',
          licensePlateNumber: 'M-FN-2024',
          vin: 'WBA1234567890ABCD',
          brand: 'BMW',
          model: 'X5',
          year: 2024,
          color: 'أزرق ميتاليك',
          // الحقول الجديدة
          ukz: 'ÜKZ-BMW-2024',
          fin: 'FIN1234567890BMW',
          bestellnummer: 'BMW-ORDER-789456',
          leasingvertragsnummer: 'LEASE-BMW-456789',
          kostenstelle: 'KST-4521',
          bemerkung: 'سيارة تنفيذية للشركة - معاملة خاصة',
          typ: 'Firmenwagen',
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
          adBlue: 15,
          other: 25,
          tollFees: 35,
          parking: 15,
          notes: 'مصروفات الرحلة من ميونخ إلى برلين - طريق سريع',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الأولى - رقم:', order1.orderNumber);

  // الطلبية الثانية - صيانة سيارة مرسيدس (صاحب فاتورة مختلف)
  const order2 = await prisma.order.create({
    data: {
      client: 'سارة أحمد الزهراني',
      clientPhone: '+49152123456789',
      clientEmail: 'sara.ahmed@email.de',
      
      // ربط عنوان العميل
      clientAddressId: clientAddress2.id,
      
      // بيانات صاحب الفاتورة - شخص مختلف (الشركة)
      isSameBilling: false,
      billingName: 'شركة الزهراني للاستيراد والتصدير',
      billingPhone: '+4969123456789',
      billingEmail: 'billing@alzahrani-trading.de',
      
      // ربط عنوان صاحب الفاتورة
      billingAddressId: billingAddress1.id,
      
      description: 'صيانة دورية لسيارة مرسيدس C-Class',
      comments: 'الصيانة تشمل تغيير الزيت وفحص الفرامل - فاتورة للشركة',
      
      // أغراض صيانة أساسية
      items: [
        VehicleItem.VEHICLE_KEYS,
        VehicleItem.SERVICE_BOOK,
        VehicleItem.OPERATING_MANUAL,
        VehicleItem.COMPRESSOR_REPAIR_KIT,
        VehicleItem.TOOLS_JACK
      ],
      
      status: OrderStatus.IN_PROGRESS,
      driverId: driver2.id,

      // ربط عناوين الاستلام والتسليم
      pickupAddressId: pickupAddress2.id,
      deliveryAddressId: deliveryAddress2.id,

      // بيانات السيارة مع الحقول الجديدة
      vehicleData: {
        create: {
          vehicleOwner: 'سارة أحمد الزهراني',
          licensePlateNumber: 'F-SA-789',
          vin: 'WDD2040022A123456',
          brand: 'Mercedes-Benz',
          model: 'C-Class',
          year: 2021,
          color: 'أبيض لؤلؤي',
          // الحقول الجديدة
          ukz: 'ÜKZ-MB-2021',
          fin: 'FIN789456123MB',
          bestellnummer: 'MB-ORDER-321654',
          leasingvertragsnummer: 'LEASE-MB-654321',
          kostenstelle: 'KST-7845',
          bemerkung: 'سيارة شركة - صيانة دورية منتظمة',
          typ: 'Geschäftswagen',
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
          adBlue: 0,
          other: 10,
          tollFees: 0,
          parking: 5,
          notes: 'مصروفات التنقل لورشة الصيانة',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الثانية - رقم:', order2.orderNumber);

  // الطلبية الثالثة - غسيل سيارة أودي (صاحب فاتورة مختلف - شخص آخر)
  const order3 = await prisma.order.create({
    data: {
      client: 'عمر كمال الدين',
      clientPhone: '+49171555444333',
      clientEmail: 'omar.kamal@web.de',
      
      // ربط عنوان العميل
      clientAddressId: clientAddress3.id,
      
      // بيانات صاحب الفاتورة - والده
      isSameBilling: false,
      billingName: 'كمال الدين أحمد', // الوالد
      billingPhone: '+49211987654321',
      billingEmail: 'kamal.ahmed@gmail.com',
      
      // ربط عنوان صاحب الفاتورة
      billingAddressId: billingAddress2.id,
      
      description: 'غسيل شامل لسيارة أودي A4',
      comments: 'غسيل خارجي وداخلي مع تلميع - الدفع على حساب الوالد',
      
      // أغراض غسيل بسيطة
      items: [
        VehicleItem.VEHICLE_KEYS,
        VehicleItem.RADIO,
        VehicleItem.ANTENNA
      ],
      
      status: OrderStatus.PENDING,
      driverId: driver3.id,

      // ربط عناوين الاستلام والتسليم
      pickupAddressId: pickupAddress3.id,
      deliveryAddressId: deliveryAddress3.id,

      // بيانات السيارة مع الحقول الجديدة
      vehicleData: {
        create: {
          vehicleOwner: 'عمر كمال الدين',
          licensePlateNumber: 'D-OK-456',
          vin: 'WAUZZZ8K1DA123789',
          brand: 'Audi',
          model: 'A4',
          year: 2020,
          color: 'رمادي داكن',
          // الحقول الجديدة
          ukz: 'ÜKZ-AUDI-2020',
          fin: 'FIN456789012AUDI',
          bestellnummer: 'AUDI-ORDER-159753',
          leasingvertragsnummer: null, // سيارة مشتراة وليست مؤجرة
          kostenstelle: null,
          bemerkung: 'سيارة شخصية - استخدام يومي',
          typ: 'Privatwagen',
        },
      },

      // الخدمة
      service: {
        create: {
          vehicleType: 'سيدان',
          serviceType: ServiceType.WASH,
          description: 'غسيل شامل خارجي وداخلي مع تلميع الجسم',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الثالثة - رقم:', order3.orderNumber);

  // طلبية رابعة - تسجيل سيارة جديدة (نفس العميل كصاحب الفاتورة)
  const order4 = await prisma.order.create({
    data: {
      client: 'نادية محمود السيد',
      clientPhone: '+49178999888777',
      clientEmail: 'nadia.mahmoud@outlook.de',
      
      // ربط عنوان العميل
      clientAddressId: clientAddress4.id,
      
      // بيانات صاحب الفاتورة - نفس العميل
      isSameBilling: true,
      billingName: null,
      billingPhone: null,
      billingEmail: null,
      
      description: 'تسجيل سيارة فولكس فاجن جديدة في دائرة المرور',
      comments: 'سيارة جديدة تحتاج إلى تسجيل أولي وأرقام',
      
      // أغراض التسجيل الكاملة
      items: [
        VehicleItem.VEHICLE_KEYS,
        VehicleItem.REGISTRATION_DOCUMENT,
        VehicleItem.OPERATING_MANUAL,
        VehicleItem.SERVICE_BOOK,
        VehicleItem.FIRST_AID_KIT,
        VehicleItem.WARNING_TRIANGLE,
        VehicleItem.SPARE_TIRE,
        VehicleItem.TOOLS_JACK,
        VehicleItem.ANTENNA,
        VehicleItem.RADIO
      ],
      
      status: OrderStatus.PENDING,
      driverId: driver1.id,

      // ربط عناوين الاستلام والتسليم
      pickupAddressId: pickupAddress4.id,
      deliveryAddressId: deliveryAddress4.id,

      // بيانات السيارة مع الحقول الجديدة
      vehicleData: {
        create: {
          vehicleOwner: 'نادية محمود السيد',
          licensePlateNumber: 'B-NM-2024', // رقم مؤقت
          vin: 'WVWZZZ1KZAW123456',
          brand: 'Volkswagen',
          model: 'Golf',
          year: 2024,
          color: 'أحمر',
          // الحقول الجديدة
          ukz: 'ÜKZ-VW-2024',
          fin: 'FIN123456789VW',
          bestellnummer: 'VW-ORDER-987654',
          leasingvertragsnummer: null, // سيارة مشتراة
          kostenstelle: null,
          bemerkung: 'سيارة جديدة - تسجيل أولي',
          typ: 'Neuwagen',
        },
      },

      // الخدمة
      service: {
        create: {
          vehicleType: 'هاتشباك',
          serviceType: ServiceType.REGISTRATION,
          description: 'تسجيل السيارة الجديدة والحصول على الأرقام النهائية',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الطلبية الرابعة - رقم:', order4.orderNumber);

  // ==== إضافة الصور التجريبية ====
  console.log('\n📸 إضافة الصور التجريبية...');

  // صور للطلبية الأولى
  const images1 = await prisma.image.createMany({
    data: [
      {
        name: 'bmw_pickup_front.jpg',
        imageUrl: '/uploads/images/bmw_pickup_front.jpg',
        category: ImageCategory.PICKUP,
        description: 'صورة أمامية للسيارة قبل الاستلام - مستوى الوقود 7/8',
        orderId: order1.id,
      },
      {
        name: 'bmw_pickup_interior.jpg',
        imageUrl: '/uploads/images/bmw_pickup_interior.jpg',
        category: ImageCategory.INTERIOR,
        description: 'صورة الجزء الداخلي للسيارة مع جميع الأغراض',
        orderId: order1.id,
      },
      {
        name: 'bmw_delivery_front.jpg',
        imageUrl: '/uploads/images/bmw_delivery_front.jpg',
        category: ImageCategory.DELIVERY,
        description: 'صورة أمامية للسيارة بعد التسليم - مستوى الوقود 6/8',
        orderId: order1.id,
      },
    ],
  });

  // صور للطلبية الثانية
  const images2 = await prisma.image.createMany({
    data: [
      {
        name: 'mercedes_before_maintenance.jpg',
        imageUrl: '/uploads/images/mercedes_before_maintenance.jpg',
        category: ImageCategory.PICKUP,
        description: 'صورة السيارة قبل الصيانة - مستوى الوقود 3/8',
        orderId: order2.id,
      },
      {
        name: 'mercedes_engine_check.jpg',
        imageUrl: '/uploads/images/mercedes_engine_check.jpg',
        category: ImageCategory.ADDITIONAL,
        description: 'صورة فحص المحرك أثناء الصيانة',
        orderId: order2.id,
      },
    ],
  });

  console.log('✅ تم إضافة الصور التجريبية');

  // ==== إضافة التوقيعات ====
  console.log('\n✍️ إضافة التوقيعات التجريبية...');

  // توقيعات للطلبية الأولى
  const driverSignature1 = await prisma.signature.create({
    data: {
      name: driver1.name,
      signUrl: '/uploads/signatures/driver1_signature.png',
      isDriver: true,
      orderId: order1.id,
    },
  });

  const customerSignature1 = await prisma.signature.create({
    data: {
      name: 'فيصل محمد النور',
      signUrl: '/uploads/signatures/customer1_signature.png',
      isDriver: false,
      orderId: order1.id,
    },
  });

  // ربط التوقيعات بالطلبية الأولى
  await prisma.order.update({
    where: { id: order1.id },
    data: {
      driverSignatureId: driverSignature1.id,
      customerSignatureId: customerSignature1.id,
    },
  });

  // توقيعات للطلبية الثانية (السائق فقط)
  const driverSignature2 = await prisma.signature.create({
    data: {
      name: driver2.name,
      signUrl: '/uploads/signatures/driver2_signature.png',
      isDriver: true,
      orderId: order2.id,
    },
  });

  await prisma.order.update({
    where: { id: order2.id },
    data: {
      driverSignatureId: driverSignature2.id,
    },
  });

  console.log('✅ تم إضافة التوقيعات التجريبية');

  // ==== إحصائيات النهائية ====
  console.log('\n📊 إحصائيات البيانات المُدخلة:');
  
  const totalUsers = await prisma.user.count();
  const totalOrders = await prisma.order.count();
  const totalAddresses = await prisma.address.count();
  const totalImages = await prisma.image.count();
  const totalSignatures = await prisma.signature.count();
  const totalVehicleData = await prisma.vehicleData.count();
  const totalExpenses = await prisma.expenses.count();
  
  // إحصائيات صاحب الفاتورة
  const sameClientBilling = await prisma.order.count({
    where: { isSameBilling: true }
  });
  const differentBilling = await prisma.order.count({
    where: { isSameBilling: false }
  });

  // إحصائيات العناوين
  const clientAddresses = await prisma.order.count({
    where: { 
      NOT: { clientAddressId: null }
    }
  });
  const billingAddresses = await prisma.order.count({
    where: { 
      NOT: { billingAddressId: null }
    }
  });

  // إحصائيات العناوين مع الحقول الجديدة
  const pickupAddressesWithCompany = await prisma.address.count({
    where: { 
      AND: [
        { pickupOrders: { some: {} } },
        { NOT: { companyName: null } }
      ]
    }
  });
  
  const deliveryAddressesWithCompany = await prisma.address.count({
    where: { 
      AND: [
        { deliveryOrders: { some: {} } },
        { NOT: { companyName: null } }
      ]
    }
  });

  const addressesWithFuelData = await prisma.address.count({
    where: { 
      NOT: { fuelLevel: null }
    }
  });

  // إحصائيات الأغراض
  const ordersWithItems = await prisma.order.count({
    where: {
      items: {
        isEmpty: false
      }
    }
  });

  // إحصائيات بيانات السيارة الإضافية
  const vehicleDataWithAdditionalFields = await prisma.vehicleData.count({
    where: {
      OR: [
        { NOT: { ukz: null } },
        { NOT: { fin: null } },
        { NOT: { bestellnummer: null } },
        { NOT: { leasingvertragsnummer: null } }
      ]
    }
  });

  console.log(`👥 إجمالي المستخدمين: ${totalUsers}`);
  console.log(`📦 إجمالي الطلبيات: ${totalOrders}`);
  console.log(`🏠 إجمالي العناوين: ${totalAddresses}`);
  console.log(`📸 إجمالي الصور: ${totalImages}`);
  console.log(`✍️ إجمالي التوقيعات: ${totalSignatures}`);
  console.log(`🚗 إجمالي بيانات السيارات: ${totalVehicleData}`);
  console.log(`💰 إجمالي المصاريف: ${totalExpenses}`);
  
  console.log('\n--- إحصائيات صاحب الفاتورة ---');
  console.log(`💰 طلبيات بنفس العميل كصاحب فاتورة: ${sameClientBilling}`);
  console.log(`💼 طلبيات بصاحب فاتورة مختلف: ${differentBilling}`);
  console.log(`🏠 عناوين العملاء: ${clientAddresses}`);
  console.log(`💼 عناوين أصحاب الفواتير: ${billingAddresses}`);
  
  console.log('\n--- إحصائيات الحقول الجديدة ---');
  console.log(`🏢 عناوين استلام مع اسم الشركة: ${pickupAddressesWithCompany}`);
  console.log(`🏢 عناوين تسليم مع اسم الشركة: ${deliveryAddressesWithCompany}`);
  console.log(`⛽ عناوين مع بيانات الوقود: ${addressesWithFuelData}`);
  console.log(`📦 طلبيات مع أغراض: ${ordersWithItems}`);
  console.log(`🚗 بيانات سيارات مع حقول إضافية: ${vehicleDataWithAdditionalFields}`);

  // عرض عينة من الأغراض المستخدمة
  const sampleOrder = await prisma.order.findFirst({
    where: {
      items: {
        isEmpty: false
      }
    },
    select: {
      id: true,
      orderNumber: true,
      items: true,
      client: true
    }
  });

  if (sampleOrder) {
    console.log('\n--- عينة من الأغراض ---');
    console.log(`الطلبية: ${sampleOrder.orderNumber} (${sampleOrder.client})`);
    console.log(`الأغراض: ${sampleOrder.items.join(', ')}`);
  }

  // عرض عينة من العناوين مع الحقول الجديدة
  const samplePickupAddress = await prisma.address.findFirst({
    where: {
      AND: [
        { pickupOrders: { some: {} } },
        { NOT: { companyName: null } }
      ]
    },
    select: {
      street: true,
      city: true,
      companyName: true,
      contactPersonName: true,
      fuelLevel: true,
      date: true
    }
  });

  if (samplePickupAddress) {
    console.log('\n--- عينة من عناوين الاستلام المحدثة ---');
    console.log(`العنوان: ${samplePickupAddress.street}, ${samplePickupAddress.city}`);
    console.log(`الشركة: ${samplePickupAddress.companyName}`);
    console.log(`الموظف: ${samplePickupAddress.contactPersonName}`);
    console.log(`مستوى الوقود: ${samplePickupAddress.fuelLevel}/8`);
    console.log(`التاريخ: ${samplePickupAddress.date?.toLocaleDateString('ar-SA')}`);
  }

  console.log('\n🎉 تم إكمال إضافة البيانات الأولية بنجاح!');
  console.log('🆕 تم تطبيق جميع الحقول والميزات الجديدة بما في ذلك:');
  console.log('   ✅ أغراض السيارة (VehicleItem enum)');
  console.log('   ✅ حقول العناوين الإضافية (تاريخ، شركة، موظف، وقود)');
  console.log('   ✅ حقول بيانات السيارة الإضافية (ÜKZ, FIN, إلخ)');
  console.log('   ✅ دعم صاحب الفاتورة المختلف');
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