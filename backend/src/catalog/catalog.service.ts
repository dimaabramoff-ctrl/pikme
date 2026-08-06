import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BookingStatus, MasterWorkStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildApiError } from '../common/api-error';
import { NearbyCatalogQueryDto } from './dto/nearby-catalog-query.dto';
import {
  CatalogProviderConfigurationError,
  CatalogSearchResult,
} from '../catalog-providers/catalog-provider.interface';
import {
  ExternalPlacesProvider,
  GoogleNearbyApiError,
} from '../catalog-providers/external-places.provider';

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
  profileFlags?: ProfileFlagsPayload | null;
}

export interface NearbyCatalogDiagnostics {
  googleRequestsMade: number;
  googleRawResults: number;
  uniqueResults: number;
  returnedOnThisPage: number;
  hasMore: boolean;
  radiusMetersUsed: number;
  providerErrorCode?: string | null;
}

export interface NearbyCatalogResponse {
  items: NearbyCatalogItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalUniqueResults: number;
  radiusMeters: number;
  appliedFilters: string[];
  diagnostics: NearbyCatalogDiagnostics;
}

interface NearbyOperationalFields {
  mastersOnShift: number | null;
  availableMasters: number | null;
  busyMasters: number | null;
  nextAvailableSlot: string | null;
  minPrice: number | null;
  onlineBookingAvailable: boolean;
}

