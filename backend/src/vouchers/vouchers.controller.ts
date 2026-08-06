import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateVoucherBatchDto } from './dto/create-voucher-batch.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';
import { VouchersService } from './vouchers.service';

@ApiTags('vouchers')
@ApiBearerAuth()
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post('generate')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate a single Gutscheincode' })
  generateOne(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVoucherDto,
  ) {
    return this.vouchersService.generateOne(user.id, dto);
  }

  @Post('generate-batch')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate a batch of Gutscheincodes' })
  generateBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVoucherBatchDto,
  ) {
    return this.vouchersService.generateBatch(user.id, dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List vouchers without clear code values' })
  list(
    @Query('status') status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED',
    @Query('type') type?:
      | 'PARTNER_DAY'
      | 'PARTNER_MONTH'
      | 'PARTNER_YEAR'
      | 'CLIENT_DISCOUNT'
      | 'BOOKING_CREDIT'
      | 'PROMO_TRIAL',
  ) {
    return this.vouchersService.list({ status, type });
  }

  @Patch(':voucherId/revoke')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Revoke voucher code' })
  revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('voucherId') voucherId: string,
  ) {
    return this.vouchersService.revoke(user.id, voucherId);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem Gutscheincode for current user' })
  redeem(@CurrentUser() user: AuthenticatedUser, @Body() dto: RedeemVoucherDto) {
    return this.vouchersService.redeem(user, dto);
  }

  @Get('redemptions')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List activations/redemptions for audit' })
  listRedemptions() {
    return this.vouchersService.listRedemptions();
  }
}
