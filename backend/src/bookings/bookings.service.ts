import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingPaymentProvider,
  BookingPaymentStatus,
  BookingStatus,
  Prisma,
  NotificationType,
  Role,
} from '@prisma/client';
import { buildApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateAvailableSlots,
  isSlotAvailableForSchedules,
} from './booking-slots';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BuildBookingQuoteDto,
  BookingQuoteItemDto,
} from './dto/build-booking-quote.dto';
import { GetBookingSlotsDto } from './dto/get-booking-slots.dto';

interface BookingModifierOption {
  id: string;
  label: string;
  extraPrice: number;
  extraDurationMinutes: number;
}

const BOOKING_MODIFIER_OPTIONS: BookingModifierOption[] = [
  { id: 'HAIR_LEN_SHORT', label: 'Kurze Haare', extraPrice: 0, extraDurationMinutes: 0 },
  { id: 'HAIR_LEN_MEDIUM', label: 'Mittlere Haare', extraPrice: 8, extraDurationMinutes: 10 },
  { id: 'HAIR_LEN_LONG', label: 'Lange Haare', extraPrice: 16, extraDurationMinutes: 20 },
  { id: 'COLOR_EXTRA_1', label: '+1 zusätzliche Farbe', extraPrice: 12, extraDurationMinutes: 15 },
  { id: 'COLOR_EXTRA_2', label: '+2 zusätzliche Farben', extraPrice: 24, extraDurationMinutes: 30 },
  { id: 'NAIL_ART_BASIC', label: 'Nail Art Basic', extraPrice: 10, extraDurationMinutes: 15 },
  { id: 'NAIL_ART_PRO', label: 'Nail Art Pro', extraPrice: 18, extraDurationMinutes: 25 },
  { id: 'REMOVE_OLD', label: 'Altes Material entfernen', extraPrice: 8, extraDurationMinutes: 12 },
];

const MODIFIER_OPTION_BY_ID = new Map(
  BOOKING_MODIFIER_OPTIONS.map((option) => [option.id, option]),
);

export interface BookingQuoteLine {
  serviceId: string;
  serviceName: string;
  quantity: number;
  basePrice: number;
  baseDurationMinutes: number;
  modifierOptionIds: string[];
  modifierPrice: number;
  modifierDurationMinutes: number;
  totalPrice: number;
  totalDurationMinutes: number;
}

export interface BookingQuoteResult {
  salonId: string;
  items: BookingQuoteLine[];
  totalPrice: number;
  totalDurationMinutes: number;
  currency: string;
  additionalWish: string | null;
}

export interface AvailableSlotItem {
  startsAt: string;
  availableMasterIds: string[];
}

export interface AvailableSlotsResponse {
  salonId: string;
  serviceId: string;
  durationMinutes: number;
  date: string;
  slots: AvailableSlotItem[];
}

export interface SalonPartnerBookingItem {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  masterName: string;
  startsAt: string;
  totalPrice: string;
  currency: string;
  status: BookingStatus;
  paymentStatus: string;
  customerComment: string | null;
}

export interface AdminBookingItem {
  id: string;
  bookingNumber: string;
  customerName: string;
  masterName: string;
  salonName: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  totalPrice: string;
  currency: string;
}

export interface CustomerBookingItem {
  id: string;
  bookingNumber: string;
  salonName: string | null;
  masterName: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  totalPrice: string;
  currency: string;
}

interface BookingLifecycleUser {
  id: string;
  role: Role;
}

@Injectable()
export class BookingsService {
    async buildQuote(dto: BuildBookingQuoteDto): Promise<BookingQuoteResult> {
      if (!dto.items?.length) {
        throw new BadRequestException(
          buildApiError(400, 'BOOKING_EMPTY_SELECTION', 'Нужно выбрать хотя бы одну услугу.'),
        );
      }

      return this.buildQuoteInternal(dto.salonId, dto.items, null);
    }

  constructor(private readonly prisma: PrismaService) {}

