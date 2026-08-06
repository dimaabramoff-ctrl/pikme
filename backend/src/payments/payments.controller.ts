import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CreateBookingPaymentIntentDto } from './dto/create-booking-payment-intent.dto';
import { DemoPaymentWebhookDto } from './dto/demo-payment-webhook.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('booking/:bookingId/intent')
  @ApiOperation({ summary: 'Create payment intent for specific booking' })
  createBookingPaymentIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateBookingPaymentIntentDto,
  ) {
    return this.paymentsService.createBookingPaymentIntent(user, bookingId, dto);
  }

  @Public()
  @Post('webhook/demo')
  @ApiOperation({ summary: 'Demo webhook to confirm payment server-side' })
  handleDemoWebhook(@Body() dto: DemoPaymentWebhookDto) {
    return this.paymentsService.handleDemoWebhook(dto);
  }
}
