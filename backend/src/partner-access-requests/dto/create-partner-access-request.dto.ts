import { IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PartnerAccessRequestDuration, PartnerAccessRequestStatus } from '@prisma/client';

export class CreatePartnerAccessRequestDto {
  @IsString()
  @Length(2, 120)
  contactName: string;

  @IsString()
  @Length(2, 120)
  salonName: string;

  @IsString()
  @Length(2, 80)
  city: string;

  @IsString()
  @Length(6, 24)
  phone: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsEnum(PartnerAccessRequestDuration)
  requestedDuration: PartnerAccessRequestDuration;

  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  existingUserId?: string;

  @IsOptional()
  @IsString()
  existingSalonId?: string;
}

export class UpdatePartnerAccessRequestStatusDto {
  @IsEnum(PartnerAccessRequestStatus)
  status: PartnerAccessRequestStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
