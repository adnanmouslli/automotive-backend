import { IsOptional, IsString } from "class-validator";

export class CreateSignatureDto {
  @IsString()
  name: string;

  @IsString()
  signUrl: string;

  @IsOptional()
  @IsString()
  location?: string;
}