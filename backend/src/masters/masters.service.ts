import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { UpdateMasterDto } from './dto/update-master.dto';

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  private productionVisibilityWhere(): Prisma.MasterProfileWhereInput {
    if (process.env.NODE_ENV !== 'production') return {};
    return {
      NOT: [
        {
          user: {
            email: {
              startsWith: 'demo.zuhause.',
              mode: 'insensitive',
            },
          },
        },
        {
          biography: {
            contains: 'DEMO_ZUHAUSE_PROFILE',
            mode: 'insensitive',
          },
        },
      ],
    };
  }

  async list(params: {
    search?: string;
    salonId?: string;
    serviceId?: string;
    specialization?: string;
    minimumRating?: number;
    acceptsHomeVisits?: boolean;
    independent?: boolean;
    verifiedOnly?: boolean;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = this.normalizeListInt(params.limit, 20, 1, 50);
    const offset = this.normalizeListInt(params.offset, 0, 0, Number.MAX_SAFE_INTEGER);

    const salon = params.salonId
      ? await this.prisma.salon.findFirst({
          where: { id: params.salonId, isActive: true },
          select: { id: true },
        })
      : null;

    if (params.salonId && !salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    const service = params.serviceId
      ? await this.prisma.service.findFirst({
          where: { id: params.serviceId, isActive: true },
          select: { id: true, salonId: true },
        })
      : null;

    if (params.serviceId && !service) {
      throw new NotFoundException(
        buildApiError(404, 'SERVICE_NOT_FOUND', 'Услуга не найдена.'),
      );
    }

    if (params.salonId && params.serviceId && service?.salonId !== params.salonId) {
      throw new NotFoundException(
        buildApiError(404, 'SERVICE_NOT_FOUND', 'Услуга не найдена.'),
      );
    }

    const where: Prisma.MasterProfileWhereInput = {
      ...this.productionVisibilityWhere(),
      ...(params.search
        ? {
            OR: [
              { displayName: { contains: params.search, mode: 'insensitive' } },
              {
                specialization: {
                  contains: params.search,
                  mode: 'insensitive',
                },
              },
              { biography: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.salonId
        ? { salonLinks: { some: { salonId: params.salonId, isActive: true } } }
        : {}),
      ...(params.serviceId
        ? {
            services: { some: { serviceId: params.serviceId, isActive: true } },
          }
        : {}),
      ...(params.specialization
        ? {
            specialization: {
              contains: params.specialization,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(params.minimumRating
        ? { ratingAverage: { gte: params.minimumRating } }
        : {}),
      ...(params.acceptsHomeVisits ? { acceptsHomeVisits: true } : {}),
      ...(params.independent ? { isIndependent: true } : {}),
      ...(params.verifiedOnly ? { isVerified: true } : {}),
    };

    const orderBy = this.resolveOrder(params.sort);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.masterProfile.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, email: true, isActive: true } },
          salonLinks: { where: { isActive: true }, include: { salon: true } },
          services: { where: { isActive: true }, include: { service: true } },
          reviews: { select: { rating: true } },
        },
      }),
      this.prisma.masterProfile.count({ where }),
    ]);

    return {
      items: items.map((master) => this.toPublicMasterSummary(master)),
      total,
    };
  }

  async getById(id: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        salonLinks: { where: { isActive: true }, include: { salon: true } },
        services: { where: { isActive: true }, include: { service: true } },
        schedules: {
          include: { breaks: true },
          orderBy: { dayOfWeek: 'asc' },
        },
        bookings: {
          where: {
            status: {
              in: [
                BookingStatus.pending,
                BookingStatus.confirmed,
                BookingStatus.inProgress,
              ],
            },
            startsAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          },
          select: {
            startsAt: true,
            endsAt: true,
            status: true,
            isHomeVisit: true,
          },
          orderBy: { startsAt: 'asc' },
        },
        portfolioItems: { orderBy: { sortOrder: 'asc' } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { customer: true },
        },
      },
    });

    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Мастер не найден.'),
      );
    }

    return {
      ...master,
      salon: master.salonLinks[0]?.salon ?? null,
    };
  }

  async getMe(userId: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
      include: {
        salonLinks: { where: { isActive: true }, include: { salon: true } },
        services: { where: { isActive: true }, include: { service: true } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
        portfolioItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    return { ...master, salon: master.salonLinks[0]?.salon ?? null };
  }

  async updateMe(userId: string, input: UpdateMasterDto) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    return this.prisma.masterProfile.update({
      where: { userId },
      data: {
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.biography !== undefined
          ? { biography: input.biography }
          : {}),
        ...(input.specialization !== undefined
          ? { specialization: input.specialization }
          : {}),
        ...(input.experienceYears !== undefined
          ? { experienceYears: input.experienceYears }
          : {}),
        ...(input.acceptsHomeVisits !== undefined
          ? { acceptsHomeVisits: input.acceptsHomeVisits }
          : {}),
        ...(input.avatarUrl !== undefined
          ? { avatarUrl: input.avatarUrl }
          : {}),
        ...(input.isVerified !== undefined
          ? { isVerified: input.isVerified }
          : {}),
      },
    });
  }

  async getBySalon(salonId: string) {
    const masters = await this.prisma.salonMaster.findMany({
      where: { salonId, isActive: true },
      include: {
        master: {
          include: {
            user: { select: { email: true } },
            services: { where: { isActive: true }, include: { service: true } },
            salonLinks: { where: { isActive: true }, include: { salon: true } },
          },
        },
      },
    });

    return masters.map((link) => this.toPublicMasterSummary(link.master));
  }

  private toPublicMasterSummary(master: any) {
    const email = String(master.user?.email ?? '').toLowerCase();
    const biography = String(master.biography ?? '').toUpperCase();
    const isDemoZuhause =
      email.startsWith('demo.zuhause.') ||
      biography.includes('DEMO_ZUHAUSE_PROFILE');

    return {
      id: master.id,
      displayName: master.displayName,
      currentStatus: master.currentStatus,
      availableAt: master.availableAt?.toISOString?.() ?? null,
      minutesUntilAvailable: master.minutesUntilAvailable ?? null,
      specialization: master.specialization,
      biography: master.biography,
      experienceYears: master.experienceYears,
      ratingAverage: master.ratingAverage,
      reviewCount: master.reviewCount,
      acceptsHomeVisits: master.acceptsHomeVisits,
      photoUrl: master.avatarUrl ?? null,
      services: Array.isArray(master.services)
        ? master.services
            .map((link: any) => ({
              id: link.service?.id,
              name: link.service?.name,
            }))
            .filter((item: { id?: string; name?: string }) => Boolean(item.id && item.name))
        : [],
      salon: master.salonLinks?.[0]?.salon
        ? {
            id: master.salonLinks[0].salon.id,
            name: master.salonLinks[0].salon.name,
          }
        : null,
      profileFlags: {
        isDemoProfile: isDemoZuhause,
        isIndependentProvider: Boolean(master.isIndependent),
        profileKind: isDemoZuhause ? 'DEMO_ZUHAUSE' : null,
        labels: isDemoZuhause
          ? ['Demo-Profil', 'Selbstständiger Anbieter']
          : master.isIndependent
            ? ['Selbstständiger Anbieter']
            : [],
      },
    };
  }

  private normalizeListInt(
    value: number | string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }

  private resolveOrder(sort?: string) {
    switch (sort) {
      case 'rating':
        return { ratingAverage: 'desc' as const, reviewCount: 'desc' as const };
      case 'experience':
        return { experienceYears: 'desc' as const };
      case 'name':
        return { displayName: 'asc' as const };
      case 'newest':
      default:
        return { createdAt: 'desc' as const };
    }
  }
}
