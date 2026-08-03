import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';

interface PortfolioUpsertInput {
  imageUrl?: string;
  title?: string | null;
  description?: string | null;
  serviceCategory?: string | null;
  sortOrder?: number;
}

interface PortfolioCreateInput extends PortfolioUpsertInput {
  imageUrl: string;
}

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async list(masterId: string) {
    return this.prisma.masterPortfolioItem.findMany({
      where: { masterId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(userId: string, input: PortfolioCreateInput) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    return this.prisma.masterPortfolioItem.create({
      data: {
        masterId: master.id,
        imageUrl: input.imageUrl,
        title: input.title ?? null,
        description: input.description ?? null,
        serviceCategory: input.serviceCategory ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async update(userId: string, itemId: string, input: PortfolioUpsertInput) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }
    const item = await this.prisma.masterPortfolioItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.masterId !== master.id) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'У вас нет прав на изменение этого портфолио.',
        ),
      );
    }

    return this.prisma.masterPortfolioItem.update({
      where: { id: itemId },
      data: {
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.serviceCategory !== undefined
          ? { serviceCategory: input.serviceCategory }
          : {}),
        ...(input.sortOrder !== undefined
          ? { sortOrder: input.sortOrder }
          : {}),
      },
    });
  }

  async remove(userId: string, itemId: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }
    const item = await this.prisma.masterPortfolioItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.masterId !== master.id) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'У вас нет прав на удаление этого портфолио.',
        ),
      );
    }

    return this.prisma.masterPortfolioItem.delete({ where: { id: itemId } });
  }
}