interface ProfileFlagsPayload {
  isDemoProfile?: boolean;
  isTestProfile?: boolean;
  isIndependentProvider?: boolean;
  profileKind?: string | null;
  labels?: string[];
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

function readProfileFlags(raw: unknown): ProfileFlagsPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = (raw as { pickmeProfileFlags?: unknown }).pickmeProfileFlags;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const flags = candidate as {
    isDemoProfile?: unknown;
    isTestProfile?: unknown;
    isIndependentProvider?: unknown;
    profileKind?: unknown;
    labels?: unknown;
  };
  return {
    isDemoProfile: Boolean(flags.isDemoProfile),
    isTestProfile: Boolean(flags.isTestProfile),
    isIndependentProvider: Boolean(flags.isIndependentProvider),
    profileKind: typeof flags.profileKind === 'string' ? flags.profileKind : null,
    labels: Array.isArray(flags.labels)
      ? flags.labels.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function hasPublishedOwnerProfile(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const ownerEditor = (raw as { pickmeOwnerEditor?: unknown }).pickmeOwnerEditor;
  if (!ownerEditor || typeof ownerEditor !== 'object' || Array.isArray(ownerEditor)) return false;
  return Boolean((ownerEditor as { published?: unknown }).published);
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function isDemoZuhauseMasterMarker(input: { email?: string | null; biography?: string | null }) {
  const email = (input.email ?? '').toLowerCase();
  const biography = (input.biography ?? '').toUpperCase();
  return email.startsWith('demo.zuhause.') || biography.includes('DEMO_ZUHAUSE_PROFILE');
}

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
  const isDemoProfile = (item: NearbyCatalogItem) =>
    item.profileFlags?.isDemoProfile === true;

  const combined = [...pickmeResults, ...externalResults].filter((item) => {
    if (radiusKm == null) return true;
    if (isDemoProfile(item)) return true;
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
    const demoA = isDemoProfile(a) ? 0 : 1;
    const demoB = isDemoProfile(b) ? 0 : 1;
    if (demoA !== demoB) return demoA - demoB;

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
  private readonly logger = new Logger(CatalogService.name);
  private readonly nearbyCache = new Map<
    string,
    {
      createdAt: number;
      items: NearbyCatalogItem[];
      radiusMeters: number;
      diagnostics: {
        googleRequestsMade: number;
        googleRawResults: number;
      };
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly externalProvider: ExternalPlacesProvider,
  ) {}

  async getNearby(query: NearbyCatalogQueryDto): Promise<NearbyCatalogResponse> {
    const radiusMeters = Math.max(
      500,
      Math.min(15_000, query.radius ?? query.radiusKm ?? 15_000),
    );
    const radiusKm = radiusMeters / 1000;
    const limit = Math.max(1, Math.min(query.limit ?? 24, 50));
    const cursor = query.cursor ?? query.pageToken;
    const offset = this.decodeCursor(cursor);
    const appliedFilters = this.parseFilters(query.filters);

    const cacheKey = [
      query.latitude.toFixed(4),
      query.longitude.toFixed(4),
      radiusMeters,
      query.query ?? 'hair salon',
      query.category ?? 'all',
      [...appliedFilters].sort().join(','),
    ].join('|');

    const cacheTtlMs = 120_000;
    const cached = this.nearbyCache.get(cacheKey);

    let preparedItems: NearbyCatalogItem[];
    let googleRequestsMade = 0;
    let googleRawResults = 0;
    let providerErrorCode: string | null = null;

    if (cached && Date.now() - cached.createdAt <= cacheTtlMs) {
      preparedItems = cached.items;
      googleRequestsMade = cached.diagnostics.googleRequestsMade;
      googleRawResults = cached.diagnostics.googleRawResults;
    } else {
      const [pickmeSalons, pickmeMasters] = await Promise.all([
        this.prisma.salon.findMany({
          where: { isActive: true },
          include: {
            services: { where: { isActive: true } },
            photos: { orderBy: { sortOrder: 'asc' }, take: 1 },
            admins: { where: { isActive: true }, select: { id: true } },
          },
        }),
        this.prisma.masterProfile.findMany({
          include: {
            salonLinks: { where: { isActive: true }, include: { salon: true } },
            user: { select: { email: true } },
          },
        }),
      ]);

      const visibleSalons = pickmeSalons.filter((salon) => {
        if (!isProduction()) return true;
        const flags = readProfileFlags(salon.cancellationPolicyJson);
        if (flags?.isDemoProfile || flags?.isTestProfile) return false;
        if (salon.externalProvider === 'PICKME_TEST') return false;
        return true;
      });

      const visibleMasters = pickmeMasters.filter((master) => {
        if (!isProduction()) return true;
        return !isDemoZuhauseMasterMarker({
          email: master.user?.email,
          biography: master.biography,
        });
      });

      const operationalBySalonId = await this.buildOperationalBySalonId(
        visibleSalons.map((salon) => salon.id),
      );
      const operationalByMasterId = await this.buildOperationalByMasterId(
        visibleMasters.filter((master) => master.isIndependent).map((master) => master.id),
      );

      let externalResult: CatalogSearchResult[] = [];
      try {
        const aggregated = await this.externalProvider.searchAggregatedNearby(
          query.query ?? 'hair salon',
          {
            latitude: query.latitude,
            longitude: query.longitude,
            radiusKm,
            category: query.category,
            limit: 300,
          },
        );
        externalResult = aggregated.items;
        googleRequestsMade = aggregated.diagnostics.requestsMade;
        googleRawResults = aggregated.diagnostics.rawResults;
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

        if (error instanceof GoogleNearbyApiError) {
          if (error.googleStatus === 'INVALID_ARGUMENT') {
            providerErrorCode = 'GOOGLE_INVALID_ARGUMENT';
          }

          this.logger.error(
            `Catalog provider error ${JSON.stringify({
              provider: 'GOOGLE_PLACES',
              httpStatus: error.httpStatus,
              googleStatus: error.googleStatus,
              safeMessage: error.safeMessage,
              requestId: error.requestId,
              fieldMask: error.fieldMask,
            })}`,
          );
        }

        throw new ServiceUnavailableException(
          buildApiError(
            503,
            'CATALOG_PROVIDER_UNAVAILABLE',
            'Внешний каталог временно недоступен.',
            process.env.NODE_ENV === 'development' && providerErrorCode
              ? { providerErrorCode }
              : undefined,
          ),
        );
      }

      const pickmeItems: NearbyCatalogItem[] = [
        ...visibleSalons.map((salon) => {
          const flags = readProfileFlags(salon.cancellationPolicyJson);
          const externalNotConnected =
            salon.sourceType === 'EXTERNAL' &&
            !(salon.admins.length > 0 && hasPublishedOwnerProfile(salon.cancellationPolicyJson));
          const connected = !externalNotConnected;
          const operational = connected
            ? (operationalBySalonId.get(salon.id) ?? {
                mastersOnShift: null,
                availableMasters: null,
                busyMasters: null,
                nextAvailableSlot: null,
                minPrice: null,
                onlineBookingAvailable: false,
              })
            : {
                mastersOnShift: null,
                availableMasters: null,
                busyMasters: null,
                nextAvailableSlot: null,
                minPrice: null,
                onlineBookingAvailable: false,
              };

          return {
            ...operational,
            id: `pickme-salon:${salon.id}`,
            source:
              salon.sourceType === 'EXTERNAL' && !connected
                ? ('EXTERNAL' as const)
                : ('PICKME' as const),
            externalProvider: salon.externalProvider,
            externalPlaceId: salon.externalPlaceId,
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
            photoUrl: salon.photos?.[0]?.imageUrl ?? null,
            externalUrl: null,
            phone: salon.phone ?? null,
            isPickmeConnected: connected,
            isBookable: connected,
            isVerified: salon.isVerified ?? null,
            profileFlags: flags,
          };
        }),
        ...visibleMasters
          .filter((master) => master.isIndependent)
          .map((master) => {
            const isDemoZuhause = isDemoZuhauseMasterMarker({
              email: master.user?.email,
              biography: master.biography,
            });
            const profileFlags: ProfileFlagsPayload | null = isDemoZuhause
              ? {
                  isDemoProfile: true,
                  isTestProfile: false,
                  isIndependentProvider: true,
                  profileKind: 'DEMO_ZUHAUSE',
                  labels: ['Demo-Profil', 'Selbstständiger Anbieter'],
                }
              : {
                  isIndependentProvider: true,
                  labels: ['Selbstständiger Anbieter'],
                };
            return {
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
              profileFlags,
              ...(operationalByMasterId.get(master.id) ?? {
                mastersOnShift: null,
                availableMasters: null,
                busyMasters: null,
                nextAvailableSlot: null,
                minPrice: null,
                onlineBookingAvailable: false,
              }),
            };
          }),
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

      preparedItems = mergeNearbyResults(pickmeItems, externalItems, radiusKm);
      preparedItems = this.applyFilters(preparedItems, appliedFilters);

      this.nearbyCache.set(cacheKey, {
        createdAt: Date.now(),
        items: preparedItems,
        radiusMeters,
        diagnostics: {
          googleRequestsMade,
          googleRawResults,
        },
      });

      this.logger.log(
        `Catalog nearby prepared: raw=${googleRawResults}, unique=${preparedItems.length}, requests=${googleRequestsMade}, radius=${radiusMeters}`,
      );
    }

    const totalUniqueResults = preparedItems.length;
    const items = preparedItems.slice(offset, offset + limit);
    const hasMore = offset + items.length < totalUniqueResults;
    const nextCursor = hasMore ? this.encodeCursor(offset + items.length) : null;

    return {
      items,
      nextCursor,
      hasMore,
      totalUniqueResults,
      radiusMeters,
      appliedFilters,
      diagnostics: {
        googleRequestsMade,
        googleRawResults,
        uniqueResults: totalUniqueResults,
        returnedOnThisPage: items.length,
        hasMore,
        radiusMetersUsed: radiusMeters,
        providerErrorCode:
          process.env.NODE_ENV === 'development' ? providerErrorCode : null,
      },
    };
  }

  private applyFilters(items: NearbyCatalogItem[], filters: string[]) {
    if (filters.length === 0) return items;

    return items.filter((item) => {
      for (const filter of filters) {
        if (filter === 'OPEN' && item.openNow !== true) return false;
        if (filter === 'PICKME_PARTNER' && !item.isPickmeConnected) return false;
        if (
          filter === 'ONLINE_BOOKABLE' &&
          !(item.isPickmeConnected && item.onlineBookingAvailable)
        ) {
          return false;
        }
        if (filter === 'BARBERSHOP') {
          const category = String(item.category ?? '').toLowerCase();
          if (!category.includes('barber')) return false;
        }
        if (filter === 'NAIL_STUDIO') {
          const category = String(item.category ?? '').toLowerCase();
          if (!category.includes('nail')) return false;
        }
        if (filter === 'MOBILE_HOME') {
          const isMaster = item.id.startsWith('pickme-master:');
          const category = String(item.category ?? '').toLowerCase();
          if (!isMaster && !category.includes('mobile')) return false;
        }
      }
      return true;
    });
  }

  private parseFilters(value?: string) {
    if (!value) return [];
    return value
      .split(',')
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean);
  }

  private encodeCursor(offset: number) {
    return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) return 0;
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        offset?: number;
      };
      if (typeof parsed.offset !== 'number') return 0;
      return Math.max(0, Math.floor(parsed.offset));
    } catch {
      return 0;
    }
  }

  private async buildOperationalByMasterId(masterIds: string[]) {
    const map = new Map<string, NearbyOperationalFields>();
    if (masterIds.length === 0) return map;

    const now = new Date();
    const upcomingEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [masters, schedules, bookings] = await Promise.all([
      this.prisma.masterProfile.findMany({
        where: { id: { in: masterIds } },
        select: {
          id: true,
          currentStatus: true,
          acceptsBookings: true,
          availableAt: true,
          minutesUntilAvailable: true,
        },
      }),
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
          masterId: { in: masterIds },
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

    for (const master of masters) {
      const masterSchedules = schedulesByMaster.get(master.id) ?? [];
      const masterBookings = bookingsByMaster.get(master.id) ?? [];
      const onShiftNow = isOnShiftNow(masterSchedules, now);
      const busyNowByBooking = masterBookings.some((booking) => {
        if (!CURRENT_BOOKING_STATUSES.includes(booking.status)) return false;
        return booking.startsAt <= now && now < booking.endsAt;
      });
      const busyNow =
        busyNowByBooking || master.currentStatus === MasterWorkStatus.BUSY;
      const availableMasters =
        onShiftNow &&
        master.acceptsBookings &&
        !busyNow &&
        isMasterBookableNow(
          {
            id: master.id,
            currentStatus: master.currentStatus,
            acceptsBookings: master.acceptsBookings,
            availableAt: master.availableAt,
            minutesUntilAvailable: master.minutesUntilAvailable,
          },
          now,
        )
          ? 1
          : 0;
      const nextSlot = getNextAvailableSlotForMaster(
        masterSchedules,
        masterBookings,
        now,
      );

      map.set(master.id, {
        mastersOnShift: onShiftNow ? 1 : 0,
        availableMasters,
        busyMasters: onShiftNow && busyNow ? 1 : 0,
        nextAvailableSlot: nextSlot ? nextSlot.toISOString() : null,
        minPrice: null,
        onlineBookingAvailable:
          master.acceptsBookings && nextSlot != null,
      });
    }

    return map;
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
