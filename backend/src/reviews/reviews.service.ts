import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    masterId?: string;
    salonId?: string;
    rating?: number;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.ReviewWhereInput = {
      ...(params.masterId ? { masterId: params.masterId } : {}),
      ...(params.salonId ? { salonId: params.salonId } : {}),
      ...(params.rating ? { rating: params.rating } : {}),
    };

    const orderBy = this.resolveOrder(params.sort);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy,
        take: params.limit ?? 10,
        skip: params.offset ?? 0,
        include: { customer: true },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { items, total };
  }

  async createByBooking(input: {
    userId: string;
    role: Role;
    bookingId: string;
    rating: number;
    text?: string;
  }) {
    if (input.role !== Role.CUSTOMER) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'REVIEW_ONLY_CUSTOMER',
          'Только клиент может оставить отзыв о визите.',
        ),
      );
    }

    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException(
        buildApiError(400, 'REVIEW_INVALID_RATING', 'Оценка должна быть от 1 до 5.'),
      );
    }

    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true },
    });

    if (!customer) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'Профиль клиента не найден.'),
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        customerProfileId: true,
        masterId: true,
        salonId: true,
        status: true,
        master: {
          select: { userId: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        buildApiError(404, 'BOOKING_NOT_FOUND', 'Запись не найдена.'),
      );
    }

    if (booking.customerProfileId !== customer.id) {
      throw new ForbiddenException(
        buildApiError(403, 'REVIEW_FOREIGN_BOOKING', 'Нельзя оставить отзыв по чужой записи.'),
      );
    }

    if (booking.status !== BookingStatus.completed) {
      throw new BadRequestException(
        buildApiError(400, 'REVIEW_BOOKING_NOT_COMPLETED', 'Отзыв доступен только после завершения визита.'),
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId: booking.id },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        buildApiError(400, 'REVIEW_ALREADY_EXISTS', 'По этой записи отзыв уже оставлен.'),
      );
    }

    if (booking.salonId) {
      const [ownerLink, staffLink] = await this.prisma.$transaction([
        this.prisma.salonAdmin.findFirst({
          where: {
            salonId: booking.salonId,
            userId: input.userId,
            isActive: true,
          },
          select: { id: true },
        }),
        this.prisma.salonMaster.findFirst({
          where: {
            salonId: booking.salonId,
            isActive: true,
            master: { userId: input.userId },
          },
          select: { id: true },
        }),
      ]);

      if (ownerLink || staffLink) {
        throw new ForbiddenException(
          buildApiError(403, 'REVIEW_SELF_SALON_FORBIDDEN', 'Владелец или сотрудник не может оценивать свой салон.'),
        );
      }
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        customerProfileId: customer.id,
        masterId: booking.masterId,
        salonId: booking.salonId ?? null,
        rating: input.rating,
        text: input.text?.trim() || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.userId,
        action: 'REVIEW_CREATED',
        entityType: 'Review',
        entityId: review.id,
        payload: {
          bookingId: booking.id,
          salonId: booking.salonId,
          rating: review.rating,
          verifiedVisit: true,
        },
      },
    });

    if (booking.master?.userId) {
      await this.prisma.notification.createMany({
        data: [{
          userId: booking.master.userId,
          type: 'NEW_REVIEW',
          title: 'Neuer verifizierter PickMe-Review',
          message: 'Zu Ihrem Termin wurde ein bestätigter Review abgegeben.',
          payload: { reviewId: review.id, bookingId: booking.id, rating: review.rating },
        }],
      });
    }

    await this.recalculateAggregates(review.masterId, review.salonId);
    return review;
  }

  async moderateReview(adminId: string, reviewId: string, status: 'APPROVED' | 'HIDDEN', reason?: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, bookingId: true, rating: true, text: true, salonId: true, masterId: true },
    });

    if (!review) {
      throw new NotFoundException(buildApiError(404, 'REVIEW_NOT_FOUND', 'Отзыв не найден.'));
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'REVIEW_MODERATION_STATUS_CHANGED',
        entityType: 'Review',
        entityId: review.id,
        reason,
        before: { moderationStatus: 'APPROVED' },
        after: { moderationStatus: status },
        payload: {
          bookingId: review.bookingId,
          salonId: review.salonId,
          masterId: review.masterId,
        },
      },
    });

    return {
      id: review.id,
      moderationStatus: status,
      reason: reason ?? null,
    };
  }

  async deleteByAdmin(adminId: string, reviewId: string, reason?: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, masterId: true, salonId: true, rating: true, text: true, bookingId: true },
    });

    if (!review) {
      throw new NotFoundException(buildApiError(404, 'REVIEW_NOT_FOUND', 'Отзыв не найден.'));
    }

    await this.prisma.review.delete({ where: { id: reviewId } });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'REVIEW_DELETED_BY_ADMIN',
        entityType: 'Review',
        entityId: review.id,
        reason,
        before: {
          rating: review.rating,
          text: review.text,
          bookingId: review.bookingId,
        },
      },
    });

    await this.recalculateAggregates(review.masterId, review.salonId);

    return { success: true };
  }

  async recalculateAggregates(masterId: string, salonId?: string | null) {
    const [masterReviews, salonReviews] = await this.prisma.$transaction(
      async (tx) => {
        const masterReviews = await tx.review.aggregate({
          where: { masterId },
          _avg: { rating: true },
          _count: { rating: true },
        });
        const salonReviews = salonId
          ? await tx.review.aggregate({
              where: { salonId },
              _avg: { rating: true },
              _count: { rating: true },
            })
          : null;

        return [masterReviews, salonReviews] as const;
      },
    );

    await this.prisma.masterProfile.update({
      where: { id: masterId },
      data: {
        ratingAverage: Number(masterReviews._avg.rating ?? 0),
        reviewCount: masterReviews._count.rating ?? 0,
      },
    });

    if (salonId) {
      await this.prisma.salon.update({
        where: { id: salonId },
        data: {
          ratingAverage: Number(salonReviews?._avg.rating ?? 0),
          ratingCount: salonReviews?._count.rating ?? 0,
        },
      });
    }
  }

  private resolveOrder(sort?: string) {
    switch (sort) {
      case 'highest':
        return { rating: 'desc' as const };
      case 'lowest':
        return { rating: 'asc' as const };
      case 'newest':
      default:
        return { createdAt: 'desc' as const };
    }
  }
}
