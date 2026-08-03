import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { CreateServiceDto } from './dto/create-service.dto';

interface UpdateServiceDto extends Partial<CreateServiceDto> {
  isActive?: boolean;
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    salonId?: string;
    masterId?: string;
    category?: string;
    active?: boolean;
  }) {
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...(params.salonId ? { salonId: params.salonId } : {}),
      ...(params.category ? { category: params.category } : {}),
    };

    if (params.masterId) {
      const masterServices = await this.prisma.masterService.findMany({
        where: { masterId: params.masterId, isActive: true },
        include: { service: true },
      });
      return {
        items: masterServices.map((item) => ({
          ...item.service,
          price: item.priceOverride ?? item.service.basePrice,
          durationMinutes:
            item.durationMinutesOverride ?? item.service.durationMinutes,
          availableInSalon: item.availableInSalon,
          availableAtHome: item.availableAtHome,
        })),
      };
    }

    const services = await this.prisma.service.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return { items: services };
  }

  async getById(id: string) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException(
        buildApiError(404, 'SERVICE_NOT_FOUND', 'Услуга не найдена.'),
      );
    }
    return service;
  }

  async create(
    salonId: string,
    input: CreateServiceDto,
    user: { id: string; role: Role },
  ) {
    const isAdmin =
      user.role === Role.SUPER_ADMIN ||
      (await this.prisma.salonAdmin.findFirst({
        where: { userId: user.id, salonId, isActive: true },
      }));
    if (!isAdmin) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Недостаточно прав для создания услуги.',
        ),
      );
    }

    return this.prisma.service.create({
      data: {
        salonId,
        name: input.name,
        description: input.description,
        category: input.category,
        basePrice: input.basePrice,
        price: input.basePrice,
        durationMinutes: input.durationMinutes,
        availableInSalon: input.availableInSalon ?? true,
        availableAtHome: input.availableAtHome ?? false,
        isActive: true,
      },
    });
  }

  async update(
    id: string,
    input: UpdateServiceDto,
    user: { id: string; role: Role },
  ) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException(
        buildApiError(404, 'SERVICE_NOT_FOUND', 'Услуга не найдена.'),
      );
    }

    const isAdmin =
      user.role === Role.SUPER_ADMIN ||
      (await this.prisma.salonAdmin.findFirst({
        where: { userId: user.id, salonId: service.salonId!, isActive: true },
      }));
    if (!isAdmin) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Недостаточно прав для изменения услуги.',
        ),
      );
    }

    return this.prisma.service.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.basePrice !== undefined
          ? { basePrice: input.basePrice, price: input.basePrice }
          : {}),
        ...(input.durationMinutes !== undefined
          ? { durationMinutes: input.durationMinutes }
          : {}),
        ...(input.availableInSalon !== undefined
          ? { availableInSalon: input.availableInSalon }
          : {}),
        ...(input.availableAtHome !== undefined
          ? { availableAtHome: input.availableAtHome }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async remove(id: string, user: { id: string; role: Role }) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException(
        buildApiError(404, 'SERVICE_NOT_FOUND', 'Услуга не найдена.'),
      );
    }

    const isAdmin =
      user.role === Role.SUPER_ADMIN ||
      (await this.prisma.salonAdmin.findFirst({
        where: { userId: user.id, salonId: service.salonId!, isActive: true },
      }));
    if (!isAdmin) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Недостаточно прав для удаления услуги.',
        ),
      );
    }

    return this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
