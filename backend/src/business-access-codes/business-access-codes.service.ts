import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessAccessCodeStatus,
  BusinessAccessCodeType,
  BusinessClaimStatus,
  CatalogSourceType,
  Role,
  VerificationLevel,
  PartnerSubscriptionPlan,
  PartnerSubscriptionStatus,
  PartnerSubscriptionSource,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { CreateBusinessAccessCodeDto } from './dto/create-business-access-code.dto';
import { RedeemBusinessAccessCodeDto } from './dto/redeem-business-access-code.dto';
import { AuthService } from '../auth/auth.service';
import { ExternalPlacesProvider } from '../catalog-providers/external-places.provider';
import { buildEnrichedSalonPayload } from './salon-enrichment';

@Injectable()
export class BusinessAccessCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly externalPlacesProvider: ExternalPlacesProvider,
  ) {}

  /**
   * Создать код доступа (для Master Admin)
   */
  async createAccessCode(
    adminId: string,
    dto: CreateBusinessAccessCodeDto,
  ) {
    const {
      targetSalonId,
      targetGooglePlaceId,
      durationDays,
      type,
      assignedEmail,
      isOneTime,
      comment,
    } = dto;

    if (!targetSalonId && !targetGooglePlaceId) {
      throw new BadRequestException(
        'Either targetSalonId or targetGooglePlaceId must be provided',
      );
    }

    // Проверить, что salon существует
    if (targetSalonId) {
      const salon = await this.prisma.salon.findUnique({
        where: { id: targetSalonId },
      });
      if (!salon) {
        throw new NotFoundException('Target salon not found');
      }
    }

    // Сгенерировать код
    const code = this.generateCode(type as BusinessAccessCodeType, durationDays);
    const codeHash = this.hashCode(code);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Код активируется в течение 30 дней

    const accessCode = await this.prisma.businessAccessCode.create({
      data: {
        codeHash,
        codePrefix: code.split('-').slice(0, 2).join('-'), // PM-TRIAL или PM-6M
        targetSalonId,
        targetGooglePlaceId,
        assignedEmail,
        durationDays,
        type: type as BusinessAccessCodeType,
        status: BusinessAccessCodeStatus.ACTIVE,
        maxRedemptions: isOneTime ? 1 : 999,
        expiresAt,
        createdByUserId: adminId,
        metadata: {
          comment,
          createdByEmail: (await this.prisma.user.findUnique({
            where: { id: adminId },
          }))?.email,
        },
      },
    });

    // Логировать
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'BUSINESS_ACCESS_CODE_CREATED',
        entityType: 'BusinessAccessCode',
        entityId: accessCode.id,
        payload: {
          type,
          durationDays,
          targetSalonId,
          targetGooglePlaceId,
          assignedEmail,
        },
      },
    });

    return {
      id: accessCode.id,
      code, // Показать только при создании
      codePrefix: code.substring(0, 8),
      targetSalonId,
      targetGooglePlaceId,
      durationDays,
      type,
      expiresAt,
      maxRedemptions: isOneTime ? 1 : 999,
      createdAt: accessCode.createdAt,
    };
  }

  /**
   * Активировать код доступа
   */
  async redeemCode(
    userId: string,
    dto: RedeemBusinessAccessCodeDto,
    response?: Response,
  ) {
    const { code, salonId, googlePlaceId, factualSnapshot } = dto;

    // Хешировать вводимый код
    const codeHash = this.hashCode(code);

    // Найти код
    const accessCode = await this.prisma.businessAccessCode.findUnique({
      where: { codeHash },
      include: { targetSalon: true },
    });

    if (!accessCode) {
      throw new BadRequestException('Invalid access code');
    }

    // Если код уже использован — вернуть существующий доступ, не ошибку
    if (accessCode.status === BusinessAccessCodeStatus.USED) {
      const existingClaim = await this.prisma.businessClaim.findFirst({
        where: { userId, salonId: accessCode.targetSalonId ?? undefined },
        include: { salon: { select: { id: true, name: true } } },
      });
      if (existingClaim) {
        return {
          success: true,
          claimId: existingClaim.id,
          salonId: existingClaim.salonId,
          message: 'Dieser Code wurde bereits verwendet. Ihr bestehender Zugang ist aktiv.',
          alreadyUsed: true,
          role: 'SALON_OWNER',
          status: existingClaim.status,
          redirectTo: '/partner/onboarding',
        };
      }
      throw new BadRequestException('Dieser Code wurde bereits verwendet.');
    }

    if (accessCode.status !== BusinessAccessCodeStatus.ACTIVE) {
      throw new BadRequestException(
        `Access code is ${accessCode.status.toLowerCase()}`,
      );
    }

    // Проверить срок действия кода
    if (new Date() > accessCode.expiresAt) {
      throw new BadRequestException('Access code has expired');
    }

    // Проверить количество использований
    if (accessCode.redemptionCount >= accessCode.maxRedemptions) {
      throw new BadRequestException('Access code has been fully redeemed');
    }

    // Проверить, что код предназначен для этого бизнеса
    if (accessCode.targetSalonId && salonId !== accessCode.targetSalonId) {
      throw new BadRequestException('Access code is not valid for this salon');
    }

    if (
      accessCode.targetGooglePlaceId &&
      googlePlaceId !== accessCode.targetGooglePlaceId
    ) {
      throw new BadRequestException(
        'Access code is not valid for this business',
      );
    }

    // Resolve or auto-create internal Salon
    let targetSalonId = salonId || accessCode.targetSalonId;
    const effectiveGooglePlaceId = googlePlaceId || accessCode.targetGooglePlaceId;

    if (!targetSalonId && effectiveGooglePlaceId) {
      const existingByPlace = await this.prisma.salon.findFirst({
        where: { externalPlaceId: effectiveGooglePlaceId },
        select: { id: true },
      });

      if (existingByPlace) {
        targetSalonId = existingByPlace.id;
      } else {
        const slug = `place-${effectiveGooglePlaceId.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}-${randomUUID().slice(0, 6)}`;
        try {
          const created = await this.prisma.salon.create({
            data: {
              slug,
              name: factualSnapshot?.name ?? `Salon ${effectiveGooglePlaceId.slice(0, 8)}`,
              addressLine: factualSnapshot?.address ?? 'Adresse wird aktualisiert',
              city: factualSnapshot?.city ?? 'Unbekannt',
              country: 'Deutschland',
              postalCode: '00000',
              latitude: factualSnapshot?.latitude ?? null,
              longitude: factualSnapshot?.longitude ?? null,
              ratingAverage: factualSnapshot?.rating ?? 0,
              ratingCount: factualSnapshot?.reviewCount ?? 0,
              sourceType: CatalogSourceType.EXTERNAL,
              externalProvider: 'GOOGLE_PLACES',
              externalPlaceId: effectiveGooglePlaceId,
            },
            select: { id: true },
          });
          targetSalonId = created.id;
        } catch (e) {
          if ((e as Prisma.PrismaClientKnownRequestError).code === 'P2002') {
            const race = await this.prisma.salon.findFirst({
              where: { externalPlaceId: effectiveGooglePlaceId },
              select: { id: true },
            });
            if (race) targetSalonId = race.id;
          } else throw e;
        }
      }
    }

    if (!targetSalonId) {
      throw new BadRequestException('Salon konnte nicht gefunden oder erstellt werden.');
    }

    // Проверить, нет ли уже активного владельца этого бизнеса
    const existingActiveClaim = await this.prisma.businessClaim.findFirst({
      where: {
        salonId: targetSalonId,
        status: { in: [BusinessClaimStatus.ACTIVE_TRIAL, BusinessClaimStatus.APPROVED] },
      },
    });

    if (existingActiveClaim && existingActiveClaim.userId !== userId) {
      throw new ConflictException('This business is already claimed by another user');
    }

    const now = new Date();

    if (targetSalonId && effectiveGooglePlaceId) {
      await this.enrichSalonFromGooglePlaces(targetSalonId, effectiveGooglePlaceId, factualSnapshot);
    }

    // Атомарная транзакция: код + claim + membership + subscription
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Пометить код как использованный
      const updatedCode = await tx.businessAccessCode.update({
        where: { id: accessCode.id },
        data: {
          status: accessCode.maxRedemptions === 1 ? BusinessAccessCodeStatus.USED : BusinessAccessCodeStatus.ACTIVE,
          redemptionCount: accessCode.redemptionCount + 1,
          activatedByUserId: userId,
          activatedAt: now,
        },
      });

      // 2. Создать или обновить BusinessClaim
      const newClaimStatus = accessCode.type === BusinessAccessCodeType.TRIAL
        ? BusinessClaimStatus.ACTIVE_TRIAL
        : BusinessClaimStatus.APPROVED;

      const existingClaim = await tx.businessClaim.findFirst({
        where: { userId, salonId: targetSalonId },
      });

      const claim = existingClaim
        ? await tx.businessClaim.update({
            where: { id: existingClaim.id },
            data: { status: newClaimStatus, activatedAt: now,
              verificationLevel: accessCode.type === BusinessAccessCodeType.TRIAL
                ? VerificationLevel.UNVERIFIED : VerificationLevel.CONTACT_VERIFIED },
            include: { salon: { select: { id: true, name: true, addressLine: true } } },
          })
        : await tx.businessClaim.create({
            data: { userId, salonId: targetSalonId, googlePlaceId, status: newClaimStatus,
              verificationLevel: VerificationLevel.UNVERIFIED, activatedAt: now },
            include: { salon: { select: { id: true, name: true, addressLine: true } } },
          });

      // 3. Создать SalonAdmin membership (OWNER) если не существует
      await tx.salonAdmin.upsert({
        where: { userId_salonId: { userId, salonId: targetSalonId } },
        update: { isActive: true, role: 'OWNER' },
        create: { userId, salonId: targetSalonId, role: 'OWNER', isActive: true },
      });

      // 4. Обновить роль пользователя на SALON_OWNER
      await tx.user.update({
        where: { id: userId },
        data: { role: 'SALON_OWNER' },
      });

      // 5. Создать или продлить PartnerSubscription
      const existingSub = await tx.partnerSubscription.findFirst({
        where: { userId, salonId: targetSalonId, status: { in: [PartnerSubscriptionStatus.TRIAL, PartnerSubscriptionStatus.ACTIVE] } },
        orderBy: { endsAt: 'desc' },
      });
      const baseDate = existingSub && existingSub.endsAt > now ? existingSub.endsAt : now;
      const newEndAt = new Date(baseDate.getTime() + accessCode.durationDays * 24 * 60 * 60 * 1000);

      if (existingSub) {
        await tx.partnerSubscription.update({
          where: { id: existingSub.id },
          data: { endsAt: newEndAt, status: PartnerSubscriptionStatus.ACTIVE },
        });
      } else {
        await tx.partnerSubscription.create({
          data: {
            userId,
            salonId: targetSalonId,
            plan: accessCode.type === BusinessAccessCodeType.TRIAL
              ? PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL
              : PartnerSubscriptionPlan.PICKME_PARTNER_MONTHLY,
            status: accessCode.type === BusinessAccessCodeType.TRIAL
              ? PartnerSubscriptionStatus.TRIAL
              : PartnerSubscriptionStatus.ACTIVE,
            source: PartnerSubscriptionSource.VOUCHER,
            startsAt: now,
            endsAt: newEndAt,
          },
        });
      }

      // 6. AuditLog
      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'BUSINESS_ACCESS_CODE_REDEEMED',
          entityType: 'BusinessAccessCode',
          entityId: updatedCode.id,
          payload: { claimId: claim.id, salonId: targetSalonId, codeType: accessCode.type, durationDays: accessCode.durationDays, endsAt: newEndAt.toISOString() },
        },
      });

      return { claim, newEndAt };
    });

    const message = accessCode.type === BusinessAccessCodeType.TRIAL
      ? `Your PickMe Trial is activated for ${accessCode.durationDays} days`
      : `Access to ${result.claim.salon?.name} is activated`;

    // Issue new tokens with SALON_OWNER role so JWT is in sync with DB
    const tokens = await this.authService.issueSessionPublic(userId, Role.SALON_OWNER);
    if (response) {
      this.authService.setRefreshCookiePublic(response, tokens.refreshToken);
    }

    return {
      success: true,
      claimId: result.claim.id,
      salonId: targetSalonId,
      message,
      businessName: result.claim.salon?.name,
      role: 'SALON_OWNER',
      accessToken: tokens.accessToken,
      status: accessCode.type === BusinessAccessCodeType.TRIAL ? 'ACTIVE_TRIAL' : 'APPROVED',
      trialDays: accessCode.type === BusinessAccessCodeType.TRIAL ? accessCode.durationDays : undefined,
      subscriptionEndsAt: result.newEndAt.toISOString(),
      redirectTo: '/partner/onboarding',
    };
  }

  private async enrichSalonFromGooglePlaces(
    salonId: string,
    googlePlaceId: string,
    factualSnapshot?: { name?: string; address?: string; city?: string; latitude?: number | null; longitude?: number | null; photo?: string | null; rating?: number | null; reviewCount?: number | null },
  ) {
    const salon = await this.prisma.salon.findUnique({
      where: { id: salonId },
      select: {
        id: true,
        name: true,
        addressLine: true,
        city: true,
        country: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        website: true,
        phone: true,
        ratingAverage: true,
        ratingCount: true,
        externalProvider: true,
        externalPlaceId: true,
      },
    });

    if (!salon) return;

    try {
      const details = await this.externalPlacesProvider.getGooglePlaceDetails(googlePlaceId);
      const enrichedData = buildEnrichedSalonPayload({
        existingSalon: {
          name: salon.name,
          addressLine: salon.addressLine,
          city: salon.city,
          country: salon.country,
          postalCode: salon.postalCode,
          latitude: salon.latitude,
          longitude: salon.longitude,
          website: salon.website,
          phone: salon.phone,
          ratingAverage: salon.ratingAverage,
          ratingCount: salon.ratingCount,
        },
        details,
        factualSnapshot,
      });

      const safeUpdateData: Prisma.SalonUpdateInput = {
        name: enrichedData.name ?? undefined,
        addressLine: enrichedData.addressLine ?? undefined,
        city: enrichedData.city ?? undefined,
        country: enrichedData.country ?? undefined,
        postalCode: enrichedData.postalCode ?? undefined,
        latitude: enrichedData.latitude ?? undefined,
        longitude: enrichedData.longitude ?? undefined,
        phone: enrichedData.phone ?? undefined,
        website: enrichedData.website ?? undefined,
        ratingAverage: enrichedData.ratingAverage ?? undefined,
        ratingCount: enrichedData.ratingCount ?? undefined,
        externalProvider: 'GOOGLE_PLACES',
        externalPlaceId: googlePlaceId,
      };

      await this.prisma.salon.update({
        where: { id: salonId },
        data: safeUpdateData,
      });

      if (details.photoReferences.length > 0) {
        const existingPhotos = await this.prisma.salonPhoto.findMany({ where: { salonId }, select: { id: true, imageUrl: true } });
        if (existingPhotos.length === 0) {
          await this.prisma.salonPhoto.createMany({
            data: details.photoReferences.slice(0, 4).map((photoRef, index) => ({
              salonId,
              imageUrl: `/api/catalog/google-photo?name=${encodeURIComponent(photoRef)}&maxHeight=800`,
              sortOrder: index,
            })),
          });
        }
      }
    } catch {
      const fallbackData: Prisma.SalonUpdateInput = {
        name: salon.name || factualSnapshot?.name || `Salon ${googlePlaceId.slice(0, 8)}`,
        addressLine: salon.addressLine || factualSnapshot?.address || 'Adresse wird aktualisiert',
        city: salon.city || factualSnapshot?.city || 'Unbekannt',
        latitude: salon.latitude ?? factualSnapshot?.latitude ?? null,
        longitude: salon.longitude ?? factualSnapshot?.longitude ?? null,
        ratingAverage: salon.ratingAverage > 0 ? salon.ratingAverage : (factualSnapshot?.rating ?? salon.ratingAverage),
        ratingCount: salon.ratingCount > 0 ? salon.ratingCount : (factualSnapshot?.reviewCount ?? salon.ratingCount),
        externalProvider: 'GOOGLE_PLACES',
        externalPlaceId: googlePlaceId,
      };

      await this.prisma.salon.update({
        where: { id: salonId },
        data: fallbackData,
      });
    }
  }

  /**
   * Отозвать код доступа
   */
  async revokeCode(adminId: string, codeId: string, reason?: string) {
    const code = await this.prisma.businessAccessCode.findUnique({
      where: { id: codeId },
    });

    if (!code) {
      throw new NotFoundException('Access code not found');
    }

    const updatedCode = await this.prisma.businessAccessCode.update({
      where: { id: codeId },
      data: {
        status: BusinessAccessCodeStatus.REVOKED,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        action: 'BUSINESS_ACCESS_CODE_REVOKED',
        entityType: 'BusinessAccessCode',
        entityId: codeId,
        reason,
      },
    });

    return updatedCode;
  }

  /**
   * Список кодов (для Admin — все коды)
   */
  async listCodes(
    filters?: {
      targetSalonId?: string;
      status?: BusinessAccessCodeStatus;
      type?: BusinessAccessCodeType;
    },
  ) {
    return this.prisma.businessAccessCode.findMany({
      where: {
        ...(filters?.targetSalonId ? { targetSalonId: filters.targetSalonId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
      },
      include: {
        createdBy: { select: { id: true, email: true } },
        activatedBy: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Генерировать читаемый код формата PM-{TYPE}-XXXX-XXXX
   */
  private generateCode(type?: BusinessAccessCodeType, durationDays?: number): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'; // без O,0,1,I для читаемости
    const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    let prefix = 'PM';
    if (type === BusinessAccessCodeType.TRIAL) prefix = 'PM-TRIAL';
    else if (durationDays === 30) prefix = 'PM-1M';
    else if (durationDays === 180) prefix = 'PM-6M';
    else if (durationDays === 365) prefix = 'PM-12M';
    else if (durationDays) prefix = `PM-${durationDays}D`;
    return `${prefix}-${rand(4)}-${rand(4)}`;
  }

  /**
   * Хешировать код
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }
}
