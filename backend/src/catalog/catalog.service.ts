import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { BookingStatus, MasterWorkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { NearbyCatalogQueryDto } from './dto/nearby-catalog-query.dto';
import {
  CatalogProviderConfigurationError,
  CatalogSearchResult,
} from '../catalog-providers/catalog-provider.interface';
import { ExternalPlacesProvider } from '../catalog-providers/external-places.provider';

export interface NearbyCatalogItem {
  id: string;
  source: 'PICKME' | 'EXTERNAL';
  externalProvider?: string | null;
  externalPlaceId?: string | null;
  name: string;
  category?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  openNow?: boolean | null;
  photoUrl?: string | null;
  externalUrl?: string | null;
  phone?: string | null;
  isPickmeConnected: boolean;
  isBookable?: boolean | null;
  isVerified?: boolean | null;
  mastersOnShift: number | null;
  availableMasters: number | null;
  busyMasters: number | null;
  nextAvailableSlot: string | null;
  minPrice: number | null;
  onlineBookingAvailable: boolean;
}

interface NearbyOperationalFields {
  mastersOnShift: number | null;
  availableMasters: number | null;
  busyMasters: number | null;
  nextAvailableSlot: string | null;
  minPrice: number | null;
  onlineBookingAvailable: boolean;
}

interface MasterAvailabilityState {
  id: string;
  currentStatus: MasterWorkStatus;
  acceptsBookings: boolean;
  availableAt: Date | null;
  minutesUntilAvailable: number | null;
}

interface MasterScheduleState {
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isDayOff: boolean;
  acceptsBookings: boolean;
}

interface BookingState {
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
}

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.pending,
  BookingStatus.confirmed,
  BookingStatus.inProgress,
];

const CURRENT_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.confirmed,
  BookingStatus.inProgress,
];

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function withTime(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function getShiftInterval(
  baseDate: Date,
  shiftStart: string,
  shiftEnd: string,
) {
  const start = withTime(baseDate, shiftStart);
  let end = withTime(baseDate, shiftEnd);

  if (parseTimeToMinutes(shiftEnd) <= parseTimeToMinutes(shiftStart)) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

function isMasterBookableNow(master: MasterAvailabilityState, now: Date) {
  if (master.currentStatus === MasterWorkStatus.AVAILABLE) return true;
  if (master.currentStatus !== MasterWorkStatus.SOON_AVAILABLE) return false;
  if (master.availableAt && master.availableAt <= now) return true;
  if (
    master.minutesUntilAvailable != null &&
    master.minutesUntilAvailable <= 0
  ) {
    return true;
  }
  return false;
}

function isOnShiftNow(schedules: MasterScheduleState[], now: Date) {
  const offsets = [-1, 0] as const;

  for (const offset of offsets) {
    const base = new Date(now);
    base.setDate(base.getDate() + offset);
    const dayOfWeek = base.getDay();
    const daySchedules = schedules.filter(
      (schedule) => schedule.dayOfWeek === dayOfWeek && !schedule.isDayOff,
    );

    for (const schedule of daySchedules) {
      const interval = getShiftInterval(
        base,
        schedule.shiftStart,
        schedule.shiftEnd,
      );
      if (interval.start <= now && now < interval.end) return true;
    }
  }

  return false;
}

function getNextAvailableSlotForMaster(
  schedules: MasterScheduleState[],
  bookings: BookingState[],
  now: Date,
) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const baseDate = new Date(startOfToday);
    baseDate.setDate(startOfToday.getDate() + dayOffset);
    const dayOfWeek = baseDate.getDay();

    const daySchedules = schedules
      .filter((schedule) => schedule.dayOfWeek === dayOfWeek)
      .filter((schedule) => !schedule.isDayOff && schedule.acceptsBookings)
      .sort(
        (a, b) =>
          parseTimeToMinutes(a.shiftStart) - parseTimeToMinutes(b.shiftStart),
      );

    for (const schedule of daySchedules) {
      const interval = getShiftInterval(
        baseDate,
        schedule.shiftStart,
        schedule.shiftEnd,
      );
      if (interval.end <= now) continue;

      let cursor = interval.start > now ? interval.start : now;
      const blockingBookings = bookings
        .filter((booking) => {
          if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) return false;
          return (
            booking.startsAt < interval.end && booking.endsAt > interval.start
          );
        })
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

      for (const booking of blockingBookings) {
        if (booking.endsAt <= cursor) continue;
        if (booking.startsAt > cursor) {
          return cursor;
        }
        cursor = new Date(Math.max(cursor.getTime(), booking.endsAt.getTime()));
      }

      if (cursor < interval.end) {
        return cursor;
      }
    }
  }

  return null;
}

