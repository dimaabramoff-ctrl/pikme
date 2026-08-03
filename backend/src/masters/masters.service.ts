import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { UpdateMasterDto } from './dto/update-master.dto';

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

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
    const where: Prisma.MasterProfileWhereInput = {
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
        take: params.limit ?? 20,
        skip: params.offset ?? 0,
        include: {
          user: { select: { id: true, email: true } },
          salonLinks: { where: { isActive: true }, include: { salon: true } },
          services: { where: { isActive: true }, include: { service: true } },
          reviews: { select: { rating: true } },
        },
      }),
      this.prisma.masterProfile.count({ where }),
    ]);

    return {
      items: items.map((master) => ({
        ...master,
        salon: master.salonLinks[0]?.salon ?? null,
      })),
      total,
    };
  }

  async getById(id: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        salonLinks: { where: { isActive: true }, include: { salon: true } },
        services: { where: { isActive: true }, include: { service: true } },
        schedules: {
          where: { isDayOff: false },
          orderBy: { dayOfWeek: 'asc' },
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
    return this.prisma.salonMaster.findMany({
      where: { salonId, isActive: true },
      include: { master: true },
    });
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