  async getSalonPartnerBookings(
    salonId: string,
    user: { id: string; role: Role },
  ): Promise<SalonPartnerBookingItem[]> {
    if (
      user.role !== Role.SALON_OWNER &&
      user.role !== Role.SALON_ADMIN &&
      user.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только владелец салона или супер-администратор может просматривать заказы салона.',
        ),
      );
    }

    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, isActive: true },
    });

    if (!salon || !salon.isActive) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    if (user.role !== Role.SUPER_ADMIN) {
      const membership = await this.prisma.salonAdmin.findFirst({
        where: {
          salonId,
          userId: user.id,
          isActive: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException(
          buildApiError(
            403,
            'FORBIDDEN',
            'Вы можете просматривать заказы только своего салона.',
          ),
        );
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where: { salonId },
      include: {
        customer: {
          include: {
            user: {
              select: {
                phone: true,
              },
            },
          },
        },
        master: {
          select: {
            displayName: true,
          },
        },
        service: {
          select: {
            name: true,
          },
        },
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        startsAt: 'desc',
      },
      take: 100,
    });

    return bookings.map((booking) => {
      const customerName =
        `${booking.customer.firstName} ${booking.customer.lastName}`.trim();
      const paymentStatus = booking.payments[0]?.status ?? 'pending';

      return {
        id: booking.id,
        bookingNumber: `PM-2026-${booking.id.slice(-5).toUpperCase()}`,
        customerName,
        customerPhone: booking.customer.user.phone,
        serviceName: booking.service.name,
        masterName: booking.master.displayName,
        startsAt: booking.startsAt.toISOString(),
        totalPrice: booking.totalPrice.toString(),
        currency: booking.currency,
        status: booking.status,
        paymentStatus,
        customerComment: null,
      };
    });
  }

  async getAllBookingsForAdmin(): Promise<AdminBookingItem[]> {
    const bookings = await this.prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: {
          include: {
            user: {
              select: { phone: true },
            },
          },
        },
        master: {
          select: { displayName: true },
        },
        salon: {
          select: { name: true },
        },
        service: {
          select: { name: true },
        },
      },
    });

    return bookings.map((booking) => ({
      id: booking.id,
      bookingNumber: `PM-2026-${booking.id.slice(-5).toUpperCase()}`,
      customerName: `${booking.customer.firstName} ${booking.customer.lastName}`.trim(),
      masterName: booking.master.displayName,
      salonName: booking.salon?.name ?? null,
      serviceName: booking.service.name,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      totalPrice: booking.totalPrice.toString(),
      currency: booking.currency,
    }));
  }

  async getMyBookings(userId: string): Promise<CustomerBookingItem[]> {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customer) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'Профиль клиента не найден.'),
      );
    }

    const bookings = await this.prisma.booking.findMany({
      where: { customerProfileId: customer.id },
      include: {
        salon: { select: { name: true } },
        master: { select: { displayName: true } },
        service: { select: { name: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 100,
    });

    return bookings.map((booking) => ({
      id: booking.id,
      bookingNumber: `PM-2026-${booking.id.slice(-5).toUpperCase()}`,
      salonName: booking.salon?.name ?? null,
      masterName: booking.master.displayName,
      serviceName: booking.service.name,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      totalPrice: booking.totalPrice.toString(),
      currency: booking.currency,
    }));
  }

  async getAvailableSlots(
    query: GetBookingSlotsDto,
  ): Promise<AvailableSlotsResponse> {
    const date = this.parseDateOnly(query.date);

    const serviceIds = query.serviceIds
      ? query.serviceIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [query.serviceId];

    const services = await this.prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        salonId: query.salonId,
        isActive: true,
      },
      select: {
        id: true,
        salonId: true,
        durationMinutes: true,
      },
    });

    if (services.length !== serviceIds.length) {
      throw new NotFoundException(
        buildApiError(
          404,
          'SERVICE_NOT_FOUND',
          'Услуга не найдена для этого салона.',
        ),
      );
    }

    const totalDurationMinutes = services.reduce(
      (sum, service) => sum + service.durationMinutes,
      0,
    );

    const masterLinks = await this.prisma.salonMaster.findMany({
      where: {
        salonId: query.salonId,
        isActive: true,
        temporarilyDisabled: false,
        master: {
          acceptsBookings: true,
          services: {
            some: {
              serviceId: { in: serviceIds },
              isActive: true,
            },
          },
        },
      },
      select: {
        masterId: true,
      },
    });

    const masterIds = masterLinks
      .map((item) => item.masterId)
      .sort((a, b) => a.localeCompare(b));

    const masteredServices = await this.prisma.masterService.findMany({
      where: {
        masterId: { in: masterIds },
        serviceId: { in: serviceIds },
        isActive: true,
      },
      select: {
        masterId: true,
        serviceId: true,
      },
    });

    const serviceSetByMaster = new Map<string, Set<string>>();
    for (const row of masteredServices) {
      const set = serviceSetByMaster.get(row.masterId) ?? new Set<string>();
      set.add(row.serviceId);
      serviceSetByMaster.set(row.masterId, set);
    }

    const eligibleMasterIds = masterIds.filter((masterId) => {
      const set = serviceSetByMaster.get(masterId);
      if (!set) return false;
      return serviceIds.every((serviceId) => set.has(serviceId));
    });

    if (eligibleMasterIds.length === 0) {
      return {
        salonId: query.salonId,
        serviceId: serviceIds[0],
        durationMinutes: totalDurationMinutes,
        date: query.date,
        slots: [] as AvailableSlotItem[],
      };
    }

    if (query.masterId && !eligibleMasterIds.includes(query.masterId)) {
      throw new BadRequestException(
        buildApiError(
          400,
          'INVALID_MASTER_SERVICE_PAIR',
          'Выбранный мастер не выполняет эту услугу в данном салоне.',
        ),
      );
    }

    const targetMasterIds = query.masterId ? [query.masterId] : eligibleMasterIds;

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const previousDay = new Date(dayStart);
    previousDay.setDate(previousDay.getDate() - 1);
    const dayOfWeek = dayStart.getDay();
    const previousDayOfWeek = previousDay.getDay();

    const [schedules, bookings] = await Promise.all([
      this.prisma.workingSchedule.findMany({
        where: {
          masterId: { in: targetMasterIds },
          isDayOff: false,
          acceptsBookings: true,
          dayOfWeek: { in: [dayOfWeek, previousDayOfWeek] },
        },
        include: { breaks: true },
      }),
      this.prisma.booking.findMany({
        where: {
          masterId: { in: targetMasterIds },
          status: {
            in: [
              BookingStatus.pending,
              BookingStatus.confirmed,
              BookingStatus.inProgress,
            ],
          },
          startsAt: { lt: dayEnd },
          endsAt: { gt: new Date(previousDay.getTime() + 12 * 60 * 60 * 1000) },
        },
        select: {
          masterId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      }),
    ]);

    const schedulesByMaster = new Map<string, typeof schedules>();
    for (const schedule of schedules) {
      const list = schedulesByMaster.get(schedule.masterId) ?? [];
      list.push(schedule);
      schedulesByMaster.set(schedule.masterId, list);
    }

    const bookingsByMaster = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const list = bookingsByMaster.get(booking.masterId) ?? [];
      list.push(booking);
      bookingsByMaster.set(booking.masterId, list);
    }

    const slotMap = new Map<string, string[]>();
    const now = new Date();

    for (const masterId of targetMasterIds) {
      const masterSlots = calculateAvailableSlots({
        date,
            durationMinutes: totalDurationMinutes,
        schedules: schedulesByMaster.get(masterId) ?? [],
        bookings: bookingsByMaster.get(masterId) ?? [],
        now,
      });

      for (const slot of masterSlots) {
        const key = slot.toISOString();
        const list = slotMap.get(key) ?? [];
        list.push(masterId);
        slotMap.set(key, list);
      }
    }

    const slots: AvailableSlotItem[] = [...slotMap.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([startsAt, availableMasterIds]) => ({
        startsAt,
        availableMasterIds: availableMasterIds.sort((a, b) =>
          a.localeCompare(b),
        ),
      }));

    return {
      salonId: query.salonId,
      serviceId: serviceIds[0],
      durationMinutes: totalDurationMinutes,
      date: query.date,
      slots,
    };
  }

  async createBooking(userId: string, dto: CreateBookingDto) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!customer) {
      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Только клиент может создавать записи.',
        ),
      );
    }

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException(
        buildApiError(
          400,
          'BOOKING_INVALID_START',
          'Некорректное время начала записи.',
        ),
      );
    }

    if (startsAt <= new Date()) {
      throw new BadRequestException(
        buildApiError(
          400,
          'BOOKING_IN_THE_PAST',
          'Нельзя записаться в прошедшее время.',
        ),
      );
    }

    const selectedItems: BookingQuoteItemDto[] =
      dto.items && dto.items.length > 0
        ? dto.items.map((item) => ({
            serviceId: item.serviceId,
            quantity: item.quantity,
            modifierOptionIds: item.modifierOptionIds,
          }))
        : [{ serviceId: dto.serviceId, quantity: 1, modifierOptionIds: [] }];

    const quote = await this.buildQuoteInternal(
      dto.salonId,
      selectedItems,
      dto.additionalWish ?? null,
    );

    const primaryService = quote.items[0];
    if (!primaryService) {
      throw new BadRequestException(
        buildApiError(400, 'BOOKING_EMPTY_SELECTION', 'Нужно выбрать хотя бы одну услугу.'),
      );
    }

    const service = await this.prisma.service.findFirst({
      where: {
        id: primaryService.serviceId,
        salonId: dto.salonId,
        isActive: true,
      },
      select: {
        id: true,
        salonId: true,
        durationMinutes: true,
        price: true,
        basePrice: true,
        currency: true,
      },
    });

    if (!service) {
      throw new NotFoundException(
        buildApiError(
          404,
          'SERVICE_NOT_FOUND',
          'Услуга не найдена для этого салона.',
        ),
      );
    }

    const endsAt = new Date(startsAt.getTime() + quote.totalDurationMinutes * 60 * 1000);

    const eligibleMasters = await this.prisma.salonMaster.findMany({
      where: {
        salonId: dto.salonId,
        isActive: true,
        temporarilyDisabled: false,
        master: {
          acceptsBookings: true,
          services: {
            some: {
              serviceId: { in: quote.items.map((item) => item.serviceId) },
              isActive: true,
            },
          },
        },
      },
      select: {
        masterId: true,
      },
    });

    const masterIds = eligibleMasters
      .map((item) => item.masterId)
      .sort((a, b) => a.localeCompare(b));

    const requiredServiceIds = quote.items.map((item) => item.serviceId);
    const masteredServices = await this.prisma.masterService.findMany({
      where: {
        masterId: { in: masterIds },
        serviceId: { in: requiredServiceIds },
        isActive: true,
      },
      select: {
        masterId: true,
        serviceId: true,
      },
    });

    const serviceSetByMaster = new Map<string, Set<string>>();
    for (const row of masteredServices) {
      const set = serviceSetByMaster.get(row.masterId) ?? new Set<string>();
      set.add(row.serviceId);
      serviceSetByMaster.set(row.masterId, set);
    }

    const qualifiedMasterIds = masterIds.filter((masterId) => {
      const set = serviceSetByMaster.get(masterId);
      if (!set) return false;
      return requiredServiceIds.every((serviceId) => set.has(serviceId));
    });

    if (qualifiedMasterIds.length === 0) {
      throw new ConflictException(
        buildApiError(
          409,
          'NO_AVAILABLE_MASTERS',
          'Для выбранной услуги нет доступных мастеров.',
        ),
      );
    }

    if (dto.masterId && !qualifiedMasterIds.includes(dto.masterId)) {
      throw new BadRequestException(
        buildApiError(
          400,
          'INVALID_MASTER_SERVICE_PAIR',
          'Выбранный мастер не выполняет эту услугу в данном салоне.',
        ),
      );
    }

    const masterCandidates = dto.masterId ? [dto.masterId] : qualifiedMasterIds;

    const dayStart = new Date(startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const previousDay = new Date(dayStart);
    previousDay.setDate(previousDay.getDate() - 1);
    const dayOfWeek = dayStart.getDay();
    const previousDayOfWeek = previousDay.getDay();

    const schedules = await this.prisma.workingSchedule.findMany({
      where: {
        masterId: { in: masterCandidates },
        isDayOff: false,
        acceptsBookings: true,
        dayOfWeek: { in: [dayOfWeek, previousDayOfWeek] },
      },
      include: { breaks: true },
    });

    const schedulesByMaster = new Map<string, typeof schedules>();
    for (const schedule of schedules) {
      const list = schedulesByMaster.get(schedule.masterId) ?? [];
      list.push(schedule);
      schedulesByMaster.set(schedule.masterId, list);
    }

    const price = quote.totalPrice;

    const paymentProvider = BookingPaymentProvider.MANUAL_IN_SALON;
    const paymentStatus = BookingPaymentStatus.PENDING;
    const paidAt = null;

    const salonForMode = await this.prisma.salon.findUnique({
      where: { id: dto.salonId },
      select: { cancellationPolicyJson: true },
    });

    const confirmationMode = this.resolveBookingConfirmationMode(
      salonForMode?.cancellationPolicyJson ?? null,
    );
    const initialStatus =
      confirmationMode === 'REQUEST' ? BookingStatus.pending : BookingStatus.confirmed;

    return this.prisma.$transaction(
      async (tx) => {
        for (const masterId of masterCandidates) {
          const conflict = await tx.booking.findFirst({
            where: {
              masterId,
              status: {
                in: [
                  BookingStatus.pending,
                  BookingStatus.confirmed,
                  BookingStatus.inProgress,
                ],
              },
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
            select: { id: true },
          });

          if (conflict) continue;

          const isScheduleAvailable = isSlotAvailableForSchedules({
            startsAt,
            durationMinutes: quote.totalDurationMinutes,
            date: startsAt,
            schedules: schedulesByMaster.get(masterId) ?? [],
            bookings: [],
          });

          if (!isScheduleAvailable) continue;

          const booking = await tx.booking.create({
            data: {
              customerProfileId: customer.id,
              masterId,
              salonId: dto.salonId,
              serviceId: service.id,
              status: initialStatus,
              startsAt,
              endsAt,
              totalPrice: price,
              currency: quote.currency,
            },
          });

          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              fromStatus: null,
              toStatus: initialStatus,
              changedBy: userId,
            },
          });

          await tx.bookingPayment.create({
            data: {
              bookingId: booking.id,
              customerId: userId,
              partnerId: dto.salonId,
              provider: paymentProvider,
              subtotal: price,
              discount: 0,
              travelFee: 0,
              platformFee: 0,
              total: price,
              currency: quote.currency,
              status: paymentStatus,
              paidAt,
            },
          });

          await tx.auditLog.create({
            data: {
              actorUserId: userId,
              action: 'BOOKING_CREATED',
              entityType: 'Booking',
              entityId: booking.id,
              payload: {
                salonId: dto.salonId,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
                paymentMethod: dto.paymentMethod,
                totalPrice: price,
                currency: quote.currency,
              },
            },
          });

          const masterProfile = await tx.masterProfile.findUnique({
            where: { id: masterId },
            select: { userId: true },
          });

          await tx.notification.createMany({
            data: [
              {
                userId,
                type:
                  initialStatus === BookingStatus.pending
                    ? NotificationType.BOOKING_CREATED
                    : NotificationType.BOOKING_CONFIRMED,
                title:
                  initialStatus === BookingStatus.pending
                    ? 'Anfrage gesendet'
                    : 'Termin bestätigt',
                message:
                  initialStatus === BookingStatus.pending
                    ? 'Ihre Anfrage wurde gesendet. Der Salon bestätigt den Termin.'
                    : 'Ihr Termin ist bestätigt.',
                payload: {
                  bookingId: booking.id,
                  salonId: dto.salonId,
                  startsAt: startsAt.toISOString(),
                },
              },
              ...(masterProfile?.userId
                ? [{
                    userId: masterProfile.userId,
                    type:
                      initialStatus === BookingStatus.pending
                        ? NotificationType.BOOKING_CREATED
                        : NotificationType.BOOKING_CONFIRMED,
                    title:
                      initialStatus === BookingStatus.pending
                        ? 'Neue Terminanfrage'
                        : 'Neue bestätigte Buchung',
                    message:
                      initialStatus === BookingStatus.pending
                        ? 'Eine neue Terminanfrage ist eingegangen.'
                        : 'Ein neuer Termin wurde bestätigt.',
                    payload: {
                      bookingId: booking.id,
                      salonId: dto.salonId,
                      startsAt: startsAt.toISOString(),
                    },
                  }]
                : []),
            ],
          });

          return booking;
        }

        throw new ConflictException(
          buildApiError(
            409,
            'BOOKING_SLOT_CONFLICT',
            'Выбранный слот уже недоступен. Обновите время и повторите попытку.',
          ),
        );
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async confirmBooking(bookingId: string, actor: BookingLifecycleUser) {
    return this.changeBookingStatus(bookingId, actor, BookingStatus.confirmed);
  }

  async cancelBooking(
    bookingId: string,
    actor: BookingLifecycleUser,
    reason?: string,
  ) {
    return this.changeBookingStatus(
      bookingId,
      actor,
      BookingStatus.cancelled,
      reason,
    );
  }

  async rejectBooking(
    bookingId: string,
    actor: BookingLifecycleUser,
    reason?: string,
  ) {
    return this.changeBookingStatus(
      bookingId,
      actor,
      BookingStatus.rejected,
      reason,
    );
  }

  async completeBooking(bookingId: string, actor: BookingLifecycleUser) {
    return this.changeBookingStatus(bookingId, actor, BookingStatus.completed);
  }

  async markNoShow(bookingId: string, actor: BookingLifecycleUser) {
    return this.changeBookingStatus(bookingId, actor, BookingStatus.noShow);
  }

  async rescheduleBooking(
    bookingId: string,
    actor: BookingLifecycleUser,
    startsAtInput: string,
    reason?: string,
  ) {
    const startsAt = new Date(startsAtInput);
    if (Number.isNaN(startsAt.getTime())) {
      throw new BadRequestException(
        buildApiError(
          400,
          'BOOKING_INVALID_START',
          'Некорректное время начала записи.',
        ),
      );
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { userId: true, firstName: true, lastName: true } },
        master: { select: { userId: true, displayName: true } },
        salon: { select: { id: true, name: true } },
        service: { select: { name: true, durationMinutes: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        buildApiError(404, 'BOOKING_NOT_FOUND', 'Запись не найдена.'),
      );
    }

    await this.assertBookingAccess(booking, actor);

    if (startsAt <= new Date()) {
      throw new BadRequestException(
        buildApiError(
          400,
          'BOOKING_IN_THE_PAST',
          'Нельзя перенести запись в прошлое.',
        ),
      );
    }

    const durationMinutes = booking.service.durationMinutes;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

    const eligible = await this.isRescheduleSlotAvailable({
      bookingId,
      masterId: booking.masterId,
      startsAt,
      endsAt,
      durationMinutes,
    });

    if (!eligible) {
      throw new ConflictException(
        buildApiError(
          409,
          'BOOKING_SLOT_CONFLICT',
          'Выбранный слот уже недоступен. Обновите время и повторите попытку.',
        ),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          startsAt,
          endsAt,
          status:
            booking.status === BookingStatus.pending
              ? BookingStatus.pending
              : BookingStatus.confirmed,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: updated.id,
          fromStatus: booking.status,
          toStatus: updated.status,
          changedBy: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: 'BOOKING_RESCHEDULED',
          entityType: 'Booking',
          entityId: updated.id,
          reason,
          payload: {
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          },
        },
      });

      await this.createBookingNotifications(tx, {
        bookingId: updated.id,
        customerUserId: booking.customer.userId,
        masterUserId: booking.master.userId,
        type: NotificationType.SCHEDULE_CHANGED,
        title: 'Termin verschoben',
        message: 'Ihr Termin wurde verschoben.',
        payload: {
          bookingId: updated.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        },
      });

      return updated;
    });
  }

  private async changeBookingStatus(
    bookingId: string,
    actor: BookingLifecycleUser,
    nextStatus: BookingStatus,
    reason?: string,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { select: { userId: true, firstName: true, lastName: true } },
        master: { select: { userId: true, displayName: true } },
        salon: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(
        buildApiError(404, 'BOOKING_NOT_FOUND', 'Запись не найдена.'),
      );
    }

    await this.assertBookingAccess(booking, actor);

    if (booking.status === nextStatus) {
      return booking;
    }

    const statusGuard =
      nextStatus === BookingStatus.completed
        ? booking.status === BookingStatus.confirmed || booking.status === BookingStatus.inProgress
        : nextStatus === BookingStatus.noShow
          ? booking.status === BookingStatus.confirmed
          : nextStatus === BookingStatus.confirmed
            ? booking.status === BookingStatus.pending
              : nextStatus === BookingStatus.rejected
                ? booking.status === BookingStatus.pending
            : true;

    if (!statusGuard) {
      throw new ConflictException(
        buildApiError(
          409,
          'BOOKING_INVALID_STATUS_TRANSITION',
          'Нельзя выполнить это изменение статуса для текущей записи.',
        ),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: nextStatus },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: updated.id,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: `BOOKING_${nextStatus.toUpperCase()}`,
          entityType: 'Booking',
          entityId: updated.id,
          reason,
          payload: {
            salonId: booking.salonId,
          },
        },
      });

      await this.createBookingNotifications(tx, {
        bookingId: updated.id,
        customerUserId: booking.customer.userId,
        masterUserId: booking.master.userId,
        type:
          nextStatus === BookingStatus.cancelled
            ? NotificationType.BOOKING_CANCELLED
            : nextStatus === BookingStatus.completed
              ? NotificationType.BOOKING_COMPLETED
              : nextStatus === BookingStatus.rejected
                ? NotificationType.BOOKING_REJECTED
              : nextStatus === BookingStatus.confirmed
                ? NotificationType.BOOKING_CONFIRMED
                : NotificationType.SALON_MESSAGE,
        title:
          nextStatus === BookingStatus.cancelled
            ? 'Termin storniert'
            : nextStatus === BookingStatus.completed
              ? 'Termin abgeschlossen'
              : nextStatus === BookingStatus.rejected
                ? 'Anfrage abgelehnt'
              : nextStatus === BookingStatus.confirmed
                ? 'Termin bestätigt'
                : 'Termin aktualisiert',
        message:
          nextStatus === BookingStatus.cancelled
            ? 'Ihr Termin wurde storniert.'
            : nextStatus === BookingStatus.completed
              ? 'Ihr Termin wurde als abgeschlossen markiert.'
              : nextStatus === BookingStatus.rejected
                ? 'Ihre Terminanfrage wurde abgelehnt.'
              : nextStatus === BookingStatus.confirmed
                ? 'Ihr Termin ist bestätigt.'
                : 'Ihr Termin wurde aktualisiert.',
        payload: {
          bookingId: updated.id,
          status: nextStatus,
        },
      });

      return updated;
    });
  }

  private async createBookingNotifications(
    tx: Prisma.TransactionClient,
    params: {
      bookingId: string;
      customerUserId: string;
      masterUserId: string | null;
      type: NotificationType;
      title: string;
      message: string;
      payload?: Prisma.InputJsonValue;
    },
  ) {
    const recipients = [params.customerUserId, params.masterUserId].filter(Boolean) as string[];
    if (recipients.length === 0) return;

    await tx.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message,
        payload: params.payload ?? { bookingId: params.bookingId },
      })),
    });
  }

  private async assertBookingAccess(
    booking: {
      customer: { userId: string };
      master: { userId: string };
      salonId: string | null;
    },
    actor: BookingLifecycleUser,
  ) {
    if (actor.role === Role.SUPER_ADMIN) return;
    if (booking.customer.userId === actor.id) return;
    if (booking.master.userId === actor.id) return;

    if (booking.salonId && (actor.role === Role.SALON_OWNER || actor.role === Role.SALON_ADMIN)) {
      const membership = await this.prisma.salonAdmin.findFirst({
        where: {
          salonId: booking.salonId,
          userId: actor.id,
          isActive: true,
        },
        select: { id: true },
      });

      if (membership) {
        return;
      }
    }

    throw new ForbiddenException(
      buildApiError(403, 'FORBIDDEN', 'У вас нет доступа к этой записи.'),
    );
  }

  private async isRescheduleSlotAvailable(params: {
    bookingId: string;
    masterId: string;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
  }) {
    const dayStart = new Date(params.startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const previousDay = new Date(dayStart);
    previousDay.setDate(previousDay.getDate() - 1);

    const [schedules, bookings] = await Promise.all([
      this.prisma.workingSchedule.findMany({
        where: {
          masterId: params.masterId,
          isDayOff: false,
          acceptsBookings: true,
          dayOfWeek: { in: [dayStart.getDay(), previousDay.getDay()] },
        },
        include: { breaks: true },
      }),
      this.prisma.booking.findMany({
        where: {
          masterId: params.masterId,
          id: { not: params.bookingId },
          status: {
            in: [BookingStatus.pending, BookingStatus.confirmed, BookingStatus.inProgress],
          },
          startsAt: { lt: dayEnd },
          endsAt: { gt: previousDay },
        },
        select: { startsAt: true, endsAt: true, status: true },
      }),
    ]);

    return isSlotAvailableForSchedules({
      startsAt: params.startsAt,
      durationMinutes: params.durationMinutes,
      date: params.startsAt,
      schedules,
      bookings,
    });
  }

  private async buildQuoteInternal(
    salonId: string,
    selection: BookingQuoteItemDto[],
    additionalWish: string | null,
  ): Promise<BookingQuoteResult> {
    const normalizedSelection = selection
      .map((item) => ({
        serviceId: item.serviceId,
        quantity: Math.max(1, Math.floor(item.quantity ?? 1)),
        modifierOptionIds: item.modifierOptionIds ?? [],
      }))
      .filter((item) => item.serviceId);

    const duplicatedServiceId = normalizedSelection.find(
      (item, index) => normalizedSelection.findIndex((entry) => entry.serviceId === item.serviceId) !== index,
    )?.serviceId;

    if (duplicatedServiceId) {
      throw new BadRequestException(
        buildApiError(
          400,
          'BOOKING_DUPLICATE_SERVICE',
          'Одна и та же базовая услуга не может быть добавлена дважды в одном бронировании.',
        ),
      );
    }

    for (const item of normalizedSelection) {
      if (item.quantity > 1) {
        throw new BadRequestException(
          buildApiError(
            400,
            'BOOKING_INVALID_SERVICE_QUANTITY',
            'Количество базовой услуги должно быть равно 1. Используйте модификаторы для повторяемых опций.',
          ),
        );
      }
    }

    if (normalizedSelection.length === 0) {
      throw new BadRequestException(
        buildApiError(400, 'BOOKING_EMPTY_SELECTION', 'Нужно выбрать хотя бы одну услугу.'),
      );
    }

    const serviceIds = [...new Set(normalizedSelection.map((item) => item.serviceId))];
    const services = await this.prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        salonId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        basePrice: true,
        price: true,
        durationMinutes: true,
        currency: true,
      },
    });

    if (services.length !== serviceIds.length) {
      throw new NotFoundException(
        buildApiError(404, 'SERVICE_NOT_FOUND', 'Часть выбранных услуг недоступна.'),
      );
    }

    const serviceById = new Map(services.map((service) => [service.id, service]));

    const lines: BookingQuoteLine[] = normalizedSelection.map((item) => {
      const service = serviceById.get(item.serviceId);
      if (!service) {
        throw new NotFoundException(
          buildApiError(404, 'SERVICE_NOT_FOUND', 'Услуга не найдена для этого салона.'),
        );
      }

      const basePrice = Number(service.price ?? service.basePrice);
      const modifierOptionIds = item.modifierOptionIds.filter((id) => MODIFIER_OPTION_BY_ID.has(id));
      const modifierPrice = modifierOptionIds.reduce(
        (sum, optionId) => sum + (MODIFIER_OPTION_BY_ID.get(optionId)?.extraPrice ?? 0),
        0,
      );
      const modifierDurationMinutes = modifierOptionIds.reduce(
        (sum, optionId) => sum + (MODIFIER_OPTION_BY_ID.get(optionId)?.extraDurationMinutes ?? 0),
        0,
      );

      const lineUnitPrice = basePrice + modifierPrice;
      const lineUnitDuration = service.durationMinutes + modifierDurationMinutes;

      return {
        serviceId: service.id,
        serviceName: service.name,
        quantity: item.quantity,
        basePrice,
        baseDurationMinutes: service.durationMinutes,
        modifierOptionIds,
        modifierPrice,
        modifierDurationMinutes,
        totalPrice: lineUnitPrice * item.quantity,
        totalDurationMinutes: lineUnitDuration * item.quantity,
      };
    });

    const totalPrice = lines.reduce((sum, line) => sum + line.totalPrice, 0);
    const totalDurationMinutes = lines.reduce(
      (sum, line) => sum + line.totalDurationMinutes,
      0,
    );

    return {
      salonId,
      items: lines,
      totalPrice,
      totalDurationMinutes,
      currency: services[0]?.currency ?? 'EUR',
      additionalWish,
    };
  }

  private parseDateOnly(value: string) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        buildApiError(400, 'INVALID_DATE', 'Некорректная дата.'),
      );
    }

    return date;
  }

  private resolveBookingConfirmationMode(
    cancellationPolicyJson: Prisma.JsonValue | null,
  ): 'AUTO' | 'REQUEST' {
    if (!cancellationPolicyJson || typeof cancellationPolicyJson !== 'object' || Array.isArray(cancellationPolicyJson)) {
      return 'AUTO';
    }

    const ownerEditor = (cancellationPolicyJson as { pickmeOwnerEditor?: unknown }).pickmeOwnerEditor;
    if (!ownerEditor || typeof ownerEditor !== 'object' || Array.isArray(ownerEditor)) {
      return 'AUTO';
    }

    const published = (ownerEditor as { published?: unknown }).published;
    if (!published || typeof published !== 'object' || Array.isArray(published)) {
      return 'AUTO';
    }

    const overview = (published as { overview?: unknown }).overview;
    if (!overview || typeof overview !== 'object' || Array.isArray(overview)) {
      return 'AUTO';
    }

    const mode = (overview as { bookingConfirmationMode?: unknown }).bookingConfirmationMode;
    return mode === 'REQUEST' ? 'REQUEST' : 'AUTO';
  }
}
