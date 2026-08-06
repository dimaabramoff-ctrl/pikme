import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StaffDraftStatus, MasterWorkStatus } from '@prisma/client';
import { IsString, IsOptional, IsEnum } from 'class-validator';

class UpsertStaffDraftDto {
  @IsString()
  displayName: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsEnum(MasterWorkStatus)
  workStatus?: MasterWorkStatus;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

@ApiTags('salon-staff-drafts')
@Controller('salons/:salonId/staff-drafts')
export class SalonStaffDraftsController {
  constructor(private readonly prisma: PrismaService) {}

  /** List all drafts and published for this salon (owner only) */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async list(@Param('salonId') salonId: string, @CurrentUser() user: User) {
    await this.assertOwnership(salonId, user.id, user.role);
    return this.prisma.salonStaffDraft.findMany({
      where: { salonId, status: { not: StaffDraftStatus.ARCHIVED } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Create a new draft */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async create(
    @Param('salonId') salonId: string,
    @Body() dto: UpsertStaffDraftDto,
    @CurrentUser() user: User,
  ) {
    await this.assertOwnership(salonId, user.id, user.role);
    return this.prisma.salonStaffDraft.create({
      data: {
        salonId,
        createdByUserId: user.id,
        displayName: dto.displayName,
        specialization: dto.specialization,
        workStatus: dto.workStatus ?? MasterWorkStatus.AVAILABLE,
        avatarUrl: dto.avatarUrl,
        status: StaffDraftStatus.DRAFT,
      },
    });
  }

  /** Update draft fields */
  @Patch(':draftId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async update(
    @Param('salonId') salonId: string,
    @Param('draftId') draftId: string,
    @Body() dto: Partial<UpsertStaffDraftDto>,
    @CurrentUser() user: User,
  ) {
    await this.assertOwnership(salonId, user.id, user.role);
    return this.prisma.salonStaffDraft.update({
      where: { id: draftId, salonId },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
        ...(dto.specialization !== undefined ? { specialization: dto.specialization } : {}),
        ...(dto.workStatus ? { workStatus: dto.workStatus } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
  }

  /** Publish a draft (checks subscription) */
  @Post(':draftId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async publish(
    @Param('salonId') salonId: string,
    @Param('draftId') draftId: string,
    @CurrentUser() user: User,
  ) {
    await this.assertOwnership(salonId, user.id, user.role);
    // Check active subscription/trial
    const sub = await this.prisma.partnerSubscription.findFirst({
      where: {
        salonId,
        status: { in: ['TRIAL', 'ACTIVE'] },
        endsAt: { gte: new Date() },
      },
    });
    if (!sub) {
      return { error: 'SUBSCRIPTION_REQUIRED', message: 'Aktiver Zugang erforderlich' };
    }
    return this.prisma.salonStaffDraft.update({
      where: { id: draftId, salonId },
      data: { status: StaffDraftStatus.PUBLISHED, publishedAt: new Date() },
    });
  }

  /** Delete or archive */
  @Delete(':draftId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  async remove(
    @Param('salonId') salonId: string,
    @Param('draftId') draftId: string,
    @CurrentUser() user: User,
  ) {
    await this.assertOwnership(salonId, user.id, user.role);
    const draft = await this.prisma.salonStaffDraft.findUnique({
      where: { id: draftId, salonId },
    });
    if (!draft) return { deleted: false };

    if (draft.status === StaffDraftStatus.DRAFT) {
      // Hard delete drafts
      await this.prisma.salonStaffDraft.delete({ where: { id: draftId } });
      return { deleted: true, archived: false };
    } else {
      // Archive published
      await this.prisma.salonStaffDraft.update({
        where: { id: draftId },
        data: { status: StaffDraftStatus.ARCHIVED, archivedAt: new Date() },
      });
      return { deleted: false, archived: true };
    }
  }

  private async assertOwnership(salonId: string, userId: string, role: string) {
    if (role === 'SUPER_ADMIN') return;
    const admin = await this.prisma.salonAdmin.findUnique({
      where: { userId_salonId: { userId, salonId } },
    });
    if (!admin || !admin.isActive) {
      throw new Error('Forbidden');
    }
  }
}
