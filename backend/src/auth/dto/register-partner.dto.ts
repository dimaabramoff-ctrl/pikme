import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RegisterPartnerStaffServiceDto {
  @ApiProperty({ example: 'Женская стрижка' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'hair_salon' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  category!: string;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(10)
  @Max(360)
  durationMinutes!: number;

  @ApiProperty({ example: 45 })
  @Type(() => Number)
  @Min(0)
  price!: number;
}

class RegisterPartnerStaffDto {
  @ApiProperty({ example: 'Anna Keller' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Senior Stylist' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  specialization?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  photoUrl?: string;

  @ApiProperty({ type: [RegisterPartnerStaffServiceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterPartnerStaffServiceDto)
  services!: RegisterPartnerStaffServiceDto[];
}

export class RegisterPartnerDto {
  @ApiProperty({ example: 'Owner Name' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ownerName!: string;

  @ApiProperty({ example: 'owner@example.test' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: '+491234567890' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  ownerPhone!: string;

  @ApiPropertyOptional({ example: 'Passw0rd123' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  ownerPassword?: string;

  @ApiPropertyOptional({ example: 'Passw0rd123' })
  @IsOptional()
  @IsString()
  ownerPasswordConfirmation?: string;

  @ApiProperty({ example: 'PickMe Atelier Royal' })
  @IsString()
  @MinLength(2)
  @MaxLength(140)
  salonName!: string;

  @ApiProperty({ example: 'Schlossstrasse 14, 19288 Ludwigslust' })
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  salonAddressLine!: string;

  @ApiProperty({ example: 'Ludwigslust' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  salonCity!: string;

  @ApiProperty({ example: '19288' })
  @IsString()
  @MinLength(3)
  @MaxLength(24)
  salonPostalCode!: string;

  @ApiPropertyOptional({ example: '+49 3874 555 120' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  salonPhone?: string;

  @ApiPropertyOptional({ example: 'hair_salon' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  salonCategory?: string;

  @ApiPropertyOptional({ example: 'Пн-Сб 09:00 - 20:00' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  salonWorkHours?: string;

  @ApiPropertyOptional({ example: 'google-place-id-123' })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  existingGooglePlaceId?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  ownershipConfirmed!: boolean;

  @ApiPropertyOptional({ type: [RegisterPartnerStaffDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegisterPartnerStaffDto)
  staff?: RegisterPartnerStaffDto[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activateDemoTrial?: boolean;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  demoTrialDays?: number;
}

export type RegisterPartnerStaffInput = RegisterPartnerStaffDto;
