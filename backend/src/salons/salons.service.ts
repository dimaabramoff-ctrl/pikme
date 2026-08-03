import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { CreateSalonDto } from './dto/create-salon.dto';

@Injectable()
export class SalonsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    search?: string;
    city?: string;
    postalCode?: string;
    serviceId?: string;
    minimumRating?: number;
    homeVisit?: boolean;
    verifiedOnly?: boolean;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.SalonWhereInput = {
      isActive: true,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { city: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.city
        ? { city: { contains: params.city, mode: 'insensitive' } }
        : {}),
      ...(params.postalCode
        ? { postalCode: { contains: params.postalCode, mode: 'insensitive' } }
        : {}),
      ...(params.verifiedOnly ? { isVerified: true } : {}),
      ...(params.homeVisit ? { homeVisitEnabled: true } : {}),
      ...(params.minimumRating
        ? { ratingAverage: { gte: params.minimumRating } }
        : {}),
      ...(params.serviceId
        ? {
            services: {
              some: {
                id: params.serviceId,
              },
            },
          }
        : {}),
    };

    const orderBy = this.resolveOrder(params.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.salon.findMany({
        where,
        orderBy,
        take: params.limit ?? 20,
        skip: params.offset ?? 0,
        include: {
          photos: { orderBy: { sortOrder: 'asc' } },
          services: { where: { isActive: true }, take: 3 },
          reviews: { select: { rating: true } },
        },
      }),
      this.prisma.salon.count({ where }),
    ]);

    return {
      items: items.map((salon) => ({
        ...salon,
        reviewCount: salon.reviews.length,
        minPrice:
          salon.services.length > 0
            ? Math.min(
                ...salon.services.map((service) => Number(service.basePrice)),
              )
            : null,
      })),
      total,
    };
  }

  async getById(id: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { id, isActive: true },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        services: { where: { isActive: true } },
        masters: { where: { isActive: true }, include: { master: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { customer: true },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    return {
      ...salon,
      masterCount: salon.masters.length,
      minPrice:
        salon.services.length > 0
          ? Math.min(
              ...salon.services.map((service) => Number(service.basePrice)),
            )
          : null,
      reviewCount: salon.reviews.length,
    };
  }

  async getBySlug(slug: string) {
    const salon = await this.prisma.salon.findFirst({
      where: { slug, isActive: true },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        services: { where: { isActive: true } },
        masters: { where: { isActive: true }, include: { master: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { customer: true },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    return {
      ...salon,
      masterCount: salon.masters.length,
      minPrice:
        salon.services.length > 0
          ? Math.min(
              ...salon.services.map((service) => Number(service.basePrice)),
            )
          : null,
      reviewCount: salon.reviews.length,
    };
  }

  async create(input: CreateSalonDto, user: { id: string; role: Role }) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Недостаточно прав для создания салона.',
        ),
      );
    }

    const slug = this.slugify(input.name || 'salon');
    const salon = await this.prisma.salon.create({
      data: {
        slug,
        name: input.name,
        description: input.description,
        phone: input.phone,
        email: input.email,
        website: input.website,
        addressLine: input.addressLine,
        addressLine1: input.addressLine,
        city: input.city,
        country: input.country ?? 'Germany',
        countryCode: input.countryCode ?? 'DE',
        postalCode: input.postalCode,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        openingStatus: input.openingStatus ?? 'ACTIVE',
        isVerified: input.isVerified ?? true,
        homeVisitEnabled: input.homeVisitEnabled ?? false,
      },
    });

    if (user.role === Role.SUPER_ADMIN) {
      await this.prisma.salonAdmin.create({
        data: {
          userId: user.id,
          salonId: salon.id,
          role: 'OWNER',
        },
      });
    }

    return salon;
  }

  async update(
    id: string,
    input: Partial<CreateSalonDto>,
    user: { id: string; role: Role },
  ) {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    const isOwner = await this.prisma.salonAdmin.findFirst({
      where: { userId: user.id, salonId: id, isActive: true },
    });

    if (user.role !== Role.SUPER_ADMIN && !isOwner) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'У вас нет прав на изменение салона.'),
      );
    }

    return this.prisma.salon.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.addressLine !== undefined
          ? { addressLine: input.addressLine, addressLine1: input.addressLine }
          : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.countryCode !== undefined
          ? { countryCode: input.countryCode }
          : {}),
        ...(input.postalCode !== undefined
          ? { postalCode: input.postalCode }
          : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined
          ? { longitude: input.longitude }
          : {}),
        ...(input.openingStatus !== undefined
          ? { openingStatus: input.openingStatus }
          : {}),
        ...(input.isVerified !== undefined
          ? { isVerified: input.isVerified }
          : {}),
        ...(input.homeVisitEnabled !== undefined
          ? { homeVisitEnabled: input.homeVisitEnabled }
          : {}),
      },
    });
  }

  async remove(id: string, user: { id: string; role: Role }) {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Удаление салона доступно только супер-администратору.',
        ),
      );
    }

    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    return this.prisma.salon.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private resolveOrder(sort?: string) {
    switch (sort) {
      case 'rating':
        return { ratingAverage: 'desc' as const, ratingCount: 'desc' as const };
      case 'name':
        return { name: 'asc' as const };
      case 'newest':
      default:
        return { createdAt: 'desc' as const };
    }
  }

  private slugify(value: string) {
    const base = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    return base || 'salon';
  }
}
