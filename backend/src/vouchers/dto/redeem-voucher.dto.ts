import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RedeemVoucherDto {
  @ApiPropertyOptional({ example: 'PM-MONTH-7K4Q-X9TZ' })
  @IsString()
  @MinLength(8)
  code!: string;

  @ApiPropertyOptional({ example: 'salon_cuid' })
  @IsOptional()
  @IsString()
  salonId?: string;

  @ApiPropertyOptional({ example: 'booking_cuid' })
  @IsOptional()
  @IsString()
  bookingId?: string;
}
