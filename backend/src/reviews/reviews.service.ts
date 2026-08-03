import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';

interface CreateReviewInput {
  bookingId: string;
  customerProfileId: string;
  masterId: string;
  salonId?: string;
  rating: number;
  text?: string;
}

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

  async create(input: CreateReviewInput) {
    if (!input.bookingId || !input.masterId || !input.customerProfileId) {
      throw new BadRequestException(
        buildApiError(
          400,
          'VALIDATION_ERROR',
          'Недостаточно данных для отзыва.',
        ),
      );
    }

    const review = await this.prisma.review.create({
      data: {
        bookingId: input.bookingId,
        customerProfileId: input.customerProfileId,
        masterId: input.masterId,
        salonId: input.salonId ?? null,
        rating: input.rating,
        text: input.text ?? null,
      },
    });

    await this.recalculateAggregates(review.masterId, review.salonId);
    return review;
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