export function mergeNearbyResults(
  pickmeResults: NearbyCatalogItem[],
  externalResults: NearbyCatalogItem[],
  radiusKm?: number,
) {
  const combined = [...pickmeResults, ...externalResults].filter((item) => {
    if (radiusKm == null) return true;
    return item.distanceKm == null || item.distanceKm <= radiusKm;
  });
  const seen: NearbyCatalogItem[] = [];

  const isSamePlace = (left: NearbyCatalogItem, right: NearbyCatalogItem) => {
    if (
      left.externalPlaceId &&
      right.externalPlaceId &&
      left.externalPlaceId === right.externalPlaceId
    ) {
      return true;
    }

    if (
      left.latitude != null &&
      left.longitude != null &&
      right.latitude != null &&
      right.longitude != null
    ) {
      const coordinateDistance =
        Math.sqrt(
          (left.latitude - right.latitude) ** 2 +
            (left.longitude - right.longitude) ** 2,
        ) * 111;
      if (coordinateDistance <= 0.2) {
        return true;
      }
    }

    if (
      left.name.trim().toLowerCase() &&
      right.name.trim().toLowerCase() &&
      (left.address ?? '').trim().toLowerCase() &&
      (right.address ?? '').trim().toLowerCase()
    ) {
      const normalizedAddressA = (left.address ?? '').trim().toLowerCase();
      const normalizedAddressB = (right.address ?? '').trim().toLowerCase();
      if (normalizedAddressA === normalizedAddressB) {
        const normalizedNameA = left.name.trim().toLowerCase();
        const normalizedNameB = right.name.trim().toLowerCase();
        if (normalizedNameA === normalizedNameB) {
          return true;
        }
      }
    }

    const normalizedNameA = left.name.trim().toLowerCase();
    const normalizedNameB = right.name.trim().toLowerCase();
    if (
      normalizedNameA &&
      normalizedNameB &&
      normalizedNameA === normalizedNameB
    ) {
      const addressA = (left.address ?? '').trim().toLowerCase();
      const addressB = (right.address ?? '').trim().toLowerCase();
      if (addressA && addressB && addressA === addressB) return true;
      if (
        left.latitude != null &&
        left.longitude != null &&
        right.latitude != null &&
        right.longitude != null
      ) {
        const distance =
          Math.sqrt(
            (left.latitude - right.latitude) ** 2 +
              (left.longitude - right.longitude) ** 2,
          ) * 111;
        if (distance <= 0.25) return true;
      }
    }
    return false;
  };

  for (const item of combined) {
    const duplicate = seen.find((existing) => isSamePlace(existing, item));
    if (duplicate) continue;
    seen.push(item);
  }

  return seen.sort((a, b) => {
    const priorityA = a.isPickmeConnected ? 0 : 1;
    const priorityB = b.isPickmeConnected ? 0 : 1;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return (
      (a.distanceKm ?? Number.MAX_SAFE_INTEGER) -
      (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
    );
  });
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly externalProvider: ExternalPlacesProvider,
  ) {}

  async getNearby(query: NearbyCatalogQueryDto) {
    const radiusMeters = query.radius ?? query.radiusKm ?? 5000;
    const radiusKm = radiusMeters / 1000;
    const limit = query.limit ?? 12;

    const [pickmeSalons, pickmeMasters] = await Promise.all([
      this.prisma.salon.findMany({
        where: { isActive: true },
        include: { services: { where: { isActive: true } } },
      }),
      this.prisma.masterProfile.findMany({
        include: {
          salonLinks: { where: { isActive: true }, include: { salon: true } },
        },
      }),
    ]);

    const operationalBySalonId = await this.buildOperationalBySalonId(
      pickmeSalons.map((salon) => salon.id),
    );

    let externalResult: CatalogSearchResult[] = [];
    try {
      externalResult = await this.externalProvider.search(
        query.query ?? 'hair salon',
        {
          latitude: query.latitude,
          longitude: query.longitude,
          radiusKm,
          category: query.category,
          limit,
        },
      );
    } catch (error) {
      if (error instanceof CatalogProviderConfigurationError) {
        throw new ServiceUnavailableException(
          buildApiError(
            503,
            'CATALOG_PROVIDER_NOT_CONFIGURED',
            'Внешний каталог не настроен. Проверьте конфигурацию provider key.',
          ),
        );
      }
      throw new ServiceUnavailableException(
        buildApiError(
          503,
          'CATALOG_PROVIDER_UNAVAILABLE',
          'Внешний каталог временно недоступен.',
        ),
      );
    }

    const pickmeItems: NearbyCatalogItem[] = [
      ...pickmeSalons.map((salon) => ({
        ...(operationalBySalonId.get(salon.id) ?? {
          mastersOnShift: null,
          availableMasters: null,
          busyMasters: null,
          nextAvailableSlot: null,
          minPrice: null,
          onlineBookingAvailable: false,
        }),
        id: `pickme-salon:${salon.id}`,
        source: 'PICKME' as const,
        name: salon.name,
        category: salon.country === 'Germany' ? 'beauty_salon' : 'beauty_salon',
        address: [salon.addressLine, salon.city, salon.postalCode]
          .filter(Boolean)
          .join(', '),
        latitude: salon.latitude,
        longitude: salon.longitude,
        rating: salon.ratingAverage ?? null,
        reviewCount: salon.ratingCount ?? null,
        openNow: null,
        photoUrl: null,
        externalUrl: null,
        phone: salon.phone ?? null,
        isPickmeConnected: true,
        isBookable: true,
        isVerified: salon.isVerified ?? null,
      })),
      ...pickmeMasters
        .filter((master) => master.isIndependent)
        .map((master) => ({
          id: `pickme-master:${master.id}`,
          source: 'PICKME' as const,
          name: master.displayName,
          category: 'barber',
          address:
            master.publicLatitude && master.publicLongitude
              ? 'Геолокация мастера'
              : 'Профиль мастера',
          latitude: master.publicLatitude,
          longitude: master.publicLongitude,
          rating: master.ratingAverage ?? null,
          reviewCount: master.reviewCount ?? null,
          openNow: null,
          photoUrl: master.avatarUrl ?? null,
          externalUrl: null,
          phone: null,
          isPickmeConnected: true,
          isBookable: false,
          isVerified: master.isVerified ?? null,
          mastersOnShift: null,
          availableMasters: null,
          busyMasters: null,
          nextAvailableSlot: null,
          minPrice: null,
          onlineBookingAvailable: false,
        })),
    ].map((item) => ({
      ...item,
      distanceKm: this.calculateDistanceKm(
        query.latitude,
        query.longitude,
        item.latitude ?? query.latitude,
        item.longitude ?? query.longitude,
      ),
    }));

    const externalItems: NearbyCatalogItem[] = externalResult.map((item) => {
      const externalOperational: NearbyOperationalFields = {
        mastersOnShift: null,
        availableMasters: null,
        busyMasters: null,
        nextAvailableSlot: null,
        minPrice: null,
        onlineBookingAvailable: false,
      };

      return {
        ...item,
        ...externalOperational,
        distanceKm: this.calculateDistanceKm(
          query.latitude,
          query.longitude,
          item.latitude ?? query.latitude,
          item.longitude ?? query.longitude,
        ),
      };
    });

    return mergeNearbyResults(pickmeItems, externalItems, radiusKm).slice(
      0,
      limit,
    );
  }

  private async buildOperationalBySalonId(salonIds: string[]) {
    const map = new Map<string, NearbyOperationalFields>();
    if (salonIds.length === 0) return map;

    const now = new Date();
    const upcomingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const salonMasters = await this.prisma.salonMaster.findMany({
      where: {
        salonId: { in: salonIds },
        isActive: true,
        temporarilyDisabled: false,
      },
      include: {
        master: {
          select: {
            id: true,
            currentStatus: true,
            acceptsBookings: true,
            availableAt: true,
            minutesUntilAvailable: true,
          },
        },
      },
    });

    const masterIds = [...new Set(salonMasters.map((link) => link.masterId))];

    const [schedules, bookings, services, masterServices] = await Promise.all([
      this.prisma.workingSchedule.findMany({
        where: {
          masterId: { in: masterIds },
          isDayOff: false,
        },
        select: {
          masterId: true,
          dayOfWeek: true,
          shiftStart: true,
          shiftEnd: true,
          isDayOff: true,
          acceptsBookings: true,
        },
      }),
      this.prisma.booking.findMany({
        where: {
          salonId: { in: salonIds },
          status: { in: ACTIVE_BOOKING_STATUSES },
          endsAt: { gt: now },
          startsAt: { lt: upcomingEnd },
        },
        select: {
          masterId: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      }),
      this.prisma.service.findMany({
        where: {
          salonId: { in: salonIds },
          isActive: true,
        },
        select: {
          id: true,
          salonId: true,
          price: true,
          basePrice: true,
        },
      }),
      this.prisma.masterService.findMany({
        where: {
          masterId: { in: masterIds },
          isActive: true,
          service: {
            isActive: true,
            salonId: { in: salonIds },
          },
        },
        select: {
          masterId: true,
          service: { select: { salonId: true } },
        },
      }),
    ]);

    const schedulesByMaster = new Map<string, MasterScheduleState[]>();
    for (const schedule of schedules) {
      const list = schedulesByMaster.get(schedule.masterId) ?? [];
      list.push({
        dayOfWeek: schedule.dayOfWeek,
        shiftStart: schedule.shiftStart,
        shiftEnd: schedule.shiftEnd,
        isDayOff: schedule.isDayOff,
        acceptsBookings: schedule.acceptsBookings,
      });
      schedulesByMaster.set(schedule.masterId, list);
    }

    const bookingsByMaster = new Map<string, BookingState[]>();
    for (const booking of bookings) {
      const list = bookingsByMaster.get(booking.masterId) ?? [];
      list.push({
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
      });
      bookingsByMaster.set(booking.masterId, list);
    }

    const minPriceBySalon = new Map<string, number>();
    for (const service of services) {
      if (!service.salonId) continue;
      const rawPrice = service.price ?? service.basePrice;
      const numericPrice = Number(rawPrice);
      if (Number.isNaN(numericPrice)) continue;

      const current = minPriceBySalon.get(service.salonId);
      if (current == null || numericPrice < current) {
        minPriceBySalon.set(service.salonId, numericPrice);
      }
    }

    const masterHasSalonService = new Set<string>();
    for (const item of masterServices) {
      const salonId = item.service.salonId;
      if (!salonId) continue;
      masterHasSalonService.add(`${salonId}:${item.masterId}`);
    }

    for (const salonId of salonIds) {
      const links = salonMasters.filter((link) => link.salonId === salonId);
      const masters = links.map((link) => ({
        id: link.master.id,
        currentStatus: link.master.currentStatus,
        acceptsBookings: link.master.acceptsBookings,
        availableAt: link.master.availableAt,
        minutesUntilAvailable: link.master.minutesUntilAvailable,
      }));

      let mastersOnShift = 0;
      let availableMasters = 0;
      let busyMasters = 0;
      const nextSlots: Date[] = [];

      for (const master of masters) {
        const masterSchedules = schedulesByMaster.get(master.id) ?? [];
        const masterBookings = bookingsByMaster.get(master.id) ?? [];
        const onShiftNow = isOnShiftNow(masterSchedules, now);
        const hasActiveService = masterHasSalonService.has(
          `${salonId}:${master.id}`,
        );

        if (onShiftNow) {
          mastersOnShift += 1;
        }

        const busyNowByBooking = masterBookings.some((booking) => {
          if (!CURRENT_BOOKING_STATUSES.includes(booking.status)) return false;
          return booking.startsAt <= now && now < booking.endsAt;
        });
        const busyNow =
          busyNowByBooking || master.currentStatus === MasterWorkStatus.BUSY;

        if (onShiftNow && busyNow) {
          busyMasters += 1;
        }

        if (
          onShiftNow &&
          hasActiveService &&
          master.acceptsBookings &&
          !busyNow &&
          isMasterBookableNow(master, now)
        ) {
          availableMasters += 1;
        }

        if (hasActiveService && master.acceptsBookings) {
          const nextSlot = getNextAvailableSlotForMaster(
            masterSchedules,
            masterBookings,
            now,
          );
          if (nextSlot) {
            nextSlots.push(nextSlot);
          }
        }
      }

      const nextAvailableSlot =
        nextSlots.length > 0
          ? new Date(
              Math.min(...nextSlots.map((slot) => slot.getTime())),
            ).toISOString()
          : null;
      const minPrice = minPriceBySalon.get(salonId) ?? null;

      map.set(salonId, {
        mastersOnShift,
        availableMasters,
        busyMasters,
        nextAvailableSlot,
        minPrice,
        onlineBookingAvailable: minPrice != null && nextAvailableSlot != null,
      });
    }

    return map;
  }

  private calculateDistanceKm(
    latitude1: number,
    longitude1: number,
    latitude2: number | null | undefined,
    longitude2: number | null | undefined,
  ) {
    if (latitude2 == null || longitude2 == null) return null;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(latitude2 - latitude1);
    const dLon = toRad((longitude2 ?? 0) - longitude1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(latitude1)) *
        Math.cos(toRad(latitude2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((earthRadiusKm * c).toFixed(2));
  }
}
