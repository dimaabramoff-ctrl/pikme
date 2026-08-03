import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только клиент может работать с избранным.',
        ),
      );
    }

    const items = await this.prisma.favorite.findMany({
      where: { customerProfileId: customer.id },
      include: { salon: true, master: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      salons: items
        .filter((item) => item.salon)
        .map((item) => ({ ...item.salon, favoriteId: item.id })),
      masters: items
        .filter((item) => item.master)
        .map((item) => ({ ...item.master, favoriteId: item.id })),
    };
  }

  async addSalon(userId: string, salonId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только клиент может работать с избранным.',
        ),
      );
    }
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
    });
    if (!salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    try {
      return await this.prisma.favorite.create({
        data: { customerProfileId: customer.id, entityType: 'SALON', salonId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          buildApiError(
            409,
            'FAVORITE_ALREADY_EXISTS',
            'Салон уже добавлен в избранное.',
          ),
        );
      }
      throw error;
    }
  }

  async removeSalon(userId: string, salonId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только клиент может работать с избранным.',
        ),
      );
    }
    return this.prisma.favorite.deleteMany({
      where: { customerProfileId: customer.id, entityType: 'SALON', salonId },
    });
  }

  async addMaster(userId: string, masterId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только клиент может работать с избранным.',
        ),
      );
    }
    const master = await this.prisma.masterProfile.findUnique({
      where: { id: masterId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Мастер не найден.'),
      );
    }

    try {
      return await this.prisma.favorite.create({
        data: {
          customerProfileId: customer.id,
          entityType: 'MASTER',
          masterId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          buildApiError(
            409,
            'FAVORITE_ALREADY_EXISTS',
            'Мастер уже добавлен в избранное.',
          ),
        );
      }
      throw error;
    }
  }

  async removeMaster(userId: string, masterId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });
    if (!customer) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только клиент может работать с избранным.',
        ),
      );
    }
    return this.prisma.favorite.deleteMany({
      where: { customerProfileId: customer.id, entityType: 'MASTER', masterId },
    });
  }
}
