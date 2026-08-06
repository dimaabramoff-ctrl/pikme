import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessClaimsService } from './business-claims.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { CreateBusinessClaimDto } from './dto/create-business-claim.dto';
import { RequestTrialDto } from './dto/request-trial.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('business-claims')
@Controller('business-claims')
export class BusinessClaimsController {
  constructor(private readonly claimsService: BusinessClaimsService) {}

  /**
   * SUPER_ADMIN: Получить все claims
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async getAllClaims() {
    return this.claimsService.getAllClaimsForAdmin();
  }

  /**
   * Owner: Активировать Trial после APPROVED claim (без кода)
   */
  @Post(':claimId/activate-trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async activateTrialDirect(
    @CurrentUser() user: User,
    @Param('claimId') claimId: string,
  ) {
    return this.claimsService.activateTrialDirect(user.id, claimId);
  }

  /**
   * Создать запрос управления бизнесом
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createClaim(
    @CurrentUser() user: User,
    @Body() dto: CreateBusinessClaimDto,
  ) {
    return this.claimsService.createClaim(user.id, dto);
  }

  /**
   * Запросить Trial код
   */
  @Post(':claimId/request-trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async requestTrial(
    @CurrentUser() user: User,
    @Param('claimId') claimId: string,
    @Body() dto: RequestTrialDto,
  ) {
    return this.claimsService.requestTrial(user.id, claimId, dto);
  }

  /**
   * Получить мои бизнесы
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyBusinesses(@CurrentUser() user: User) {
    return this.claimsService.getMyBusinesses(user.id);
  }

  /**
   * Получить детали claim
   */
  @Get(':claimId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getBusinessClaim(
    @CurrentUser() user: User,
    @Param('claimId') claimId: string,
  ) {
    return this.claimsService.getBusinessClaim(user.id, claimId);
  }

  /**
   * SUPER_ADMIN: Одобрить claim
   */
  @Patch(':claimId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async approveClaim(
    @CurrentUser() user: User,
    @Param('claimId') claimId: string,
  ) {
    return this.claimsService.approveClaim(user.id, claimId);
  }

  /**
   * SUPER_ADMIN: Отклонить claim
   */
  @Patch(':claimId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async rejectClaim(
    @CurrentUser() user: User,
    @Param('claimId') claimId: string,
    @Body() body: { reason?: string },
  ) {
    return this.claimsService.rejectClaim(user.id, claimId, body.reason);
  }

  /**
   * SUPER_ADMIN: Отозвать управление
   */
  @Patch(':claimId/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async revokeClaim(
    @CurrentUser() user: User,
    @Param('claimId') claimId: string,
    @Body() body: { reason?: string },
  ) {
    return this.claimsService.revokeClaim(user.id, claimId, body.reason);
  }
}
