import { Body, Controller, Get, Param, Patch, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdatePartnerAccessRequestStatusDto } from './dto/create-partner-access-request.dto';
import { PartnerAccessRequestsService } from './partner-access-requests.service';

@Controller('admin/partner-access-requests')
export class AdminPartnerAccessRequestsController {
  constructor(private readonly service: PartnerAccessRequestsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get()
  list(@Request() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.service.listForAdmin();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePartnerAccessRequestStatusDto, @Request() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.service.updateStatus(id, dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Post(':id/create-access-code')
  createAccessCode(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.service.createAccessCodeForRequest(id, req.user.id);
  }
}
