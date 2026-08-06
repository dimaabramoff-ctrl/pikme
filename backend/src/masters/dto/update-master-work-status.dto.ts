import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MasterWorkStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateMasterWorkStatusDto {
  @ApiProperty({ enum: MasterWorkStatus })
  @IsEnum(MasterWorkStatus)
  status!: MasterWorkStatus;

  @ApiPropertyOptional({ example: '2026-08-04T11:20:00.000Z' })
  @IsOptional()
  @IsDateString()
  busyUntil?: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(240)
  minutesUntilAvailable?: number;
}
