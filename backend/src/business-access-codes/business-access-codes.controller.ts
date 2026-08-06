import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessAccessCodesService } from './business-access-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { CreateBusinessAccessCodeDto } from './dto/create-business-access-code.dto';
import { RedeemBusinessAccessCodeDto } from './dto/redeem-business-access-code.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('business-access-codes')
@Controller('business-access-codes')
export class BusinessAccessCodesController {
  constructor(
    private readonly accessCodesService: BusinessAccessCodesService,
  ) {}

  /**
   * Создать код доступа (только SUPER_ADMIN)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async createAccessCode(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessAccessCodeDto,
  ) {
    return this.accessCodesService.createAccessCode(user.id, dto);
  }

  /**
   * Активировать код доступа
   */
  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async redeemCode(
    @CurrentUser() user: User,
    @Body() dto: RedeemBusinessAccessCodeDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.accessCodesService.redeemCode(user.id, dto, response);
  }

  /**
   * Отозвать код (Admin)
   */
  @Patch(':codeId/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async revokeCode(
    @CurrentUser() user: User,
    @Param('codeId') codeId: string,
    @Body() body: { reason?: string },
  ) {
    return this.accessCodesService.revokeCode(user.id, codeId, body.reason);
  }

  /**
   * Список всех кодов (только SUPER_ADMIN видит все)
   */
  @Get('list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async listCodes(
    @Query('targetSalonId') targetSalonId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.accessCodesService.listCodes({
      targetSalonId,
      status: status as any,
      type: type as any,
    });
  }
}
