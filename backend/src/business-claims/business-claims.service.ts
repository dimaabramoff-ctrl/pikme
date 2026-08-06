import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessClaimStatus,
  VerificationLevel,
  BusinessAccessCodeStatus,
  BusinessAccessCodeType,
  CatalogSourceType,
  PartnerSubscriptionPlan,
  PartnerSubscriptionSource,
  PartnerSubscriptionStatus,
  Role,
} from '@prisma/client';
import { CreateBusinessClaimDto } from './dto/create-business-claim.dto';
import { RequestTrialDto } from './dto/request-trial.dto';
import crypto from 'crypto';

@Injectable()
export class BusinessClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Создать запрос управления бизнесом
   */
  async createClaim(
    userId: string,
    dto: CreateBusinessClaimDto,
  ) {
    const actor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (actor?.role === Role.SUPER_ADMIN) {
      throw new BadRequestException(
        'SUPER_ADMIN must use admin tools instead of claim flow',
      );
    }

    const { salonId, googlePlaceId, factualSnapshot } = dto;

    const resolvedSalonId = salonId
      ?? (googlePlaceId
        ? await this.resolveOrCreateExternalSalon(googlePlaceId, factualSnapshot)
        : undefined);

    if (!resolvedSalonId && !googlePlaceId) {
      throw new BadRequestException(
        'Either salonId or googlePlaceId must be provided',
      );
    }

    // Проверить, что салон существует (если salonId)
    if (resolvedSalonId) {
      const salon = await this.prisma.salon.findUnique({
        where: { id: resolvedSalonId },
      });
      if (!salon) {
        throw new NotFoundException('Salon not found');
      }
    }

    // Проверить, что у пользователя нет активного claim для этого бизнеса
    if (resolvedSalonId) {
      const existingOwner = await this.prisma.businessClaim.findFirst({
        where: {
          salonId: resolvedSalonId,
          status: {
            in: [BusinessClaimStatus.APPROVED, BusinessClaimStatus.ACTIVE_TRIAL],
          },
        },
        select: { id: true, userId: true },
      });

      if (existingOwner && existingOwner.userId !== userId) {
        throw new ConflictException('This business already has an active owner');
      }

      const existingClaim = await this.prisma.businessClaim.findUnique({
        where: {
          userId_salonId: {
            userId,
            salonId: resolvedSalonId,
          },
        },
      });

      if (
        existingClaim &&
        existingClaim.status !== BusinessClaimStatus.REJECTED &&
        existingClaim.status !== BusinessClaimStatus.REVOKED
      ) {
        throw new ConflictException(
          'You already have an active claim for this salon',
        );
      }

      if (existingClaim) {
        const reopenedClaim = await this.prisma.businessClaim.update({
          where: { id: existingClaim.id },
          data: {
            googlePlaceId,
            status: BusinessClaimStatus.PENDING,
            verificationLevel: VerificationLevel.UNVERIFIED,
            activatedAt: null,
            revokedAt: null,
            revokeReason: null,
          },
          include: {
            salon: {
              select: {
                id: true,
                name: true,
                addressLine: true,
                city: true,
                externalPlaceId: true,
                externalProvider: true,
              },
            },
          },
        });

        await this.prisma.auditLog.create({
          data: {
            actorUserId: userId,
            action: 'BUSINESS_CLAIM_REQUESTED',
            entityType: 'BusinessClaim',
            entityId: reopenedClaim.id,
            payload: {
              salonId: resolvedSalonId,
              googlePlaceId,
              reopened: true,
            },
          },
        });

        return reopenedClaim;
      }
    }

    // Создать BusinessClaim
    const contactMeta = dto.contactName ? {
      contactName: dto.contactName,
      contactRole: dto.contactRole,
      contactEmail: dto.contactEmail,
      contactPhone: dto.contactPhone,
      preferredContactMethod: dto.preferredContactMethod,
      verificationMethod: dto.verificationMethod,
      message: dto.message,
    } as unknown as Prisma.InputJsonValue : undefined;

    const claim = await this.prisma.businessClaim.create({
      data: {
        userId,
        salonId: resolvedSalonId,
        googlePlaceId,
        status: BusinessClaimStatus.PENDING,
        verificationLevel: VerificationLevel.UNVERIFIED,
        ...(contactMeta ? { metadata: contactMeta } : {}),
      },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            addressLine: true,
            city: true,
            externalPlaceId: true,
            externalProvider: true,
          },
        },
      },
    });

    // Логировать в AuditLog
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'BUSINESS_CLAIM_REQUESTED',
        entityType: 'BusinessClaim',
        entityId: claim.id,
        payload: {
          salonId: resolvedSalonId,
          googlePlaceId,
        },
      },
    });

    return claim;
  }

  /**
   * Запросить Trial код (30 дней)
   */
  async requestTrial(
    userId: string,
    claimId: string,
    dto: RequestTrialDto,
  ) {
    // Получить claim
    const claim = await this.prisma.businessClaim.findUnique({
      where: { id: claimId },
      include: { user: true, salon: true },
    });

    if (!claim) {
      throw new NotFoundException('Business claim not found');
    }

    if (claim.userId !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    if (claim.status !== BusinessClaimStatus.APPROVED) {
      throw new ConflictException('Trial can only be activated after claim verification');
    }

    // Проверить, нет ли уже активного Trial для этого бизнеса
    const existingTrialCode = await this.prisma.businessAccessCode.findFirst({
      where: {
        type: BusinessAccessCodeType.TRIAL,
        status: {
          in: [BusinessAccessCodeStatus.ACTIVE, BusinessAccessCodeStatus.USED],
        },
        OR: [
          { targetSalonId: claim.salonId },
          { targetGooglePlaceId: claim.googlePlaceId },
        ],
      },
    });

    if (existingTrialCode) {
      throw new ConflictException(
        'A trial code already exists for this business',
      );
    }

    // Создать Trial код
    const code = this.generateAccessCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Trial-код действителен 30 дней

    const accessCode = await this.prisma.businessAccessCode.create({
      data: {
        codeHash,
        codePrefix: code.split('-').slice(0, 2).join('-'),
        targetSalonId: claim.salonId,
        targetGooglePlaceId: claim.googlePlaceId,
        assignedEmail: claim.user.email,
        durationDays: 30, // Trial период
        type: BusinessAccessCodeType.TRIAL,
        status: BusinessAccessCodeStatus.ACTIVE,
        maxRedemptions: 1,
        expiresAt,
        createdByUserId: userId, // Пользователь генерирует свой trial
        metadata: {
          requestedBy: userId,
          email: dto.email,
          businessName: claim.salon?.name,
        },
      },
    });

    // Обновить status claim
    await this.prisma.businessClaim.update({
      where: { id: claimId },
      data: { status: BusinessClaimStatus.CODE_ISSUED },
    });

    // Логировать
    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'BUSINESS_TRIAL_CODE_CREATED',
        entityType: 'BusinessAccessCode',
        entityId: accessCode.id,
        payload: {
          claimId,
          durationDays: 30,
        },
      },
    });

    await this.prisma.notification.createMany({
      data: [{
        userId,
        type: 'SALON_MESSAGE',
        title: 'Claim eingereicht',
        message: 'Ihre Unternehmensanfrage wurde gespeichert.',
        payload: { claimId: claim.id },
      }],
    });

    // Вернуть код пользователю (только в этот момент!)
    return {
      id: accessCode.id,
      code, // Полный код - показываем только один раз
      expiresAt: accessCode.expiresAt,
      durationDays: 30,
      businessName: claim.salon?.name,
      message: 'Your PickMe Trial is activated for 30 days',
    };
  }

  /**
   * SUPER_ADMIN: Get all claims for admin review
   */
  async getAllClaimsForAdmin() {
    return this.prisma.businessClaim.findMany({
      include: {
        user: { select: { id: true, email: true, role: true } },
        salon: { select: { id: true, name: true, addressLine: true, city: true, externalPlaceId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Owner: Activate trial directly after APPROVED claim (no code required)
   */
  async activateTrialDirect(userId: string, claimId: string) {
    const claim = await this.prisma.businessClaim.findUnique({
      where: { id: claimId },
      include: { user: true, salon: true },
    });

    if (!claim) {
      throw new NotFoundException('Business claim not found');
    }

    if (claim.userId !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    if (claim.status !== BusinessClaimStatus.APPROVED) {
      throw new ConflictException('Trial can only be activated after claim verification (APPROVED status required)');
    }

    if (!claim.salonId) {
      throw new BadRequestException('Claim has no linked salon');
    }

    // Check for existing trial subscription
    const existingTrial = await this.prisma.partnerSubscription.findFirst({
      where: {
        salonId: claim.salonId,
        plan: PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL,
      },
      select: { id: true, startsAt: true, endsAt: true },
    });

    if (existingTrial) {
      throw new ConflictException('A trial subscription already exists for this business');
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.partnerSubscription.create({
        data: {
          userId,
          salonId: claim.salonId!,
          plan: PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL,
          status: PartnerSubscriptionStatus.TRIAL,
          source: PartnerSubscriptionSource.MANUAL,
          startsAt: now,
          endsAt: trialEndsAt,
        },
      });

      await tx.businessClaim.update({
        where: { id: claimId },
        data: { status: BusinessClaimStatus.ACTIVE_TRIAL, activatedAt: now },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: 'PARTNER_TRIAL_ACTIVATED',
          entityType: 'PartnerSubscription',
          entityId: sub.id,
          payload: {
            claimId,
            salonId: claim.salonId,
            trialEndsAt: trialEndsAt.toISOString(),
            trialDays: 30,
          },
        },
      });

      await tx.notification.createMany({
        data: [{
          userId,
          type: 'SALON_MESSAGE',
          title: 'Trial aktiviert',
          message: 'Ihr PickMe Trial ist aktiv.',
          payload: { claimId, subscriptionId: sub.id, trialEndsAt: trialEndsAt.toISOString() },
        }],
      });

      return sub;
    });

    return {
      subscriptionId: subscription.id,
      salonId: claim.salonId,
      trialEndsAt: trialEndsAt.toISOString(),
      trialDays: 30,
      businessName: claim.salon?.name,
    };
  }

  /**
   * Получить все claims пользователя
   */
  async getMyBusinesses(userId: string) {
    return this.prisma.businessClaim.findMany({
      where: { userId },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            addressLine: true,
            city: true,
            externalPlaceId: true,
            externalProvider: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Получить один claim (для деталей)
   */
  async getBusinessClaim(userId: string, claimId: string) {
    const claim = await this.prisma.businessClaim.findUnique({
      where: { id: claimId },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            addressLine: true,
            city: true,
            externalPlaceId: true,
            externalProvider: true,
            sourceType: true,
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException('Business claim not found');
    }

    if (claim.userId !== userId) {
      throw new BadRequestException('Unauthorized');
    }

    return claim;
  }

  /**
   * SUPER_ADMIN: Одобрить claim
   */
  async approveClaim(adminId: string, claimId: string) {
    const claim = await this.prisma.businessClaim.findUnique({
      where: { id: claimId },
      include: { salon: true },
    });

    if (!claim) {
      throw new NotFoundException('Business claim not found');
    }

    if (!claim.salonId) {
      throw new BadRequestException('Claim has no linked salon');
    }

    const existingOwner = await this.prisma.businessClaim.findFirst({
      where: {
        salonId: claim.salonId,
        status: { in: [BusinessClaimStatus.APPROVED, BusinessClaimStatus.ACTIVE_TRIAL] },
        userId: { not: claim.userId },
      },
      select: { id: true },
    });

    if (existingOwner) {
      throw new ConflictException('This business already has an active owner');
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updatedClaim = await this.prisma.$transaction(async (tx) => {
      const claimRow = await tx.businessClaim.update({
        where: { id: claimId },
        data: {
          status: BusinessClaimStatus.APPROVED,
          verificationLevel: VerificationLevel.CONTACT_VERIFIED,
          activatedAt: now,
        },
        include: { user: true, salon: true },
      });

      await tx.salonAdmin.upsert({
        where: { userId_salonId: { userId: claim.userId, salonId: claim.salonId! } },
        update: { isActive: true, role: 'OWNER' },
        create: { userId: claim.userId, salonId: claim.salonId!, role: 'OWNER', isActive: true },
      });

      await tx.user.update({
        where: { id: claim.userId },
        data: { role: Role.SALON_OWNER },
      });

      await tx.partnerSubscription.create({
        data: {
          userId: claim.userId,
          salonId: claim.salonId!,
          plan: PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL,
          status: PartnerSubscriptionStatus.TRIAL,
          source: PartnerSubscriptionSource.MANUAL,
          startsAt: now,
          endsAt: trialEndsAt,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          targetUserId: claim.userId,
          action: 'BUSINESS_CLAIM_ACTIVATED',
          entityType: 'BusinessClaim',
          entityId: claimId,
          reason: 'Admin verification approved',
          payload: {
            salonId: claim.salonId,
            trialDays: 30,
            trialEndsAt: trialEndsAt.toISOString(),
          },
        },
      });

      await tx.notification.createMany({
        data: [{
          userId: claim.userId,
          type: 'SALON_MESSAGE',
          title: 'Claim genehmigt',
          message: 'Ihre Unternehmensanfrage wurde genehmigt.',
          payload: { claimId, salonId: claim.salonId, trialEndsAt: trialEndsAt.toISOString() },
        }],
      });

      return claimRow;
    });

    return updatedClaim;
  }

  /**
   * SUPER_ADMIN: Отклонить claim
   */
  async rejectClaim(adminId: string, claimId: string, reason?: string) {
    const claim = await this.prisma.businessClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException('Business claim not found');
    }

    const updatedClaim = await this.prisma.businessClaim.update({
      where: { id: claimId },
      data: {
        status: BusinessClaimStatus.REJECTED,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        targetUserId: claim.userId,
        action: 'BUSINESS_CLAIM_REJECTED',
        entityType: 'BusinessClaim',
        entityId: claimId,
        reason,
      },
    });

    await this.prisma.notification.createMany({
      data: [{
        userId: claim.userId,
        type: 'SALON_MESSAGE',
        title: 'Claim abgelehnt',
        message: reason || 'Ihre Unternehmensanfrage wurde abgelehnt.',
        payload: { claimId },
      }],
    });

    return updatedClaim;
  }

  /**
   * SUPER_ADMIN: Отозвать управление
   */
  async revokeClaim(adminId: string, claimId: string, reason?: string) {
    const claim = await this.prisma.businessClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new NotFoundException('Business claim not found');
    }

    const updatedClaim = await this.prisma.businessClaim.update({
      where: { id: claimId },
      data: {
        status: BusinessClaimStatus.REVOKED,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminId,
        targetUserId: claim.userId,
        action: 'BUSINESS_ACCESS_REVOKED',
        entityType: 'BusinessClaim',
        entityId: claimId,
        reason,
      },
    });

    await this.prisma.notification.createMany({
      data: [{
        userId: claim.userId,
        type: 'SALON_MESSAGE',
        title: 'Claim widerrufen',
        message: reason || 'Ihre Unternehmensanfrage wurde widerrufen.',
        payload: { claimId },
      }],
    });

    return updatedClaim;
  }

  /**
   * PM-TRIAL-XXXX-XXXX формат
   */
  private generateAccessCode(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';
    const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `PM-TRIAL-${rand(4)}-${rand(4)}`;
  }

  /**
   * Хешировать код перед сохранением
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async resolveOrCreateExternalSalon(
    googlePlaceId: string,
    factualSnapshot?: CreateBusinessClaimDto['factualSnapshot'],
  ) {
    const existingSalon = await this.prisma.salon.findFirst({
      where: { externalPlaceId: googlePlaceId },
      select: { id: true },
    });

    if (existingSalon) {
      return existingSalon.id;
    }

    const baseName = factualSnapshot?.name?.trim() || `Salon ${googlePlaceId.slice(0, 8)}`;
    const slugBase = `${this.slugify(baseName)}-${googlePlaceId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`;

    const createdSalon = await this.prisma.salon.create({
      data: {
        slug: slugBase,
        name: baseName,
        description: 'Externer Unternehmenseintrag auf PickMe. Weitere Inhalte werden nach der Verifizierung ergänzt.',
        addressLine: factualSnapshot?.address ?? 'Adresse wird ergänzt',
        addressLine1: factualSnapshot?.address ?? 'Adresse wird ergänzt',
        city: factualSnapshot?.city ?? 'Unbekannt',
        country: 'Germany',
        countryCode: 'DE',
        postalCode: '00000',
        latitude: factualSnapshot?.latitude ?? null,
        longitude: factualSnapshot?.longitude ?? null,
        sourceType: CatalogSourceType.EXTERNAL,
        externalProvider: 'GOOGLE_PLACES',
        externalPlaceId: googlePlaceId,
        isVerified: false,
        ratingAverage: 0,
        ratingCount: 0,
      },
      select: { id: true },
    });

    return createdSalon.id;
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
