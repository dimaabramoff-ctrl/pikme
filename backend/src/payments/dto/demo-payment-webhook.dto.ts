import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum DemoWebhookStatus {
  PAID = 'PAID',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class DemoPaymentWebhookDto {
  @ApiProperty({ example: 'pi_demo_1234' })
  @IsString()
  providerPaymentIntentId!: string;

  @ApiProperty({ enum: DemoWebhookStatus })
  @IsEnum(DemoWebhookStatus)
  status!: DemoWebhookStatus;
}
