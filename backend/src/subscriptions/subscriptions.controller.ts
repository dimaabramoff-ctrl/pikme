import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionCheckoutDto } from './dto/subscription-checkout.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plan catalog' })
  getPlans() {
    return this.subscriptionsService.getCatalog();
  }

  @Get('status')
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get subscription status for a salon' })
  getStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('salonId') salonId: string,
  ) {
    return this.subscriptionsService.getStatus(user.id, salonId);
  }

  @Post('checkout')
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate subscription checkout (presentation or production)' })
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionCheckoutDto,
  ) {
    return this.subscriptionsService.checkout(user.id, dto);
  }
}
