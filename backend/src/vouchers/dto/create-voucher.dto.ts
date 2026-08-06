import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherCodeType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateVoucherDto {
  @ApiProperty({ enum: VoucherCodeType })
  @IsEnum(VoucherCodeType)
  type!: VoucherCodeType;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  valueAmount?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  valuePercent?: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @ApiPropertyOptional({ example: '2026-08-04T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2027-08-04T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 'user_cuid' })
  @IsOptional()
  @IsString()
  assignedUserId?: string;

  @ApiPropertyOptional({ example: 'salon_cuid' })
  @IsOptional()
  @IsString()
  assignedSalonId?: string;

  @ApiPropertyOptional({
    example: {
      bookingScope: {
        serviceIds: ['svc1'],
        salonIds: ['salon1'],
      },
    },
  })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
