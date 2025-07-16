import { IsString, IsOptional, IsArray, IsNumber, IsEnum, IsBoolean, ValidateNested, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '@prisma/client';

export class CreateAddressDto {
  @IsString()
  street: string;

  @IsString()
  houseNumber: string;

  @IsString()
  zipCode: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  country?: string = 'Deutschland';

  // الحقول الجديدة للعناوين
  @IsOptional()
  @IsDateString()
  date?: string; // تاريخ الاستلام/التسليم

  @IsOptional()
  @IsString()
  companyName?: string; // اسم الشركة

  @IsOptional()
  @IsString()
  contactPersonName?: string; // اسم الموظف المختص

  @IsOptional()
  @IsString()
  contactPersonPhone?: string; // رقم هاتف الموظف

  @IsOptional()
  @IsString()
  contactPersonEmail?: string; // بريد الموظف

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(8)
  fuelLevel?: number; // مستوى البنزين من 0 إلى 8

  @IsOptional()
  @IsNumber()
  fuelMeter?: number; // عداد البنزين
}

// إضافة enum للأغراض المتاحة
export enum VehicleItem {
  PARTITION_NET = 'PARTITION_NET',
  WINTER_TIRES = 'WINTER_TIRES',
  HUBCAPS = 'HUBCAPS',
  REAR_PARCEL_SHELF = 'REAR_PARCEL_SHELF',
  NAVIGATION_SYSTEM = 'NAVIGATION_SYSTEM',
  TRUNK_ROLL_COVER = 'TRUNK_ROLL_COVER',
  SAFETY_VEST = 'SAFETY_VEST',
  VEHICLE_KEYS = 'VEHICLE_KEYS',
  WARNING_TRIANGLE = 'WARNING_TRIANGLE',
  RADIO = 'RADIO',
  ALLOY_WHEELS = 'ALLOY_WHEELS',
  SUMMER_TIRES = 'SUMMER_TIRES',
  OPERATING_MANUAL = 'OPERATING_MANUAL',
  REGISTRATION_DOCUMENT = 'REGISTRATION_DOCUMENT',
  COMPRESSOR_REPAIR_KIT = 'COMPRESSOR_REPAIR_KIT',
  TOOLS_JACK = 'TOOLS_JACK',
  SECOND_SET_OF_TIRES = 'SECOND_SET_OF_TIRES',
  EMERGENCY_WHEEL = 'EMERGENCY_WHEEL',
  ANTENNA = 'ANTENNA',
  FUEL_CARD = 'FUEL_CARD',
  FIRST_AID_KIT = 'FIRST_AID_KIT',
  SPARE_TIRE = 'SPARE_TIRE',
  SERVICE_BOOK = 'SERVICE_BOOK'
}


// إضافة enums للأضرار
export enum VehicleSide {
  FRONT = 'FRONT',
  REAR = 'REAR',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  TOP = 'TOP'
}

export enum DamageType {
  DENT_BUMP = 'DENT_BUMP',
  STONE_CHIP = 'STONE_CHIP',
  SCRATCH_GRAZE = 'SCRATCH_GRAZE',
  PAINT_DAMAGE = 'PAINT_DAMAGE',
  CRACK_BREAK = 'CRACK_BREAK',
  MISSING = 'MISSING'
}

// DTO للضرر الواحد
export class CreateVehicleDamageDto {
  @IsEnum(VehicleSide)
  side: VehicleSide;

  @IsEnum(DamageType)
  type: DamageType;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateOrderDto {
  @IsString()
  client: string;

  @IsOptional()
  @IsString()
  clientPhone?: string;

  @IsOptional()
  @IsString()
  clientEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  clientAddress?: CreateAddressDto;

  // بيانات صاحب الفاتورة
  @IsOptional()
  @IsBoolean()
  isSameBilling?: boolean = true;

  @IsOptional()
  @IsString()
  billingName?: string;

  @IsOptional()
  @IsString()
  billingPhone?: string;

  @IsOptional()
  @IsString()
  billingEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateAddressDto)
  billingAddress?: CreateAddressDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  // تحديث حقل items ليكون من نوع VehicleItem
  @IsOptional()
  @IsArray()
  @IsEnum(VehicleItem, { each: true })
  items?: VehicleItem[];

  // Vehicle Data - بيانات السيارة الأساسية
  @IsString()
  vehicleOwner: string;

  @IsString()
  licensePlateNumber: string;

  @IsOptional()
  @IsString()
  vin?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  color?: string;

  // الحقول الجديدة لبيانات السيارة
  @IsOptional()
  @IsString()
  ukz?: string;                    // ÜKZ

  @IsOptional()
  @IsString()
  fin?: string;                    // FIN

  @IsOptional()
  @IsString()
  bestellnummer?: string;          // Bestellnummer

  @IsOptional()
  @IsString()
  leasingvertragsnummer?: string;  // Leasingvertragsnummer

  @IsOptional()
  @IsString()
  kostenstelle?: string;           // Kostenstelle

  @IsOptional()
  @IsString()
  bemerkung?: string;              // Bemerkung

  @IsOptional()
  @IsString()
  typ?: string;                    // Typ

  // Service
  @IsString()
  vehicleType: string;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsOptional()
  @IsString()
  serviceDescription?: string;

  // Addresses
  @ValidateNested()
  @Type(() => CreateAddressDto)
  pickupAddress: CreateAddressDto;

  @ValidateNested()
  @Type(() => CreateAddressDto)
  deliveryAddress: CreateAddressDto;


   // إضافة حقل الأضرار
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDamageDto)
  damages?: CreateVehicleDamageDto[];

}

export class UpdateDamagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDamageDto)
  damages: CreateVehicleDamageDto[];
}