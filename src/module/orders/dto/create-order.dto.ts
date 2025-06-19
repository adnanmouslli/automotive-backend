import { IsString, IsOptional, IsArray, IsNumber, IsEnum } from 'class-validator';
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
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  items?: string[];

  // Vehicle Data
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

  // Service
  @IsString()
  vehicleType: string;

  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsOptional()
  @IsString()
  serviceDescription?: string;

  // Addresses
  @Type(() => CreateAddressDto)
  pickupAddress: CreateAddressDto;

  @Type(() => CreateAddressDto)
  deliveryAddress: CreateAddressDto;
}