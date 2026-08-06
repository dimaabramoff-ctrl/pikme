import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PartnerSubscriptionPlan, PartnerSubscriptionSource, PartnerSubscriptionStatus } from '@prisma/client';
import { buildApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionCheckoutDto } from './dto/subscription-checkout.dto';

export interface PlanOption {
  id: string;
  durationMonths: number;
  label: string;
  /** presentation/test prices — not production pricing */
  priceEur: number;
  planEnum: PartnerSubscriptionPlan;
  isTestPrice: boolean;
}

// Presentation-only price table. These are demo values, clearly labelled as test prices.
const PLAN_CATALOG: PlanOption[] = [
  { id: 'monthly', durationMonths: 1, label: '1 Monat', priceEur: 29, planEnum: PartnerSubscriptionPlan.PICKME_PARTNER_MONTHLY, isTestPrice: true },
  { id: 'quarterly', durationMonths: 3, label: '3 Monate', priceEur: 79, planEnum: PartnerSubscriptionPlan.PICKME_PARTNER_QUARTERLY, isTestPrice: true },
  { id: 'semiannual', durationMonths: 6, label: '6 Monate', priceEur: 149, planEnum: PartnerSubscriptionPlan.PICKME_PARTNER_SEMIANNUAL, isTestPrice: true },
  { id: 'yearly', durationMonths: 12, label: '12 Monate', priceEur: 269, planEnum: PartnerSubscriptionPlan.PICKME_PARTNER_YEARLY, isTestPrice: true },
  { id: 'biennial', durationMonths: 24, label: '24 Monate', priceEur: 479, planEnum: PartnerSubscriptionPlan.PICKME_PARTNER_BIENNIAL, isTestPrice: true },
];

function durationMonthsToPlan(durationMonths: number): PlanOption | undefined {
  return PLAN_CATALOG.find((p) => p.durationMonths === durationMonths);
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getCatalog(): PlanOption[] {
    return PLAN_CATALOG;
  }

  async getStatus(userId: string, salonId: string) {
    const sub = await this.prisma.partnerSubscription.findFirst({
      where: { userId, salonId, status: { in: [PartnerSubscriptionStatus.TRIAL, PartnerSubscriptionStatus.ACTIVE] } },
      orderBy: { endsAt: 'desc' },
    });

    const trialUsed = await this.prisma.partnerSubscription.findFirst({
      where: { userId, salonId, plan: PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL },
      select: { id: true },
    });

    return {
      salonId,
      active: !!sub,
      plan: sub?.plan ?? null,
      status: sub?.status ?? null,
      startsAt: sub?.startsAt?.toISOString() ?? null,
      endsAt: sub?.endsAt?.toISOString() ?? null,
      remainingDays: sub ? Math.max(0, Math.ceil((sub.endsAt.getTime() - Date.now()) / 86_400_000)) : 0,
      trialUsed: !!trialUsed,
    };
  }

  async checkout(userId: string, dto: SubscriptionCheckoutDto) {
    const presentationMode = this.configService.get<string>('PRESENTATION_MODE') === 'true';

    const plan = durationMonthsToPlan(dto.durationMonths);
    if (!plan) {
      throw new BadRequestException(buildApiError(400, 'INVALID_PLAN', `Kein Plan für ${dto.durationMonths} Monate.`));
    }

    // Verify salon membership
    const membership = await this.prisma.salonAdmin.findUnique({
      where: { userId_salonId: { userId, salonId: dto.salonId } },
      select: { isActive: true },
    });
    if (!membership?.isActive) {
      throw new ForbiddenException(buildApiError(403, 'FORBIDDEN', 'Sie sind kein aktiver Inhaber dieses Salons.'));
    }

    if (!presentationMode) {
      throw new BadRequestException(buildApiError(400, 'PAYMENT_NOT_CONFIGURED', 'Online-Zahlung ist noch nicht eingerichtet.'));
    }

    // PRESENTATION_MODE=true: create TEST_SUCCEEDED payment and extend subscription
    const now = new Date();
    const payment = await this.prisma.partnerPayment.create({
      data: {
        userId,
        salonId: dto.salonId,
        planId: plan.id,
        durationMonths: plan.durationMonths,
        amount: plan.priceEur,
        currency: 'EUR',
        status: 'TEST_SUCCEEDED',
        isTest: true,
        confirmedAt: now,
      },
    });

    // Extend from max(now, currentEndAt)
    const existingSub = await this.prisma.partnerSubscription.findFirst({
      where: { userId, salonId: dto.salonId, status: { in: [PartnerSubscriptionStatus.TRIAL, PartnerSubscriptionStatus.ACTIVE] } },
      orderBy: { endsAt: 'desc' },
    });

    const baseDate = existingSub && existingSub.endsAt > now ? existingSub.endsAt : now;
    const newEndAt = new Date(baseDate);
    newEndAt.setMonth(newEndAt.getMonth() + plan.durationMonths);

    let subscriptionId: string;
    if (existingSub) {
      const updated = await this.prisma.partnerSubscription.update({
        where: { id: existingSub.id },
        data: { endsAt: newEndAt, status: PartnerSubscriptionStatus.ACTIVE, source: PartnerSubscriptionSource.PAYMENT },
      });
      subscriptionId = updated.id;
    } else {
      const created = await this.prisma.partnerSubscription.create({
        data: {
          userId,
          salonId: dto.salonId,
          plan: plan.planEnum,
          status: PartnerSubscriptionStatus.ACTIVE,
          source: PartnerSubscriptionSource.PAYMENT,
          startsAt: now,
          endsAt: newEndAt,
        },
      });
      subscriptionId = created.id;
    }

    await this.prisma.partnerPayment.update({ where: { id: payment.id }, data: { subscriptionId } });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'PARTNER_SUBSCRIPTION_EXTENDED',
        entityType: 'PartnerSubscription',
        entityId: subscriptionId,
        payload: {
          salonId: dto.salonId,
          planId: plan.id,
          durationMonths: plan.durationMonths,
          amount: plan.priceEur,
          currency: 'EUR',
          isTest: true,
          paymentId: payment.id,
          newEndAt: newEndAt.toISOString(),
        },
      },
    });

    return {
      paymentId: payment.id,
      subscriptionId,
      status: 'TEST_SUCCEEDED',
      isTest: true,
      planId: plan.id,
      durationMonths: plan.durationMonths,
      amount: plan.priceEur,
      currency: 'EUR',
      newEndAt: newEndAt.toISOString(),
      previousEndAt: existingSub?.endsAt?.toISOString() ?? null,
    };
  }
}
