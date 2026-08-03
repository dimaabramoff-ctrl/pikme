import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';

interface ScheduleItemInput {
  salonId?: string;
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isDayOff?: boolean;
  acceptsBookings?: boolean;
  acceptsUrgentBookings?: boolean;
  supportsHomeVisits?: boolean;
}

interface ScheduleBreakInput {
  scheduleId: string;
  startTime: string;
  endTime: string;
}

interface ScheduleBreakUpdateInput {
  startTime: string;
  endTime: string;
}

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForMaster(masterId: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { id: masterId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Мастер не найден.'),
      );
    }

    return this.prisma.workingSchedule.findMany({
      where: { masterId },
      include: { breaks: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async getMy(userId: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    return this.getForMaster(master.id);
  }

  async replaceMy(userId: string, items: ScheduleItemInput[]) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    for (const item of items) {
      this.validateSchedule(item);
    }

    await this.prisma.scheduleBreak.deleteMany({});
    await this.prisma.workingSchedule.deleteMany({
      where: { masterId: master.id },
    });

    await this.prisma.workingSchedule.createMany({
      data: items.map((item) => ({
        masterId: master.id,
        salonId: item.salonId ?? null,
        dayOfWeek: item.dayOfWeek,
        shiftStart: item.shiftStart,
        shiftEnd: item.shiftEnd,
        isDayOff: item.isDayOff ?? false,
        acceptsBookings: item.acceptsBookings ?? true,
        acceptsUrgentBookings: item.acceptsUrgentBookings ?? true,
        supportsHomeVisits: item.supportsHomeVisits ?? false,
      })),
    });

    return this.getForMaster(master.id);
  }

  async createBreak(userId: string, input: ScheduleBreakInput) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    const schedule = await this.prisma.workingSchedule.findFirst({
      where: { id: input.scheduleId, masterId: master.id },
    });
    if (!schedule) {
      throw new NotFoundException(
        buildApiError(404, 'SCHEDULE_INVALID', 'График не найден.'),
      );
    }

    if (input.startTime >= input.endTime) {
      throw new BadRequestException(
        buildApiError(
          400,
          'SCHEDULE_INVALID',
          'Некорректный интервал перерыва.',
        ),
      );
    }

    return this.prisma.scheduleBreak.create({
      data: {
        scheduleId: schedule.id,
        startTime: input.startTime,
        endTime: input.endTime,
      },
    });
  }

  async updateBreak(
    userId: string,
    breakId: string,
    input: ScheduleBreakUpdateInput,
  ) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    const breakItem = await this.prisma.scheduleBreak.findFirst({
      where: { id: breakId },
      include: { schedule: true },
    });
    if (!breakItem || breakItem.schedule.masterId !== master.id) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'У вас нет прав на изменение перерыва.',
        ),
      );
    }

    return this.prisma.scheduleBreak.update({
      where: { id: breakId },
      data: { startTime: input.startTime, endTime: input.endTime },
    });
  }

  async deleteBreak(userId: string, breakId: string) {
    const master = await this.prisma.masterProfile.findUnique({
      where: { userId },
    });
    if (!master) {
      throw new NotFoundException(
        buildApiError(404, 'MASTER_NOT_FOUND', 'Профиль мастера не найден.'),
      );
    }

    const breakItem = await this.prisma.scheduleBreak.findFirst({
      where: { id: breakId },
      include: { schedule: true },
    });
    if (!breakItem || breakItem.schedule.masterId !== master.id) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'У вас нет прав на удаление перерыва.'),
      );
    }

    return this.prisma.scheduleBreak.delete({ where: { id: breakId } });
  }

  private validateSchedule(item: ScheduleItemInput) {
    if (
      !/^\d{2}:\d{2}$/.test(item.shiftStart) ||
      !/^\d{2}:\d{2}$/.test(item.shiftEnd)
    ) {
      throw new BadRequestException(
        buildApiError(400, 'SCHEDULE_INVALID', 'Неверный формат времени.'),
      );
    }

    const start = this.toMinutes(item.shiftStart);
    const end = this.toMinutes(item.shiftEnd);
    if (end <= start) {
      throw new BadRequestException(
        buildApiError(
          400,
          'SCHEDULE_INVALID',
          'Конец смены должен быть позже начала.',
        ),
      );
    }
    if (end - start > 16 * 60) {
      throw new BadRequestException(
        buildApiError(400, 'SCHEDULE_INVALID', 'Смена слишком длинная.'),
      );
    }
    if (item.isDayOff && (item.shiftStart || item.shiftEnd)) {
      throw new BadRequestException(
        buildApiError(
          400,
          'SCHEDULE_INVALID',
          'Выходной не должен содержать часов.',
        ),
      );
    }
  }

  private toMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
