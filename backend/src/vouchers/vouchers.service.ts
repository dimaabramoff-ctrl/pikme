import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BonusCreditEventType,
  PartnerSubscriptionPlan,
  PartnerSubscriptionSource,
  PartnerSubscriptionStatus,
  Prisma,
  Role,
  VoucherCodeStatus,
  VoucherCodeType,
  VoucherRedemptionStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { buildApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateVoucherBatchDto } from './dto/create-voucher-batch.dto';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { RedeemVoucherDto } from './dto/redeem-voucher.dto';

interface ListFilters {
  status?: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  type?:
    | 'PARTNER_DAY'
    | 'PARTNER_MONTH'
    | 'PARTNER_YEAR'
    | 'CLIENT_DISCOUNT'
    | 'BOOKING_CREDIT'
    | 'PROMO_TRIAL';
}

@Injectable()
export class VouchersService {
  constructor(private readonly prisma: PrismaService) {}

  async generateOne(createdByUserId: string, dto: CreateVoucherDto) {
    this.validateCreatePayload(dto);
    const fullCode = this.buildVoucherCode(dto);
    const codeHash = this.hashCode(fullCode);

    const created = await this.prisma.voucherCode.create({
      data: {
        codeHash,
        codePrefix: fullCode.split('-').slice(0, 2).join('-'),
        type: dto.type,
        valueAmount:
          dto.valueAmount != null ? new Prisma.Decimal(dto.valueAmount) : null,
        valuePercent: dto.valuePercent ?? null,
        currency: dto.currency ?? 'EUR',
        durationDays: this.resolveDurationDays(dto),
        maxRedemptions: dto.maxRedemptions ?? 1,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        assignedUserId: dto.assignedUserId ?? null,
        assignedSalonId: dto.assignedSalonId ?? null,
        createdByUserId,
        metadata: (dto.metadata ?? null) as Prisma.InputJsonValue,
      },
    });

    return {
      id: created.id,
      fullCode,
      displayAccessType: this.resolveDisplayAccessType(dto),
      type: created.type,
      maxRedemptions: created.maxRedemptions,
      expiresAt: created.expiresAt,
      warning:
        'Full code is shown once. It is stored hashed and cannot be recovered later.',
    };
  }

