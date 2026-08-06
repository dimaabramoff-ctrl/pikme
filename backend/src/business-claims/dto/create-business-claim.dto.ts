import { IsOptional, IsString, IsObject, IsEmail, IsIn } from 'class-validator';

export interface ExternalSalonSnapshotDto {
  name?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  photo?: string;
  rating?: number;
  reviewCount?: number;
}

export class CreateBusinessClaimDto {
  @IsOptional()
  @IsString()
  salonId?: string;

  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @IsOptional()
  @IsObject()
  factualSnapshot?: ExternalSalonSnapshotDto;

  // Contact information for verification
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactRole?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  preferredContactMethod?: string;

  @IsOptional()
  @IsString()
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
