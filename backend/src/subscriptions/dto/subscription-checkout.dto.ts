import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubscriptionCheckoutDto {
  @IsString()
  salonId!: string;

  @IsInt()
  @Min(1)
  @Max(24)
  durationMonths!: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
