import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum BookingPaymentMethodInput {
  CARD = 'CARD',
  IN_SALON = 'IN_SALON',
  DEMO = 'DEMO',
}

export class CreateBookingPaymentIntentDto {
  @ApiProperty({ enum: BookingPaymentMethodInput })
  @IsEnum(BookingPaymentMethodInput)
  paymentMethod!: BookingPaymentMethodInput;

  @ApiPropertyOptional({ example: 'PM-DISC-AB12-CD34' })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
