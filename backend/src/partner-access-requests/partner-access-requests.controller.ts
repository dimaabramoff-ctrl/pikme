import { Body, Controller, Get, Param, Post, Patch, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { PartnerAccessRequestsService } from './partner-access-requests.service';
import { CreatePartnerAccessRequestDto, UpdatePartnerAccessRequestStatusDto } from './dto/create-partner-access-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';

@Controller('partner-access-requests')
export class PartnerAccessRequestsController {
  constructor(private readonly service: PartnerAccessRequestsService) {}

  @Public()
  @Post()
  create(@Body() dto: CreatePartnerAccessRequestDto, @Request() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user?.id);
  }

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
  @Post(':id/access-code')
  createAccessCode(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    if (!req.user) throw new UnauthorizedException();
    return this.service.createAccessCodeForRequest(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.service.markActivated(id);
  }
}