  async generateBatch(createdByUserId: string, dto: CreateVoucherBatchDto) {
    this.validateCreatePayload(dto.voucher);
    const generated: Array<{ id: string; fullCode: string }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (let index = 0; index < dto.count; index += 1) {
        const fullCode = this.buildVoucherCode(dto.voucher);
        const codeHash = this.hashCode(fullCode);
        const created = await tx.voucherCode.create({
          data: {
            codeHash,
            codePrefix: fullCode.split('-').slice(0, 2).join('-'),
            type: dto.voucher.type,
            valueAmount:
              dto.voucher.valueAmount != null
                ? new Prisma.Decimal(dto.voucher.valueAmount)
                : null,
            valuePercent: dto.voucher.valuePercent ?? null,
            currency: dto.voucher.currency ?? 'EUR',
            durationDays: this.resolveDurationDays(dto.voucher),
            maxRedemptions: dto.voucher.maxRedemptions ?? 1,
            validFrom: dto.voucher.validFrom
              ? new Date(dto.voucher.validFrom)
              : null,
            expiresAt: dto.voucher.expiresAt
              ? new Date(dto.voucher.expiresAt)
              : null,
            assignedUserId: dto.voucher.assignedUserId ?? null,
            assignedSalonId: dto.voucher.assignedSalonId ?? null,
            createdByUserId,
            metadata: (dto.voucher.metadata ?? null) as Prisma.InputJsonValue,
          },
        });

        generated.push({ id: created.id, fullCode });
      }
    });

    return {
      count: generated.length,
      items: generated,
      displayAccessType: this.resolveDisplayAccessType(dto.voucher),
      warning:
        'Codes are shown once. Export securely now; only hashes are persisted.',
    };
  }

  async list(filters: ListFilters) {
    const now = new Date();
    const isPartnerDayFilter = filters.type === 'PARTNER_DAY';

    const rows = await this.prisma.voucherCode.findMany({
      where: {
        ...(filters.type && !isPartnerDayFilter
          ? { type: filters.type }
          : {}),
        ...(isPartnerDayFilter
          ? {
              type: VoucherCodeType.PROMO_TRIAL,
              durationDays: 1,
            }
          : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        redemptions: {
          select: { id: true, userId: true, createdAt: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    return rows.map((item) => ({
      id: item.id,
      codePreview: `${item.codePrefix}-****-****`,
      type: item.type,
      status:
        item.status === VoucherCodeStatus.ACTIVE &&
        item.expiresAt != null &&
        item.expiresAt < now
          ? VoucherCodeStatus.EXPIRED
          : item.status,
      valueAmount: item.valueAmount,
      valuePercent: item.valuePercent,
      currency: item.currency,
      durationDays: item.durationDays,
      maxRedemptions: item.maxRedemptions,
      redemptionCount: item.redemptionCount,
      validFrom: item.validFrom,
      expiresAt: item.expiresAt,
      assignedUserId: item.assignedUserId,
      assignedSalonId: item.assignedSalonId,
      createdByUserId: item.createdByUserId,
      createdAt: item.createdAt,
      revokedAt: item.revokedAt,
      redemptions: item.redemptions,
    }));
  }

  async revoke(actorId: string, voucherId: string) {
    const existing = await this.prisma.voucherCode.findUnique({
      where: { id: voucherId },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new NotFoundException(
        buildApiError(404, 'VOUCHER_NOT_FOUND', 'Gutscheincode not found.'),
      );
    }

    if (existing.status === VoucherCodeStatus.REVOKED) {
      return { success: true };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.voucherCode.update({
        where: { id: voucherId },
        data: { status: VoucherCodeStatus.REVOKED, revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'VOUCHER_REVOKED',
          entityType: 'VOUCHER',
          entityId: voucherId,
        },
      });
    });

    return { success: true };
  }

  async redeem(user: AuthenticatedUser, dto: RedeemVoucherDto) {
    const normalizedCode = dto.code.trim().toUpperCase();
    const codeHash = this.hashCode(normalizedCode);

    const voucher = await this.prisma.voucherCode.findFirst({
      where: { codeHash },
    });

    if (!voucher) {
      throw new NotFoundException(
        buildApiError(404, 'VOUCHER_NOT_FOUND', 'Gutscheincode not found.'),
      );
    }

    const now = new Date();
    if (voucher.status !== VoucherCodeStatus.ACTIVE || voucher.revokedAt) {
      throw new ForbiddenException(
        buildApiError(403, 'VOUCHER_REVOKED', 'Gutscheincode is revoked.'),
      );
    }

    if (voucher.validFrom && voucher.validFrom > now) {
      throw new ForbiddenException(
        buildApiError(403, 'VOUCHER_NOT_ACTIVE', 'Gutscheincode is not active yet.'),
      );
    }

    if (voucher.expiresAt && voucher.expiresAt <= now) {
      throw new ForbiddenException(
        buildApiError(403, 'VOUCHER_EXPIRED', 'Gutscheincode has expired.'),
      );
    }

    if (voucher.redemptionCount >= voucher.maxRedemptions) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_LIMIT_REACHED',
          'Gutscheincode usage limit reached.',
        ),
      );
    }

    if (voucher.assignedUserId && voucher.assignedUserId !== user.id) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_ASSIGNED_OTHER_USER',
          'Code is assigned to another user.',
        ),
      );
    }

    const isPartnerVoucher = [
      VoucherCodeType.PARTNER_MONTH,
      VoucherCodeType.PARTNER_YEAR,
      VoucherCodeType.PARTNER_DAY,
      VoucherCodeType.PROMO_TRIAL,
    ].includes(voucher.type as any);

    if (isPartnerVoucher) {
      if (
        user.role !== Role.SALON_OWNER &&
        user.role !== Role.SALON_ADMIN &&
        user.role !== Role.SUPER_ADMIN
      ) {
        throw new ForbiddenException(
          buildApiError(
            403,
            'VOUCHER_ROLE_MISMATCH',
            'Partner code can be redeemed only by partner roles.',
          ),
        );
      }
    }

    if (voucher.type === VoucherCodeType.CLIENT_DISCOUNT || voucher.type === VoucherCodeType.BOOKING_CREDIT) {
      if (user.role !== Role.CUSTOMER) {
        throw new ForbiddenException(
          buildApiError(
            403,
            'VOUCHER_ROLE_MISMATCH',
            'Client code can be redeemed only by customer role.',
          ),
        );
      }
    }

    const salonMemberships = await this.prisma.salonAdmin.findMany({
      where: { userId: user.id, isActive: true },
      select: { salonId: true },
    });
    const memberSalonIds = new Set(salonMemberships.map((item) => item.salonId));

    const targetSalonId = dto.salonId ?? voucher.assignedSalonId ?? null;
    if (voucher.assignedSalonId && targetSalonId !== voucher.assignedSalonId) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_ASSIGNED_OTHER_SALON',
          'Code is assigned to another salon.',
        ),
      );
    }

    if (isPartnerVoucher && user.role !== Role.SUPER_ADMIN) {
      if (!targetSalonId || !memberSalonIds.has(targetSalonId)) {
        throw new ForbiddenException(
          buildApiError(
            403,
            'VOUCHER_SALON_MEMBERSHIP_REQUIRED',
            'Partner code can be redeemed only for your salon.',
          ),
        );
      }
    }

    const existingRedemption = await this.prisma.voucherRedemption.findFirst({
      where: {
        voucherCodeId: voucher.id,
        userId: user.id,
        bookingId: dto.bookingId ?? null,
        status: VoucherRedemptionStatus.APPLIED,
      },
      select: { id: true },
    });

    if (existingRedemption) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_ALREADY_REDEEMED',
          'This code has already been redeemed by this user.',
        ),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const redemption = await tx.voucherRedemption.create({
        data: {
          voucherCodeId: voucher.id,
          userId: user.id,
          salonId: targetSalonId,
          bookingId: dto.bookingId ?? null,
          status: VoucherRedemptionStatus.APPLIED,
          amountApplied: voucher.valueAmount,
          percentApplied: voucher.valuePercent,
          currency: voucher.currency ?? 'EUR',
          details: {
            type: voucher.type,
          },
        },
      });

      await tx.voucherCode.update({
        where: { id: voucher.id },
        data: {
          redemptionCount: { increment: 1 },
        },
      });

      let subscriptionSummary: {
        plan: PartnerSubscriptionPlan;
        startsAt: Date;
        endsAt: Date;
        status: PartnerSubscriptionStatus;
        durationDays: number;
      } | null = null;

      if (isPartnerVoucher && targetSalonId) {
        const plan =
          voucher.type === VoucherCodeType.PARTNER_YEAR
            ? PartnerSubscriptionPlan.PICKME_PARTNER_YEARLY
            : voucher.type === VoucherCodeType.PROMO_TRIAL
              ? PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL
              : PartnerSubscriptionPlan.PICKME_PARTNER_MONTHLY;

        const durationDays =
          voucher.durationDays ??
          (voucher.type === VoucherCodeType.PARTNER_YEAR
            ? 365
            : voucher.type === VoucherCodeType.PARTNER_MONTH
              ? 30
              : 14);

        const latest = await tx.partnerSubscription.findFirst({
          where: { userId: user.id, salonId: targetSalonId },
          orderBy: { endsAt: 'desc' },
        });

        const baseStart = latest && latest.endsAt > now ? latest.endsAt : now;
        const nextEnd = new Date(baseStart.getTime());
        nextEnd.setDate(nextEnd.getDate() + durationDays);

        if (latest) {
          const updated = await tx.partnerSubscription.update({
            where: { id: latest.id },
            data: {
              status: PartnerSubscriptionStatus.ACTIVE,
              source: PartnerSubscriptionSource.VOUCHER,
              plan,
              startsAt: latest.startsAt,
              endsAt: nextEnd,
              voucherRedemptionId: redemption.id,
            },
          });
          subscriptionSummary = {
            plan: updated.plan,
            startsAt: updated.startsAt,
            endsAt: updated.endsAt,
            status: updated.status,
            durationDays,
          };
        } else {
          const created = await tx.partnerSubscription.create({
            data: {
              userId: user.id,
              salonId: targetSalonId,
              plan,
              status:
                voucher.type === VoucherCodeType.PROMO_TRIAL
                  ? PartnerSubscriptionStatus.TRIAL
                  : PartnerSubscriptionStatus.ACTIVE,
              source: PartnerSubscriptionSource.VOUCHER,
              startsAt: now,
              endsAt: nextEnd,
              voucherRedemptionId: redemption.id,
            },
          });
          subscriptionSummary = {
            plan: created.plan,
            startsAt: created.startsAt,
            endsAt: created.endsAt,
            status: created.status,
            durationDays,
          };
        }
      }

      if (
        voucher.type === VoucherCodeType.BOOKING_CREDIT &&
        voucher.valueAmount != null
      ) {
        await tx.bonusCreditLedger.create({
          data: {
            userId: user.id,
            eventType: BonusCreditEventType.CREDIT_GRANTED,
            amount: voucher.valueAmount,
            currency: voucher.currency ?? 'EUR',
            expiresAt: voucher.expiresAt,
            voucherCodeId: voucher.id,
            bookingId: dto.bookingId ?? null,
            note: 'Voucher booking credit granted',
            metadata: (voucher.metadata ?? null) as Prisma.InputJsonValue,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'VOUCHER_REDEEMED',
          entityType: 'VOUCHER',
          entityId: voucher.id,
          payload: {
            type: voucher.type,
            redemptionId: redemption.id,
            salonId: targetSalonId,
          },
        },
      });

      return {
        success: true,
        redemptionId: redemption.id,
        type: voucher.type,
        accessType:
          voucher.type === VoucherCodeType.PROMO_TRIAL &&
          (voucher.durationDays ?? 14) === 1
            ? 'PARTNER_DAY'
            : voucher.type,
        subscription: subscriptionSummary,
        activatedFeatures:
          isPartnerVoucher && targetSalonId
            ? [
                'Редактирование салона',
                'Сотрудники и статусы',
                'Услуги и расписание',
                'Заказы',
                'PickMe Partner badge',
                'Приоритет в каталоге',
              ]
            : [],
      };
    });
  }

  async listRedemptions() {
    return this.prisma.voucherRedemption.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: {
        voucherCode: {
          select: {
            id: true,
            type: true,
            codePrefix: true,
          },
        },
      },
    });
  }

  private validateCreatePayload(dto: CreateVoucherDto) {
    if (
      dto.type === VoucherCodeType.CLIENT_DISCOUNT &&
      dto.valueAmount == null &&
      dto.valuePercent == null
    ) {
      throw new BadRequestException(
        buildApiError(
          400,
          'VOUCHER_VALUE_REQUIRED',
          'Client discount requires amount or percent.',
        ),
      );
    }

    if (
      dto.type === VoucherCodeType.BOOKING_CREDIT &&
      (dto.valueAmount == null || dto.valueAmount <= 0)
    ) {
      throw new BadRequestException(
        buildApiError(
          400,
          'VOUCHER_VALUE_REQUIRED',
          'Booking credit requires positive amount.',
        ),
      );
    }
  }

  private resolveDurationDays(dto: CreateVoucherDto) {
    if (dto.durationDays != null) return dto.durationDays;
    if (dto.type === VoucherCodeType.PARTNER_MONTH) return 30;
    if (dto.type === VoucherCodeType.PARTNER_YEAR) return 365;
    if (dto.type === VoucherCodeType.PROMO_TRIAL) return 14;
    return null;
  }

  private buildVoucherCode(dto: CreateVoucherDto) {
    const block = (size: number) =>
      randomBytes(Math.ceil(size / 2))
        .toString('hex')
        .toUpperCase()
        .slice(0, size);

    const typePrefix: Record<VoucherCodeType, string> = {
      PARTNER_MONTH: 'MONTH',
      PARTNER_YEAR: 'YEAR',
      PARTNER_DAY: 'DAY',
      CLIENT_DISCOUNT: 'DISC',
      BOOKING_CREDIT: 'CREDIT',
      PROMO_TRIAL: 'TRIAL',
    };

    const promoAsDay =
      dto.type === VoucherCodeType.PROMO_TRIAL &&
      this.resolveDurationDays(dto) === 1;

    return `PM-${promoAsDay ? 'DAY' : typePrefix[dto.type]}-${block(4)}-${block(4)}`;
  }

  private resolveDisplayAccessType(dto: CreateVoucherDto) {
    if (
      dto.type === VoucherCodeType.PROMO_TRIAL &&
      this.resolveDurationDays(dto) === 1
    ) {
      return 'PARTNER_DAY';
    }

    return dto.type;
  }

  private hashCode(code: string) {
    const pepper = process.env.VOUCHER_HASH_PEPPER ?? 'pickme-voucher-pepper';
    return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
  }
}
