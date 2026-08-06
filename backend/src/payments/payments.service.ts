import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingPaymentProvider,
  BookingPaymentStatus,
  BonusCreditEventType,
  Prisma,
  Role,
  VoucherCodeStatus,
  VoucherCodeType,
  VoucherRedemptionStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { AuthenticatedUser } from '../auth/auth.types';
import { buildApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import {
  BookingPaymentMethodInput,
  CreateBookingPaymentIntentDto,
} from './dto/create-booking-payment-intent.dto';
import { DemoPaymentWebhookDto, DemoWebhookStatus } from './dto/demo-payment-webhook.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBookingPaymentIntent(
    user: AuthenticatedUser,
    bookingId: string,
    dto: CreateBookingPaymentIntentDto,
  ) {
    if (user.role !== Role.CUSTOMER) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'Only customer can pay for booking.'),
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          include: {
            user: true,
          },
        },
        service: true,
        salon: true,
        homeVisitDetails: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(
        buildApiError(404, 'BOOKING_NOT_FOUND', 'Booking not found.'),
      );
    }

    if (booking.customer.userId !== user.id) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'You can pay only your own booking.'),
      );
    }

    if (!booking.salonId || !booking.salon) {
      throw new BadRequestException(
        buildApiError(
          400,
          'BOOKING_PARTNER_REQUIRED',
          'Salon booking is required for this payment flow.',
        ),
      );
    }

    const subtotal = new Prisma.Decimal(booking.totalPrice);
    const travelFee = new Prisma.Decimal(0);
    const platformFee = new Prisma.Decimal(0);
    const currency = booking.currency;

    return this.prisma.$transaction(async (tx) => {
      const voucherResult = dto.voucherCode
        ? await this.resolveVoucherForBooking(tx, {
            code: dto.voucherCode,
            userId: user.id,
            bookingId,
            salonId: booking.salonId as string,
            serviceId: booking.serviceId,
            startsAt: booking.startsAt,
            subtotal,
            currency,
          })
        : {
            discount: new Prisma.Decimal(0),
            voucherRedemptionId: null as string | null,
            bookingCreditUsed: new Prisma.Decimal(0),
          };

      const discount = voucherResult.discount;
      const maxDiscount = subtotal.add(travelFee);
      const normalizedDiscount = discount.greaterThan(maxDiscount)
        ? maxDiscount
        : discount;

      const total = subtotal.add(travelFee).sub(normalizedDiscount);

      const provider =
        dto.paymentMethod === BookingPaymentMethodInput.CARD
          ? BookingPaymentProvider.STRIPE
          : dto.paymentMethod === BookingPaymentMethodInput.IN_SALON
            ? BookingPaymentProvider.MANUAL_IN_SALON
            : BookingPaymentProvider.DEMO;

      const providerPaymentIntentId =
        provider === BookingPaymentProvider.STRIPE ||
        provider === BookingPaymentProvider.DEMO
          ? this.buildPaymentIntentId(provider)
          : null;

      const status =
        provider === BookingPaymentProvider.MANUAL_IN_SALON
          ? BookingPaymentStatus.PENDING
          : BookingPaymentStatus.REQUIRES_ACTION;

      const payment = await tx.bookingPayment.create({
        data: {
          bookingId,
          customerId: user.id,
          partnerId: booking.salonId as string,
          provider,
          providerPaymentIntentId,
          subtotal,
          discount: normalizedDiscount,
          travelFee,
          platformFee,
          total,
          currency,
          status,
          voucherRedemptionId: voucherResult.voucherRedemptionId,
        },
      });

      return {
        id: payment.id,
        provider: payment.provider,
        providerPaymentIntentId: payment.providerPaymentIntentId,
        status: payment.status,
        pricing: {
          subtotal: payment.subtotal,
          discount: payment.discount,
          travelFee: payment.travelFee,
          total: payment.total,
          currency: payment.currency,
        },
        note:
          provider === BookingPaymentProvider.MANUAL_IN_SALON
            ? 'Payment is marked as pending until in-salon collection.'
            : 'Payment is not PAID yet. Webhook confirmation is required.',
      };
    });
  }

  async handleDemoWebhook(dto: DemoPaymentWebhookDto) {
    const payment = await this.prisma.bookingPayment.findFirst({
      where: { providerPaymentIntentId: dto.providerPaymentIntentId },
      select: { id: true, status: true },
    });

    if (!payment) {
      throw new NotFoundException(
        buildApiError(404, 'PAYMENT_NOT_FOUND', 'Payment not found.'),
      );
    }

    const mappedStatus =
      dto.status === DemoWebhookStatus.PAID
        ? BookingPaymentStatus.PAID
        : dto.status === DemoWebhookStatus.FAILED
          ? BookingPaymentStatus.FAILED
          : BookingPaymentStatus.CANCELLED;

    const updated = await this.prisma.bookingPayment.update({
      where: { id: payment.id },
      data: {
        status: mappedStatus,
        paidAt: mappedStatus === BookingPaymentStatus.PAID ? new Date() : null,
      },
    });

    return { id: updated.id, status: updated.status, paidAt: updated.paidAt };
  }

  private async resolveVoucherForBooking(
    tx: Prisma.TransactionClient,
    params: {
      code: string;
      userId: string;
      bookingId: string;
      salonId: string;
      serviceId: string;
      startsAt: Date;
      subtotal: Prisma.Decimal;
      currency: string;
    },
  ) {
    const normalizedCode = params.code.trim().toUpperCase();
    const codeHash = this.hashCode(normalizedCode);

    const voucher = await tx.voucherCode.findFirst({ where: { codeHash } });
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

    if (
      voucher.type !== VoucherCodeType.CLIENT_DISCOUNT &&
      voucher.type !== VoucherCodeType.BOOKING_CREDIT
    ) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_TYPE_NOT_ALLOWED',
          'Voucher type is not allowed for booking payment.',
        ),
      );
    }

    if (voucher.assignedUserId && voucher.assignedUserId !== params.userId) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_ASSIGNED_OTHER_USER',
          'Code is assigned to another user.',
        ),
      );
    }

    if (voucher.assignedSalonId && voucher.assignedSalonId !== params.salonId) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_ASSIGNED_OTHER_SALON',
          'Code is assigned to another salon.',
        ),
      );
    }

    if (voucher.metadata) {
      this.assertVoucherScope(voucher.metadata, params);
    }

    const existingRedemption = await tx.voucherRedemption.findFirst({
      where: {
        voucherCodeId: voucher.id,
        userId: params.userId,
        bookingId: params.bookingId,
        status: VoucherRedemptionStatus.APPLIED,
      },
      select: { id: true },
    });

    if (existingRedemption) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_ALREADY_REDEEMED',
          'Voucher already used for this booking by this user.',
        ),
      );
    }

    let discount = new Prisma.Decimal(0);
    let bookingCreditUsed = new Prisma.Decimal(0);

    if (voucher.type === VoucherCodeType.CLIENT_DISCOUNT) {
      const amountDiscount = voucher.valueAmount ?? new Prisma.Decimal(0);
      const percentDiscount =
        voucher.valuePercent != null
          ? params.subtotal.mul(voucher.valuePercent).div(100)
          : new Prisma.Decimal(0);
      discount = amountDiscount.greaterThan(percentDiscount)
        ? amountDiscount
        : percentDiscount;
    }

    if (voucher.type === VoucherCodeType.BOOKING_CREDIT) {
      const balance = await this.getBonusBalance(tx, params.userId, params.currency);
      bookingCreditUsed = balance.greaterThan(params.subtotal)
        ? params.subtotal
        : balance;
      discount = bookingCreditUsed;
    }

    const redemption = await tx.voucherRedemption.create({
      data: {
        voucherCodeId: voucher.id,
        userId: params.userId,
        salonId: params.salonId,
        bookingId: params.bookingId,
        status: VoucherRedemptionStatus.APPLIED,
        amountApplied: voucher.valueAmount,
        percentApplied: voucher.valuePercent,
        currency: voucher.currency ?? params.currency,
        details: {
          bookingId: params.bookingId,
          serviceId: params.serviceId,
        },
      },
    });

    await tx.voucherCode.update({
      where: { id: voucher.id },
      data: { redemptionCount: { increment: 1 } },
    });

    if (voucher.type === VoucherCodeType.BOOKING_CREDIT) {
      if (bookingCreditUsed.greaterThan(0)) {
        await tx.bonusCreditLedger.create({
          data: {
            userId: params.userId,
            eventType: BonusCreditEventType.CREDIT_USED,
            amount: bookingCreditUsed.mul(-1),
            currency: params.currency,
            voucherCodeId: voucher.id,
            bookingId: params.bookingId,
            note: 'Booking payment credit usage',
          },
        });
      }
    }

    return {
      discount,
      voucherRedemptionId: redemption.id,
      bookingCreditUsed,
    };
  }

  private assertVoucherScope(
    metadata: Prisma.JsonValue,
    params: { salonId: string; serviceId: string; startsAt: Date },
  ) {
    if (typeof metadata !== 'object' || metadata == null || Array.isArray(metadata)) {
      return;
    }

    const rawScope = (metadata as Record<string, unknown>).bookingScope;
    if (typeof rawScope !== 'object' || rawScope == null || Array.isArray(rawScope)) {
      return;
    }

    const scope = rawScope as Record<string, unknown>;
    const salonIds = Array.isArray(scope.salonIds) ? scope.salonIds : [];
    const serviceIds = Array.isArray(scope.serviceIds) ? scope.serviceIds : [];

    if (
      salonIds.length > 0 &&
      !salonIds.some((item) => typeof item === 'string' && item === params.salonId)
    ) {
      throw new ForbiddenException(
        buildApiError(403, 'VOUCHER_SCOPE_MISMATCH', 'Voucher is not valid for this salon.'),
      );
    }

    if (
      serviceIds.length > 0 &&
      !serviceIds.some((item) => typeof item === 'string' && item === params.serviceId)
    ) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'VOUCHER_SCOPE_MISMATCH',
          'Voucher is not valid for this service.',
        ),
      );
    }

    if (typeof scope.validOnOrAfter === 'string') {
      const startsAt = new Date(scope.validOnOrAfter);
      if (!Number.isNaN(startsAt.getTime()) && params.startsAt < startsAt) {
        throw new ForbiddenException(
          buildApiError(
            403,
            'VOUCHER_SCOPE_MISMATCH',
            'Voucher is not valid for selected date.',
          ),
        );
      }
    }
  }

  private async getBonusBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    currency: string,
  ) {
    const now = new Date();
    const rows = await tx.bonusCreditLedger.findMany({
      where: {
        userId,
        currency,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { amount: true },
    });

    return rows.reduce(
      (sum, row) => sum.add(row.amount),
      new Prisma.Decimal(0),
    );
  }

  private hashCode(code: string) {
    const pepper = process.env.VOUCHER_HASH_PEPPER ?? 'pickme-voucher-pepper';
    return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
  }

  private buildPaymentIntentId(provider: BookingPaymentProvider) {
    const suffix = randomBytes(8).toString('hex');
    return provider === BookingPaymentProvider.STRIPE
      ? `pi_demo_${suffix}`
      : `pi_local_${suffix}`;
  }
}
