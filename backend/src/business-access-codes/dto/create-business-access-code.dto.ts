import { IsOptional, IsString, IsInt, IsEmail, IsEnum } from 'class-validator';
import { BusinessAccessCodeType } from '@prisma/client';

export class CreateBusinessAccessCodeDto {
  @IsOptional()
  @IsString()
  targetSalonId?: string;

  @IsOptional()
  @IsString()
  targetGooglePlaceId?: string;

  @IsInt()
  durationDays: number;

  @IsEnum(BusinessAccessCodeType)
  type: BusinessAccessCodeType;

  @IsOptional()
  @IsEmail()
  assignedEmail?: string;

  @IsOptional()
  isOneTime?: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}
