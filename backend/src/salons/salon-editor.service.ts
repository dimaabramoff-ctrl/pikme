import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { MasterWorkStatus, Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { buildApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

type EditorPaymentMethod = 'IN_SALON' | 'CARD';
const GOOGLE_COVER_SENTINEL = '__GOOGLE_COVER__';

interface EditorScheduleBreak {
  startTime: string;
  endTime: string;
  reason?: string;
}

interface EditorScheduleRow {
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isDayOff?: boolean;
  acceptsBookings?: boolean;
  acceptsUrgentBookings?: boolean;
  supportsHomeVisits?: boolean;
  breaks?: EditorScheduleBreak[];
}

interface EditorStaffItem {
  id?: string;
  displayName: string;
  specialization?: string;
  biography?: string;
  experienceYears?: number;
  acceptsHomeVisits?: boolean;
  currentStatus?: MasterWorkStatus;
  avatarUrl?: string;
  serviceIds: string[];
  schedules: EditorScheduleRow[];
}

interface EditorServiceItem {
  id?: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  durationMinutes: number;
  availableInSalon?: boolean;
  availableAtHome?: boolean;
  isActive?: boolean;
}

interface EditorPhotoItem {
  id?: string;
  imageUrl: string;
  sortOrder: number;
}

interface EditorOverview {
  name: string;
  businessType: string;
  tagline: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  addressLine: string;
  city: string;
  postalCode: string;
  openingHoursText: string;
  languages: string[];
  amenities: string[];
  parking: string;
  accessibility: string;
  paymentMethods: EditorPaymentMethod[];
  bookingConfirmationMode?: 'AUTO' | 'REQUEST';
  foundedYear?: number | null;
}

interface EditorMoreInfo {
  about: string;
  history: string;
  serviceDirections: string[];
  rules: string[];
  teamNote: string;
}

export interface SalonEditorDraftPayload {
  overview: EditorOverview;
  moreInfo: EditorMoreInfo;
  services: EditorServiceItem[];
  staff: EditorStaffItem[];
  photos: EditorPhotoItem[];
  coverPhotoId?: string | null;
  googleCoverUrl?: string | null;
}

export interface SalonEditorPublishedPayload {
  overview: EditorOverview;
  moreInfo: EditorMoreInfo;
  coverPhotoId?: string | null;
  googleCoverUrl?: string | null;
  publishedAt: string;
}

export interface SalonEditorStateResponse {
  salonId: string;
  draft: SalonEditorDraftPayload;
  published: SalonEditorPublishedPayload;
  validationIssues: string[];
  updatedAt: string;
  publishedAt: string;
}

export interface SalonEditorDraftSaveResponse {
  salonId: string;
  draft: SalonEditorDraftPayload;
  validationIssues: string[];
}

export interface SalonEditorPublishResponse {
  salonId: string;
  publishedAt?: string;
  draft: SalonEditorDraftPayload;
  publicSalon: unknown;
}

interface SalonEditorMetadata {
  pickmeOwnerEditor?: {
    draft?: SalonEditorDraftPayload;
    published?: {
      overview: EditorOverview;
      moreInfo: EditorMoreInfo;
      coverPhotoId?: string | null;
      googleCoverUrl?: string | null;
      publishedAt: string;
    };
    lastUpdatedAt?: string;
    lastPublishedAt?: string;
  };
}

function toEditorPaymentMethods(input: unknown): EditorPaymentMethod[] {
  if (!Array.isArray(input)) return ['IN_SALON', 'CARD'];
  const valid = input.filter(
    (item): item is EditorPaymentMethod => item === 'IN_SALON' || item === 'CARD',
  );
  return valid.length > 0 ? [...new Set(valid)] : ['IN_SALON', 'CARD'];
}

@Injectable()
export class SalonEditorService {
  constructor(private readonly prisma: PrismaService) {}

  async getEditorState(
    salonId: string,
    user: { id: string; role: Role },
  ): Promise<SalonEditorStateResponse> {
    const salon = await this.getSalonForEditor(salonId);
    await this.assertEditorAccess(salonId, user);

    const metadata = this.readMetadata(salon.cancellationPolicyJson);
    const published = metadata.pickmeOwnerEditor?.published ?? this.buildPublishedFromSalon(salon);
    const draft = metadata.pickmeOwnerEditor?.draft ?? this.buildDraftFromSalon(salon, published);

    return {
      salonId,
      draft,
      published,
      validationIssues: this.validateDraft(draft),
      updatedAt: metadata.pickmeOwnerEditor?.lastUpdatedAt ?? salon.updatedAt.toISOString(),
      publishedAt: metadata.pickmeOwnerEditor?.lastPublishedAt ?? published.publishedAt,
    };
  }

  async saveDraft(
    salonId: string,
    user: { id: string; role: Role },
    draft: SalonEditorDraftPayload,
  ): Promise<SalonEditorDraftSaveResponse> {
    const salon = await this.getSalonForEditor(salonId);
    await this.assertEditorAccess(salonId, user);

    const metadata = this.readMetadata(salon.cancellationPolicyJson);
    const sanitizedDraft = this.sanitizeDraft(draft, salon);
    const nextMetadata: SalonEditorMetadata = {
      ...metadata,
      pickmeOwnerEditor: {
        ...metadata.pickmeOwnerEditor,
        draft: sanitizedDraft,
        published:
          metadata.pickmeOwnerEditor?.published ?? this.buildPublishedFromSalon(salon),
        lastUpdatedAt: new Date().toISOString(),
        lastPublishedAt: metadata.pickmeOwnerEditor?.lastPublishedAt,
      },
    };

    await this.prisma.$transaction(async (tx) => {
      const previousDraft = metadata.pickmeOwnerEditor?.draft ?? null;
      await tx.salon.update({
        where: { id: salonId },
        data: {
          cancellationPolicyJson: nextMetadata as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'PROFILE_DRAFT_SAVED',
          entityType: 'Salon',
          entityId: salonId,
          before: previousDraft as unknown as Prisma.InputJsonValue | undefined,
          after: sanitizedDraft as unknown as Prisma.InputJsonValue,
          payload: {
            salonId,
            draftServices: sanitizedDraft.services.length,
            draftStaff: sanitizedDraft.staff.length,
            draftPhotos: sanitizedDraft.photos.length,
          },
        },
      });
    });

    return {
      salonId,
      draft: sanitizedDraft,
      validationIssues: this.validateDraft(sanitizedDraft),
    };
  }

  async publishDraft(
    salonId: string,
    user: { id: string; role: Role },
  ): Promise<SalonEditorPublishResponse> {
    const salon = await this.getSalonForEditor(salonId);
    await this.assertEditorAccess(salonId, user);

    const metadata = this.readMetadata(salon.cancellationPolicyJson);
    const draft = metadata.pickmeOwnerEditor?.draft ?? this.buildDraftFromSalon(salon, this.buildPublishedFromSalon(salon));
    const sanitizedDraft = this.sanitizeDraft(draft, salon);
    const validationIssues = this.validateDraft(sanitizedDraft);

    if (validationIssues.length > 0) {
      throw new BadRequestException(
        buildApiError(
          400,
          'SALON_EDITOR_VALIDATION_FAILED',
          'Публикация невозможна, пока не исправлены обязательные поля.',
          { issues: validationIssues },
        ),
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const previousPublished = metadata.pickmeOwnerEditor?.published ?? this.buildPublishedFromSalon(salon);
      const existingServices = await tx.service.findMany({
        where: { salonId },
        select: { id: true, name: true, description: true, category: true, basePrice: true, durationMinutes: true, availableInSalon: true, availableAtHome: true, isActive: true },
      });
      const existingMasterLinks = await tx.salonMaster.findMany({
        where: { salonId },
        include: {
          master: {
            include: {
              schedules: { include: { breaks: true } },
            },
          },
        },
      });
      const existingPhotos = await tx.salonPhoto.findMany({
        where: { salonId },
        select: { id: true, imageUrl: true, sortOrder: true },
      });
      const existingServiceById = new Map(existingServices.map((service) => [service.id, service]));
      const existingMasterById = new Map(existingMasterLinks.map((item) => [item.masterId, item.master]));

      for (const service of sanitizedDraft.services) {
        if (service.id) {
          const previous = existingServiceById.get(service.id);
          await tx.service.update({
            where: { id: service.id },
            data: {
              name: service.name,
              description: service.description || null,
              category: service.category,
              basePrice: service.basePrice,
              price: service.basePrice,
              durationMinutes: service.durationMinutes,
              availableInSalon: service.availableInSalon ?? true,
              availableAtHome: service.availableAtHome ?? false,
              isActive: service.isActive ?? true,
            },
          });

          if (previous && (
            previous.name !== service.name ||
            (previous.description ?? '') !== (service.description || '') ||
            previous.category !== service.category ||
            Number(previous.basePrice) !== service.basePrice ||
            previous.durationMinutes !== service.durationMinutes ||
            previous.availableInSalon !== (service.availableInSalon ?? true) ||
            previous.availableAtHome !== (service.availableAtHome ?? false) ||
            previous.isActive !== (service.isActive ?? true)
          )) {
            await tx.auditLog.create({
              data: {
                actorUserId: user.id,
                action: 'SERVICE_UPDATED',
                entityType: 'Service',
                entityId: service.id,
                before: previous as unknown as Prisma.InputJsonValue,
                after: service as unknown as Prisma.InputJsonValue,
                payload: { salonId },
              },
            });
          }
          continue;
        }

        const createdService = await tx.service.create({
          data: {
            salonId,
            name: service.name,
            description: service.description || null,
            category: service.category,
            basePrice: service.basePrice,
            price: service.basePrice,
            durationMinutes: service.durationMinutes,
            availableInSalon: service.availableInSalon ?? true,
            availableAtHome: service.availableAtHome ?? false,
            isActive: service.isActive ?? true,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'SERVICE_CREATED',
            entityType: 'Service',
            entityId: createdService.id,
            after: { ...service, id: createdService.id } as unknown as Prisma.InputJsonValue,
            payload: { salonId },
          },
        });
      }

      const incomingServiceIds = new Set(
        sanitizedDraft.services.map((service) => service.id).filter((value): value is string => Boolean(value)),
      );

      for (const existingService of existingServices) {
        if (!incomingServiceIds.has(existingService.id)) {
          await tx.service.update({
            where: { id: existingService.id },
            data: { isActive: false },
          });

          await tx.auditLog.create({
            data: {
              actorUserId: user.id,
              action: 'SERVICE_DISABLED',
              entityType: 'Service',
              entityId: existingService.id,
              before: existingService as unknown as Prisma.InputJsonValue,
              after: { ...existingService, isActive: false } as unknown as Prisma.InputJsonValue,
              payload: { salonId },
            },
          });
        }
      }

      const persistedServices = await tx.service.findMany({
        where: { salonId, isActive: true },
        select: { id: true, name: true },
      });
      const activeServiceIds = new Set(persistedServices.map((service) => service.id));
      const persistedServiceIdByName = new Map(
        persistedServices.map((service) => [service.name, service.id]),
      );

      const incomingMasterIds = new Set<string>();

      for (const staff of sanitizedDraft.staff) {
        let masterId = staff.id;
        if (!masterId) {
          const placeholderUser = await tx.user.create({
            data: {
              email: `staff-${salonId}-${randomUUID()}@pickme.local`,
              phone: `+49${Date.now()}${Math.floor(Math.random() * 1000)}`,
              passwordHash: await argon2.hash(randomUUID()),
              role: Role.MASTER,
              isActive: false,
              isVerified: false,
            },
            select: { id: true },
          });

          const createdMaster = await tx.masterProfile.create({
            data: {
              userId: placeholderUser.id,
              salonId,
              displayName: staff.displayName,
              specialization: staff.specialization || null,
              biography: staff.biography || null,
              experienceYears: staff.experienceYears ?? 0,
              acceptsHomeVisits: staff.acceptsHomeVisits ?? false,
              currentStatus: staff.currentStatus ?? MasterWorkStatus.AVAILABLE,
              avatarUrl: staff.avatarUrl || null,
              acceptsBookings: true,
            },
            select: { id: true },
          });

          await tx.salonMaster.create({
            data: {
              salonId,
              masterId: createdMaster.id,
              isActive: true,
            },
          });

          masterId = createdMaster.id;
        } else {
          const previousMaster = existingMasterById.get(masterId);
          await tx.masterProfile.update({
            where: { id: masterId },
            data: {
              salonId,
              displayName: staff.displayName,
              specialization: staff.specialization || null,
              biography: staff.biography || null,
              experienceYears: staff.experienceYears ?? 0,
              acceptsHomeVisits: staff.acceptsHomeVisits ?? false,
              currentStatus: staff.currentStatus ?? MasterWorkStatus.AVAILABLE,
              avatarUrl: staff.avatarUrl || null,
              acceptsBookings: true,
            },
          });

          await tx.auditLog.create({
            data: {
              actorUserId: user.id,
              action: 'STAFF_UPDATED',
              entityType: 'MasterProfile',
              entityId: masterId,
              before: previousMaster as unknown as Prisma.InputJsonValue | undefined,
              after: staff as unknown as Prisma.InputJsonValue,
              payload: { salonId },
            },
          });

          await tx.salonMaster.upsert({
            where: { salonId_masterId: { salonId, masterId } },
            update: { isActive: true, acceptsHomeVisits: staff.acceptsHomeVisits ?? false },
            create: { salonId, masterId, isActive: true, acceptsHomeVisits: staff.acceptsHomeVisits ?? false },
          });
        }

        incomingMasterIds.add(masterId);

        const normalizedServiceIds = staff.serviceIds
          .map((serviceId) => activeServiceIds.has(serviceId) ? serviceId : persistedServiceIdByName.get(serviceId))
          .filter((serviceId): serviceId is string => Boolean(serviceId));

        const existingMasterServices = await tx.masterService.findMany({
          where: { masterId },
          select: { id: true, serviceId: true },
        });

        for (const link of existingMasterServices) {
          if (!normalizedServiceIds.includes(link.serviceId)) {
            await tx.masterService.update({
              where: { id: link.id },
              data: { isActive: false },
            });
          }
        }

        for (const serviceId of normalizedServiceIds) {
          await tx.masterService.upsert({
            where: { masterId_serviceId: { masterId, serviceId } },
            update: {
              isActive: true,
              availableInSalon: true,
              availableAtHome: staff.acceptsHomeVisits ?? false,
            },
            create: {
              masterId,
              serviceId,
              isActive: true,
              availableInSalon: true,
              availableAtHome: staff.acceptsHomeVisits ?? false,
            },
          });
        }

        await tx.scheduleBreak.deleteMany({
          where: { schedule: { masterId } },
        });
        await tx.workingSchedule.deleteMany({ where: { masterId } });

        for (const schedule of staff.schedules) {
          const createdSchedule = await tx.workingSchedule.create({
            data: {
              masterId,
              salonId,
              dayOfWeek: schedule.dayOfWeek,
              shiftStart: schedule.shiftStart,
              shiftEnd: schedule.shiftEnd,
              isDayOff: schedule.isDayOff ?? false,
              acceptsBookings: schedule.acceptsBookings ?? true,
              acceptsUrgentBookings: schedule.acceptsUrgentBookings ?? true,
              supportsHomeVisits: schedule.supportsHomeVisits ?? false,
            },
            select: { id: true },
          });

          if (schedule.breaks?.length) {
            await tx.scheduleBreak.createMany({
              data: schedule.breaks.map((item) => ({
                scheduleId: createdSchedule.id,
                startTime: item.startTime,
                endTime: item.endTime,
                reason: item.reason ?? null,
              })),
            });
          }
        }
      }

      for (const existingMaster of existingMasterLinks) {
        if (!incomingMasterIds.has(existingMaster.masterId)) {
          await tx.salonMaster.update({
            where: { salonId_masterId: { salonId, masterId: existingMaster.masterId } },
            data: { isActive: false },
          });
        }
      }

      const incomingPhotoIds = new Set(
        sanitizedDraft.photos.map((photo) => photo.id).filter((value): value is string => Boolean(value)),
      );

      for (const photo of sanitizedDraft.photos) {
        if (photo.id) {
          await tx.salonPhoto.update({
            where: { id: photo.id },
            data: { imageUrl: photo.imageUrl, sortOrder: photo.sortOrder },
          });
          continue;
        }

        await tx.salonPhoto.create({
          data: {
            salonId,
            imageUrl: photo.imageUrl,
            sortOrder: photo.sortOrder,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'PROFILE_IMAGE_ADDED',
            entityType: 'SalonPhoto',
            entityId: null,
            after: photo as unknown as Prisma.InputJsonValue,
            payload: { salonId },
          },
        });
      }

      for (const existingPhoto of existingPhotos) {
        if (!incomingPhotoIds.has(existingPhoto.id)) {
          await tx.salonPhoto.delete({ where: { id: existingPhoto.id } });
        }
      }

      const publishedAt = new Date().toISOString();
      const nextMetadata: SalonEditorMetadata = {
        ...metadata,
        pickmeOwnerEditor: {
          draft: sanitizedDraft,
          published: {
            overview: sanitizedDraft.overview,
            moreInfo: sanitizedDraft.moreInfo,
            coverPhotoId: sanitizedDraft.coverPhotoId ?? null,
            googleCoverUrl: sanitizedDraft.googleCoverUrl ?? null,
            publishedAt,
          },
          lastUpdatedAt: publishedAt,
          lastPublishedAt: publishedAt,
        },
      };

      const updatedSalon = await tx.salon.update({
        where: { id: salonId },
        data: {
          name: sanitizedDraft.overview.name,
          description: sanitizedDraft.overview.description,
          phone: sanitizedDraft.overview.phone || null,
          email: sanitizedDraft.overview.email || null,
          website: sanitizedDraft.overview.website || null,
          addressLine: sanitizedDraft.overview.addressLine,
          addressLine1: sanitizedDraft.overview.addressLine,
          city: sanitizedDraft.overview.city,
          postalCode: sanitizedDraft.overview.postalCode,
          openingHoursJson: {
            displayText: sanitizedDraft.overview.openingHoursText,
          } as Prisma.InputJsonValue,
          cancellationPolicyJson: nextMetadata as Prisma.InputJsonValue,
        },
        include: {
          photos: { orderBy: { sortOrder: 'asc' } },
          services: { where: { isActive: true } },
          masters: {
            where: { isActive: true },
            include: { master: { include: { services: true, schedules: { include: { breaks: true } } } } },
          },
          reviews: true,
        },
      });

      if (!this.paymentMethodsEqual(previousPublished.overview.paymentMethods, sanitizedDraft.overview.paymentMethods)) {
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'PAYMENT_METHOD_CHANGED',
            entityType: 'Salon',
            entityId: salonId,
            before: { paymentMethods: previousPublished.overview.paymentMethods } as unknown as Prisma.InputJsonValue,
            after: { paymentMethods: sanitizedDraft.overview.paymentMethods } as unknown as Prisma.InputJsonValue,
            payload: { salonId },
          },
        });
      }

      if ((previousPublished.coverPhotoId ?? null) !== (sanitizedDraft.coverPhotoId ?? null)
        || (previousPublished.googleCoverUrl ?? null) !== (sanitizedDraft.googleCoverUrl ?? null)) {
        await tx.auditLog.create({
          data: {
            actorUserId: user.id,
            action: 'PROFILE_COVER_CHANGED',
            entityType: 'Salon',
            entityId: salonId,
            before: {
              coverPhotoId: previousPublished.coverPhotoId ?? null,
              googleCoverUrl: previousPublished.googleCoverUrl ?? null,
            } as unknown as Prisma.InputJsonValue,
            after: {
              coverPhotoId: sanitizedDraft.coverPhotoId ?? null,
              googleCoverUrl: sanitizedDraft.googleCoverUrl ?? null,
            } as unknown as Prisma.InputJsonValue,
            payload: { salonId },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'PROFILE_PUBLISHED',
          entityType: 'Salon',
          entityId: salonId,
          before: previousPublished as unknown as Prisma.InputJsonValue,
          after: {
            overview: sanitizedDraft.overview,
            moreInfo: sanitizedDraft.moreInfo,
            coverPhotoId: sanitizedDraft.coverPhotoId ?? null,
            googleCoverUrl: sanitizedDraft.googleCoverUrl ?? null,
          } as unknown as Prisma.InputJsonValue,
          payload: {
            salonId,
            services: sanitizedDraft.services.length,
            staff: sanitizedDraft.staff.length,
            photos: sanitizedDraft.photos.length,
            paymentMethods: sanitizedDraft.overview.paymentMethods,
          },
        },
      });

      return updatedSalon;
    });

    return {
      salonId,
      publishedAt: this.readMetadata(result.cancellationPolicyJson).pickmeOwnerEditor?.lastPublishedAt,
      draft: sanitizedDraft,
      publicSalon: result,
    };
  }

  private async getSalonForEditor(salonId: string) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
      include: {
        photos: { orderBy: { sortOrder: 'asc' } },
        services: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
        masters: {
          where: { isActive: true },
          include: {
            master: {
              include: {
                services: { where: { isActive: true } },
                schedules: { include: { breaks: true }, orderBy: { dayOfWeek: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!salon) {
      throw new NotFoundException(
        buildApiError(404, 'SALON_NOT_FOUND', 'Салон не найден.'),
      );
    }

    return salon;
  }

  private async assertEditorAccess(salonId: string, user: { id: string; role: Role }) {
    if (user.role === Role.SUPER_ADMIN) return;

    const membership = await this.prisma.salonAdmin.findFirst({
      where: {
        salonId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        buildApiError(403, 'FORBIDDEN', 'У вас нет прав на редактирование этого салона.'),
      );
    }
  }

  private readMetadata(value: Prisma.JsonValue | null): SalonEditorMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as unknown as SalonEditorMetadata;
  }

  private buildPublishedFromSalon(
    salon: Awaited<ReturnType<SalonEditorService['getSalonForEditor']>>,
  ): SalonEditorPublishedPayload {
    return {
      overview: {
        name: salon.name,
        businessType: 'Friseursalon',
        tagline: salon.description?.slice(0, 140) ?? '',
        description: salon.description ?? '',
        phone: salon.phone ?? '',
        email: salon.email ?? '',
        website: salon.website ?? '',
        addressLine: salon.addressLine,
        city: salon.city,
        postalCode: salon.postalCode,
        openingHoursText: this.extractOpeningHoursText(salon.openingHoursJson),
        languages: [],
        amenities: [],
        parking: '',
        accessibility: '',
        paymentMethods: ['IN_SALON', 'CARD'] as EditorPaymentMethod[],
        bookingConfirmationMode: 'AUTO',
        foundedYear: null,
      },
      moreInfo: {
        about: salon.description ?? '',
        history: '',
        serviceDirections: [],
        rules: [],
        teamNote: '',
      },
      coverPhotoId: this.detectGoogleCoverUrl(salon) ? GOOGLE_COVER_SENTINEL : this.firstOwnPhotoId(salon.photos),
      googleCoverUrl: this.detectGoogleCoverUrl(salon),
      publishedAt: salon.updatedAt.toISOString(),
    };
  }

  private buildDraftFromSalon(
    salon: Awaited<ReturnType<SalonEditorService['getSalonForEditor']>>,
    published: SalonEditorPublishedPayload,
  ): SalonEditorDraftPayload {
    return {
      overview: published.overview,
      moreInfo: published.moreInfo,
      coverPhotoId: published.coverPhotoId,
      googleCoverUrl: published.googleCoverUrl ?? null,
      photos: salon.photos.map((photo) => ({
        id: photo.id,
        imageUrl: photo.imageUrl,
        sortOrder: photo.sortOrder,
      })),
      services: salon.services.map((service) => ({
        id: service.id,
        name: service.name,
        description: service.description ?? '',
        category: service.category,
        basePrice: Number(service.basePrice),
        durationMinutes: service.durationMinutes,
        availableInSalon: service.availableInSalon,
        availableAtHome: service.availableAtHome,
        isActive: service.isActive,
      })),
      staff: salon.masters.map((link) => ({
        id: link.masterId,
        displayName: link.master.displayName,
        specialization: link.master.specialization ?? '',
        biography: link.master.biography ?? '',
        experienceYears: link.master.experienceYears,
        acceptsHomeVisits: link.master.acceptsHomeVisits,
        currentStatus: link.master.currentStatus,
        avatarUrl: link.master.avatarUrl ?? '',
        serviceIds: link.master.services.map((item) => item.serviceId),
        schedules: link.master.schedules.map((schedule) => ({
          dayOfWeek: schedule.dayOfWeek,
          shiftStart: schedule.shiftStart,
          shiftEnd: schedule.shiftEnd,
          isDayOff: schedule.isDayOff,
          acceptsBookings: schedule.acceptsBookings,
          acceptsUrgentBookings: schedule.acceptsUrgentBookings,
          supportsHomeVisits: schedule.supportsHomeVisits,
          breaks: schedule.breaks.map((item) => ({
            startTime: item.startTime,
            endTime: item.endTime,
            reason: item.reason ?? '',
          })),
        })),
      })),
    };
  }

  private sanitizeDraft(
    draft: SalonEditorDraftPayload,
    salon: Awaited<ReturnType<SalonEditorService['getSalonForEditor']>>,
  ): SalonEditorDraftPayload {
    const activeServiceIds = new Set(salon.services.map((service) => service.id));
    const activeMasterIds = new Set(salon.masters.map((item) => item.masterId));

    return {
      overview: {
        ...draft.overview,
        name: draft.overview.name.trim(),
        businessType: draft.overview.businessType.trim(),
        tagline: draft.overview.tagline.trim(),
        description: draft.overview.description.trim(),
        phone: draft.overview.phone.trim(),
        email: draft.overview.email.trim(),
        website: draft.overview.website.trim(),
        addressLine: draft.overview.addressLine.trim(),
        city: draft.overview.city.trim(),
        postalCode: draft.overview.postalCode.trim(),
        openingHoursText: draft.overview.openingHoursText.trim(),
        languages: this.normalizeEntries(draft.overview.languages),
        amenities: this.normalizeEntries(draft.overview.amenities),
        parking: draft.overview.parking.trim(),
        accessibility: draft.overview.accessibility.trim(),
        paymentMethods: toEditorPaymentMethods(draft.overview.paymentMethods),
        bookingConfirmationMode:
          draft.overview.bookingConfirmationMode === 'REQUEST' ? 'REQUEST' : 'AUTO',
        foundedYear: draft.overview.foundedYear ?? null,
      },
      moreInfo: {
        about: draft.moreInfo.about.trim(),
        history: draft.moreInfo.history.trim(),
        serviceDirections: this.normalizeEntries(draft.moreInfo.serviceDirections),
        rules: this.normalizeEntries(draft.moreInfo.rules),
        teamNote: draft.moreInfo.teamNote.trim(),
      },
      photos: draft.photos
        .map((photo, index) => ({
          id: photo.id,
          imageUrl: photo.imageUrl.trim(),
          sortOrder: index,
        }))
        .filter((photo) => photo.imageUrl.length > 0),
      services: draft.services.map((service) => ({
        id: service.id && activeServiceIds.has(service.id) ? service.id : undefined,
        name: service.name.trim(),
        description: service.description?.trim() ?? '',
        category: service.category.trim(),
        basePrice: Number(service.basePrice),
        durationMinutes: Number(service.durationMinutes),
        availableInSalon: service.availableInSalon ?? true,
        availableAtHome: service.availableAtHome ?? false,
        isActive: service.isActive ?? true,
      })),
      staff: draft.staff.map((staff) => ({
        id: staff.id && activeMasterIds.has(staff.id) ? staff.id : undefined,
        displayName: staff.displayName.trim(),
        specialization: staff.specialization?.trim() ?? '',
        biography: staff.biography?.trim() ?? '',
        experienceYears: Number(staff.experienceYears ?? 0),
        acceptsHomeVisits: staff.acceptsHomeVisits ?? false,
        currentStatus: staff.currentStatus ?? MasterWorkStatus.AVAILABLE,
        avatarUrl: staff.avatarUrl?.trim() ?? '',
        serviceIds: [...new Set(staff.serviceIds)].filter(Boolean),
        schedules: (staff.schedules ?? []).map((schedule) => ({
          dayOfWeek: Number(schedule.dayOfWeek),
          shiftStart: schedule.shiftStart,
          shiftEnd: schedule.shiftEnd,
          isDayOff: schedule.isDayOff ?? false,
          acceptsBookings: schedule.acceptsBookings ?? true,
          acceptsUrgentBookings: schedule.acceptsUrgentBookings ?? true,
          supportsHomeVisits: schedule.supportsHomeVisits ?? false,
          breaks: (schedule.breaks ?? []).map((item) => ({
            startTime: item.startTime,
            endTime: item.endTime,
            reason: item.reason?.trim() ?? '',
          })),
        })),
      })),
      googleCoverUrl: (draft.googleCoverUrl ?? this.detectGoogleCoverUrl(salon))?.trim() || null,
      coverPhotoId: this.resolveCoverPhotoId(
        draft.coverPhotoId ?? null,
        draft.photos
          .map((photo, index) => ({
            id: photo.id,
            imageUrl: photo.imageUrl.trim(),
            sortOrder: index,
          }))
          .filter((photo) => photo.imageUrl.length > 0),
        (draft.googleCoverUrl ?? this.detectGoogleCoverUrl(salon))?.trim() || null,
      ),
    };
  }

  private validateDraft(draft: SalonEditorDraftPayload) {
    const issues: string[] = [];

    if (!draft.overview.name) issues.push('Salonname ist erforderlich.');
    if (!draft.overview.businessType) issues.push('Geschäftstyp ist erforderlich.');
    if (!draft.overview.addressLine) issues.push('Adresse ist erforderlich.');
    if (!draft.overview.city) issues.push('Stadt ist erforderlich.');
    if (!draft.overview.postalCode) issues.push('PLZ ist erforderlich.');
    if (draft.overview.paymentMethods.length === 0) issues.push('Mindestens eine Zahlungsart ist erforderlich.');
    if (draft.photos.length === 0 && !draft.googleCoverUrl) issues.push('Mindestens ein Foto ist erforderlich.');

    const activeServices = draft.services.filter((service) => service.isActive !== false && service.name);
    if (activeServices.length === 0) issues.push('Mindestens eine aktive Leistung ist erforderlich.');

    for (const service of activeServices) {
      if (Number.isNaN(service.basePrice) || service.basePrice < 0) {
        issues.push(`Leistung „${service.name || 'Ohne Name'}“ hat einen ungültigen Preis.`);
      }
      if (!Number.isInteger(service.durationMinutes) || service.durationMinutes <= 0) {
        issues.push(`Leistung „${service.name || 'Ohne Name'}“ hat eine ungültige Dauer.`);
      }
    }

    if (draft.staff.length === 0) issues.push('Mindestens ein Mitarbeiter ist erforderlich.');

    for (const staff of draft.staff) {
      if (!staff.displayName) issues.push('Jeder Mitarbeiter benötigt einen Namen.');
      if (staff.serviceIds.length === 0) issues.push(`Mitarbeiter „${staff.displayName || 'Ohne Name'}“ benötigt mindestens eine Leistung.`);
      if (staff.schedules.filter((schedule) => !schedule.isDayOff).length === 0) {
        issues.push(`Mitarbeiter „${staff.displayName || 'Ohne Name'}“ benötigt mindestens einen Arbeitstag.`);
      }
      for (const schedule of staff.schedules) {
        if (!schedule.isDayOff) {
          if (!/^\d{2}:\d{2}$/.test(schedule.shiftStart) || !/^\d{2}:\d{2}$/.test(schedule.shiftEnd)) {
            issues.push(`Zeitformat bei „${staff.displayName || 'Ohne Name'}“ ist ungültig.`);
          }
          if (schedule.shiftStart >= schedule.shiftEnd) {
            issues.push(`Schichtende muss nach Schichtbeginn liegen für „${staff.displayName || 'Ohne Name'}“.`);
          }
        }
      }
    }

    return [...new Set(issues)];
  }

  private normalizeEntries(items: string[]) {
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  }

  private paymentMethodsEqual(left: EditorPaymentMethod[], right: EditorPaymentMethod[]) {
    return left.length === right.length && left.every((item, index) => item === right[index]);
  }

  private isGooglePhotoUrl(url?: string | null) {
    return Boolean(url?.includes('/api/catalog/google-photo?'));
  }

  private detectGoogleCoverUrl(salon: Awaited<ReturnType<SalonEditorService['getSalonForEditor']>>) {
    return salon.photos.find((photo) => this.isGooglePhotoUrl(photo.imageUrl))?.imageUrl ?? null;
  }

  private firstOwnPhotoId(photos: Array<{ id: string; imageUrl: string }>) {
    return photos.find((photo) => !this.isGooglePhotoUrl(photo.imageUrl))?.id ?? null;
  }

  private resolveCoverPhotoId(
    desiredCoverPhotoId: string | null,
    photos: Array<{ id?: string; imageUrl: string }>,
    googleCoverUrl: string | null,
  ) {
    if (desiredCoverPhotoId === GOOGLE_COVER_SENTINEL && googleCoverUrl) {
      return GOOGLE_COVER_SENTINEL;
    }

    if (desiredCoverPhotoId && photos.some((photo) => photo.id === desiredCoverPhotoId)) {
      return desiredCoverPhotoId;
    }

    if (googleCoverUrl) {
      return GOOGLE_COVER_SENTINEL;
    }

    return photos.find((photo) => !this.isGooglePhotoUrl(photo.imageUrl))?.id ?? null;
  }

  private extractOpeningHoursText(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    const displayText = (value as Record<string, unknown>).displayText;
    return typeof displayText === 'string' ? displayText : '';
  }
}