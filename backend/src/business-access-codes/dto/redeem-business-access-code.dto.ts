import { IsString, IsOptional, IsObject } from 'class-validator';

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

export class RedeemBusinessAccessCodeDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  salonId?: string;

  @IsOptional()
  @IsString()
  googlePlaceId?: string;

  @IsOptional()
  @IsObject()
  factualSnapshot?: ExternalSalonSnapshotDto;
}
