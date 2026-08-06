import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AccountStatus,
  BookingStatus,
  MasterWorkStatus,
  PartnerSubscriptionPlan,
  PartnerSubscriptionSource,
  PartnerSubscriptionStatus,
  Role,
} from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async getAuditLogs(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = Math.max(1, Math.min(Number(limitRaw ?? 20) || 20, 100));
    const items = await this.prisma.auditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      include: {
        actorUser: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { items };
  }

  @Patch('salons/:salonId/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async setSalonProfileState(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('salonId') salonId: string,
    @Body() body: { active?: boolean; reason?: string },
  ) {
    if (typeof body.active !== 'boolean') {
      throw new BadRequestException('active must be boolean');
    }

    const before = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, isActive: true },
    });
    if (!before) throw new BadRequestException('Salon not found');

    const updated = await this.prisma.salon.update({
      where: { id: salonId },
      data: { isActive: body.active },
      select: { id: true, isActive: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: body.active ? 'SALON_PROFILE_ACTIVATED' : 'SALON_PROFILE_DEACTIVATED',
        entityType: 'Salon',
        entityId: salonId,
        reason: body.reason ?? null,
        before: { isActive: before.isActive },
        after: { isActive: updated.isActive },
      },
    });

    return { success: true, salonId, isActive: updated.isActive };
  }

  @Patch('salons/:salonId/access')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async setSalonAccessState(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('salonId') salonId: string,
    @Body() body: { locked?: boolean; reason?: string },
  ) {
    if (typeof body.locked !== 'boolean') {
      throw new BadRequestException('locked must be boolean');
    }

    const before = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, openingStatus: true },
    });
    if (!before) throw new BadRequestException('Salon not found');

    const openingStatus = body.locked ? 'LOCKED' : 'ACTIVE';
    const updated = await this.prisma.salon.update({
      where: { id: salonId },
      data: { openingStatus },
      select: { id: true, openingStatus: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: body.locked ? 'SALON_ACCESS_LOCKED' : 'SALON_ACCESS_UNLOCKED',
        entityType: 'Salon',
        entityId: salonId,
        reason: body.reason ?? null,
        before: { openingStatus: before.openingStatus },
        after: { openingStatus: updated.openingStatus },
      },
    });

    return { success: true, salonId, openingStatus: updated.openingStatus };
  }

  @Patch('masters/:masterId/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async setMasterProfileState(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('masterId') masterId: string,
    @Body() body: { active?: boolean; reason?: string },
  ) {
    if (typeof body.active !== 'boolean') {
      throw new BadRequestException('active must be boolean');
    }

    const before = await this.prisma.masterProfile.findUnique({
      where: { id: masterId },
      select: { id: true, acceptsBookings: true, currentStatus: true },
    });
    if (!before) throw new BadRequestException('Master not found');

    const updated = await this.prisma.masterProfile.update({
      where: { id: masterId },
      data: {
        acceptsBookings: body.active,
        currentStatus: body.active ? MasterWorkStatus.AVAILABLE : MasterWorkStatus.OFFLINE,
      },
      select: { id: true, acceptsBookings: true, currentStatus: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: body.active ? 'MASTER_PROFILE_ACTIVATED' : 'MASTER_PROFILE_DEACTIVATED',
        entityType: 'MasterProfile',
        entityId: masterId,
        reason: body.reason ?? null,
        before: {
          acceptsBookings: before.acceptsBookings,
          currentStatus: before.currentStatus,
        },
        after: {
          acceptsBookings: updated.acceptsBookings,
          currentStatus: updated.currentStatus,
        },
      },
    });

    return { success: true, masterId, acceptsBookings: updated.acceptsBookings };
  }

  @Patch('masters/:masterId/edit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async updateMasterByAdmin(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('masterId') masterId: string,
    @Body()
    body: {
      displayName?: string;
      specialization?: string;
      biography?: string;
      acceptsHomeVisits?: boolean;
      homeVisitRadiusKm?: number;
      currentStatus?: MasterWorkStatus;
      reason?: string;
    },
  ) {
    const before = await this.prisma.masterProfile.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        displayName: true,
        specialization: true,
        biography: true,
        acceptsHomeVisits: true,
        homeVisitRadiusKm: true,
        currentStatus: true,
      },
    });
    if (!before) throw new BadRequestException('Master not found');

    const updated = await this.prisma.masterProfile.update({
      where: { id: masterId },
      data: {
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.specialization !== undefined ? { specialization: body.specialization } : {}),
        ...(body.biography !== undefined ? { biography: body.biography } : {}),
        ...(body.acceptsHomeVisits !== undefined
          ? { acceptsHomeVisits: body.acceptsHomeVisits }
          : {}),
        ...(body.homeVisitRadiusKm !== undefined
          ? { homeVisitRadiusKm: body.homeVisitRadiusKm }
          : {}),
        ...(body.currentStatus !== undefined
          ? { currentStatus: body.currentStatus }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        specialization: true,
        biography: true,
        acceptsHomeVisits: true,
        homeVisitRadiusKm: true,
        currentStatus: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'MASTER_PROFILE_EDITED_BY_ADMIN',
        entityType: 'MasterProfile',
        entityId: masterId,
        reason: body.reason ?? null,
        before,
        after: updated,
      },
    });

    return { success: true, master: updated };
  }

  @Patch('users/:userId/access')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async setUserAccessState(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('userId') userId: string,
    @Body() body: { locked?: boolean; reason?: string },
  ) {
    if (typeof body.locked !== 'boolean') {
      throw new BadRequestException('locked must be boolean');
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, accountStatus: true },
    });
    if (!before) throw new BadRequestException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: !body.locked,
        accountStatus: body.locked ? AccountStatus.SUSPENDED : AccountStatus.ACTIVE,
        accountStatusReason: body.reason ?? null,
        accountStatusUpdatedAt: new Date(),
      },
      select: { id: true, isActive: true, accountStatus: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: body.locked ? 'USER_ACCESS_LOCKED' : 'USER_ACCESS_UNLOCKED',
        entityType: 'User',
        entityId: userId,
        reason: body.reason ?? null,
        before,
        after: updated,
      },
    });

    return { success: true, userId, isActive: updated.isActive };
  }

  @Post('salons/:salonId/trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async manageSalonTrial(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('salonId') salonId: string,
    @Body() body: { enabled?: boolean; days?: number; reason?: string },
  ) {
    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be boolean');
    }

    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, name: true },
    });
    if (!salon) throw new BadRequestException('Salon not found');

    if (!body.enabled) {
      const now = new Date();
      const result = await this.prisma.partnerSubscription.updateMany({
        where: {
          salonId,
          status: { in: [PartnerSubscriptionStatus.TRIAL, PartnerSubscriptionStatus.ACTIVE] },
        },
        data: {
          status: PartnerSubscriptionStatus.CANCELLED,
          endsAt: now,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'SALON_TRIAL_DEACTIVATED',
          entityType: 'Salon',
          entityId: salonId,
          reason: body.reason ?? null,
          payload: { affectedSubscriptions: result.count },
        },
      });

      return { success: true, salonId, trialEnabled: false, affectedSubscriptions: result.count };
    }

    const activeTrial = await this.prisma.partnerSubscription.findFirst({
      where: {
        salonId,
        status: { in: [PartnerSubscriptionStatus.TRIAL, PartnerSubscriptionStatus.ACTIVE] },
      },
      select: { id: true },
    });
    if (activeTrial) {
      return { success: true, salonId, trialEnabled: true, alreadyActive: true };
    }

    const days = Math.max(1, Math.min(Number(body.days ?? 30) || 30, 365));
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.partnerSubscription.create({
      data: {
        userId: user.id,
        salonId,
        plan: PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL,
        status: PartnerSubscriptionStatus.TRIAL,
        source: PartnerSubscriptionSource.MANUAL,
        startsAt,
        endsAt,
      },
      select: { id: true, startsAt: true, endsAt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'SALON_TRIAL_ACTIVATED',
        entityType: 'Salon',
        entityId: salonId,
        reason: body.reason ?? null,
        payload: {
          subscriptionId: subscription.id,
          days,
          startsAt: subscription.startsAt,
          endsAt: subscription.endsAt,
        },
      },
    });

    return { success: true, salonId, trialEnabled: true, subscription };
  }

  @Post('test-data/reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async resetTestData(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Body() body: { confirm?: boolean; reason?: string; scope?: 'ALL' | 'DEMO_SALON' | 'DEMO_ZUHAUSE' | 'TESTBETRIEB' },
  ) {
    if (!body.confirm) {
      throw new BadRequestException('Reset confirmation required');
    }

    const scope = body.scope ?? 'ALL';

    if (process.env.NODE_ENV === 'production' && scope === 'ALL') {
      throw new BadRequestException('ALL reset is disabled in production');
    }

    if (scope === 'DEMO_SALON') {
      await this.resetDemoSalon();
    } else if (scope === 'DEMO_ZUHAUSE') {
      await this.resetDemoZuhause();
    } else if (scope === 'TESTBETRIEB') {
      await this.resetTestbetrieb();
    } else {
      await this.resetAllData();
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'TEST_DATA_RESET',
        entityType: 'System',
        entityId: `test-data-reset:${scope}`,
        reason: body.reason ?? 'Manual test reset',
        payload: { scope },
      },
    });

    return { success: true, scope };
  }

  private async resetAllData() {
    await this.prisma.$transaction(async (tx) => {
            const demoOwner = await tx.user.findFirst({
              where: { email: 'demo.salon.owner@example.test' },
              select: { id: true },
            });
      await tx.notification.deleteMany({});
      await tx.review.deleteMany({});
      await tx.bookingStatusHistory.deleteMany({});
      await tx.bookingExtra.deleteMany({});
      await tx.bookingPayment.deleteMany({});
      await tx.payment.deleteMany({});
      await tx.refund.deleteMany({});
      await tx.platformCommission.deleteMany({});
      await tx.homeVisitDetails.deleteMany({});
      await tx.homeVisitQuote.deleteMany({});
      await tx.booking.deleteMany({});
      await tx.scheduleBreak.deleteMany({});
      await tx.workingSchedule.deleteMany({});
      await tx.masterService.deleteMany({});
      await tx.service.deleteMany({});
      await tx.salonMaster.deleteMany({});
      await tx.salonAdmin.deleteMany({});
      await tx.masterPortfolioItem.deleteMany({});
      await tx.salonPhoto.deleteMany({});
      await tx.customerAddress.deleteMany({});
      await tx.favorite.deleteMany({});
      await tx.review.deleteMany({});
      await tx.customerProfile.deleteMany({});
      await tx.masterProfile.deleteMany({});
      await tx.partnerSubscription.deleteMany({});
      await tx.businessAccessCode.deleteMany({});
      await tx.businessClaim.deleteMany({});
      await tx.partnerAccessRequest.deleteMany({});
      await tx.voucherRedemption.deleteMany({});
      await tx.voucherCode.deleteMany({});
      await tx.bonusCreditLedger.deleteMany({});
    });
  }

  private async resetDemoSalon() {
    const salon = await this.prisma.salon.findFirst({
      where: { slug: 'pickme-demo-salon' },
      select: { id: true },
    });
    if (!salon) return;

    const masters = await this.prisma.salonMaster.findMany({
      where: { salonId: salon.id },
      select: { masterId: true },
    });
    const masterIds = masters.map((item) => item.masterId);

    await this.prisma.$transaction(async (tx) => {
      const demoOwner = await tx.user.findFirst({
        where: { email: 'demo.salon.owner@example.test' },
        select: { id: true },
      });

      await tx.review.deleteMany({ where: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } });
      await tx.bookingStatusHistory.deleteMany({ where: { booking: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } } });
      await tx.booking.deleteMany({ where: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } });

      await tx.masterProfile.updateMany({
        where: { id: { in: masterIds } },
        data: {
          currentStatus: 'AVAILABLE',
          minutesUntilAvailable: 0,
          availableAt: null,
        },
      });

      const mila = await tx.masterProfile.findFirst({ where: { id: { in: masterIds }, displayName: 'Mila' }, select: { id: true } });
      const deniz = await tx.masterProfile.findFirst({ where: { id: { in: masterIds }, displayName: 'Deniz' }, select: { id: true } });
      const customer = await tx.customerProfile.findFirst({ select: { id: true } });
      const damenschnitt = await tx.service.findFirst({ where: { salonId: salon.id, name: 'Damenschnitt' }, select: { id: true } });
      const herrenschnitt = await tx.service.findFirst({ where: { salonId: salon.id, name: 'Herrenschnitt' }, select: { id: true } });

      if (mila?.id && customer?.id && damenschnitt?.id) {
        const busy = await tx.booking.create({
          data: {
            customerProfileId: customer.id,
            masterId: mila.id,
            salonId: salon.id,
            serviceId: damenschnitt.id,
            status: BookingStatus.confirmed,
            startsAt: new Date(Date.now() - 10 * 60 * 1000),
            endsAt: new Date(Date.now() + 50 * 60 * 1000),
            totalPrice: '44',
            currency: 'EUR',
          },
        });
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: busy.id,
            fromStatus: BookingStatus.pending,
            toStatus: BookingStatus.confirmed,
            changedBy: demoOwner?.id ?? customer.id,
          },
        });
      }

      if (deniz?.id && customer?.id && herrenschnitt?.id) {
        await tx.booking.create({
          data: {
            customerProfileId: customer.id,
            masterId: deniz.id,
            salonId: salon.id,
            serviceId: herrenschnitt.id,
            status: BookingStatus.confirmed,
            startsAt: new Date(Date.now() + 40 * 60 * 1000),
            endsAt: new Date(Date.now() + 75 * 60 * 1000),
            totalPrice: '30',
            currency: 'EUR',
          },
        });
      }
    });
  }

  private async resetDemoZuhause() {
    const master = await this.prisma.masterProfile.findFirst({
      where: {
        OR: [
          { user: { email: { startsWith: 'demo.zuhause.', mode: 'insensitive' } } },
          { biography: { contains: 'DEMO_ZUHAUSE_PROFILE', mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (!master) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { masterId: master.id } });
      await tx.bookingStatusHistory.deleteMany({ where: { booking: { masterId: master.id } } });
      await tx.booking.deleteMany({ where: { masterId: master.id } });
      await tx.masterProfile.update({
        where: { id: master.id },
        data: {
          currentStatus: 'AVAILABLE',
          minutesUntilAvailable: 15,
          availableAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    });
  }

  private async resetTestbetrieb() {
    const salon = await this.prisma.salon.findFirst({
      where: {
        OR: [
          { externalProvider: 'PICKME_TEST' },
          { externalPlaceId: 'pickme-testbetrieb-berlin-001' },
          { slug: 'pickme-testbetrieb' },
        ],
      },
      select: { id: true, externalPlaceId: true, externalProvider: true },
    });
    if (!salon) return;

    const linkedMasters = await this.prisma.salonMaster.findMany({
      where: { salonId: salon.id },
      select: { masterId: true },
    });
    const masterIds = linkedMasters.map((item) => item.masterId);

    const memberships = await this.prisma.salonAdmin.findMany({
      where: { salonId: salon.id },
      select: { userId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } });
      await tx.bookingStatusHistory.deleteMany({ where: { booking: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } } });
      await tx.booking.deleteMany({ where: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } });

      await tx.scheduleBreak.deleteMany({ where: { schedule: { masterId: { in: masterIds } } } });
      await tx.workingSchedule.deleteMany({ where: { OR: [{ salonId: salon.id }, { masterId: { in: masterIds } }] } });
      await tx.masterService.deleteMany({ where: { OR: [{ service: { salonId: salon.id } }, { masterId: { in: masterIds } }] } });
      await tx.service.deleteMany({ where: { salonId: salon.id } });
      await tx.masterPortfolioItem.deleteMany({ where: { masterId: { in: masterIds } } });
      await tx.salonMaster.deleteMany({ where: { salonId: salon.id } });
      await tx.masterProfile.deleteMany({ where: { id: { in: masterIds } } });

      await tx.partnerSubscription.deleteMany({ where: { salonId: salon.id } });
      await tx.businessAccessCode.deleteMany({
        where: {
          OR: [
            { targetSalonId: salon.id },
            ...(salon.externalPlaceId
              ? [{ targetGooglePlaceId: salon.externalPlaceId }]
              : []),
          ],
        },
      });
      await tx.businessClaim.deleteMany({ where: { salonId: salon.id } });
      await tx.salonAdmin.deleteMany({ where: { salonId: salon.id } });

      for (const membership of memberships) {
        const otherMemberships = await tx.salonAdmin.count({
          where: {
            userId: membership.userId,
            isActive: true,
          },
        });
        if (otherMemberships === 0) {
          await tx.user.updateMany({
            where: {
              id: membership.userId,
              role: { in: [Role.SALON_OWNER, Role.SALON_ADMIN] },
            },
            data: { role: Role.CUSTOMER },
          });
        }
      }

      await tx.salon.update({
        where: { id: salon.id },
        data: {
          sourceType: 'EXTERNAL',
          externalProvider: salon.externalProvider ?? 'PICKME_TEST',
          externalPlaceId: salon.externalPlaceId ?? 'pickme-testbetrieb-berlin-001',
          isVerified: false,
          cancellationPolicyJson: {
            pickmeProfileFlags: {
              isDemoProfile: false,
              isTestProfile: true,
              profileKind: 'TESTBETRIEB',
              testMarker: 'pickme-testbetrieb-berlin-001',
            },
            profileMeta: {
              externalLike: true,
              connectedState: 'NOT_CONNECTED',
            },
          },
        },
      });
    });
  }
}