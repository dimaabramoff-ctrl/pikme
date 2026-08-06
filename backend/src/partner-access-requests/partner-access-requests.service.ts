import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, PartnerAccessRequestStatus, PartnerAccessRequestDuration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { CreatePartnerAccessRequestDto, UpdatePartnerAccessRequestStatusDto } from './dto/create-partner-access-request.dto';

@Injectable()
export class PartnerAccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchersService: VouchersService,
  ) {}

  async create(dto: CreatePartnerAccessRequestDto, actorUserId?: string) {
    const existing = await this.prisma.partnerAccessRequest.findFirst({
      where: {
        email: dto.email,
        status: { not: PartnerAccessRequestStatus.REJECTED },
      },
    });

    if (existing) {
      throw new BadRequestException('A request for this email already exists.');
    }

    const data: Prisma.PartnerAccessRequestCreateInput = {
      contactName: dto.contactName,
      salonName: dto.salonName,
      city: dto.city,
      phone: dto.phone,
      email: dto.email,
      message: dto.message ?? null,
      requestedDuration: dto.requestedDuration,
      googlePlaceId: dto.googlePlaceId ?? null,
      metadata: {
        source: 'public-form',
        existingUserId: dto.existingUserId ?? null,
        existingSalonId: dto.existingSalonId ?? null,
      },
      ...(actorUserId ? { user: { connect: { id: actorUserId } } } : {}),
    };

    const request = await this.prisma.partnerAccessRequest.create({
      data,
      include: { user: true, assignedAdmin: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorUserId,
        action: 'PARTNER_ACCESS_REQUEST_CREATED',
        entityType: 'PartnerAccessRequest',
        entityId: request.id,
        requestId: request.id,
        before: undefined,
        after: { status: request.status, email: request.email },
        reason: 'Partner access request created',
      },
    });

    return this.formatRequest(request);
  }

  async listForAdmin() {
    const requests = await this.prisma.partnerAccessRequest.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: { user: true, assignedAdmin: true },
    });

    return requests.map((request) => this.formatRequest(request));
  }

  async getById(id: string) {
    const request = await this.prisma.partnerAccessRequest.findUnique({
      where: { id },
      include: { user: true, assignedAdmin: true },
    });

    if (!request) {
      throw new NotFoundException('Partner access request not found');
    }

    return this.formatRequest(request);
  }

  async updateStatus(id: string, dto: UpdatePartnerAccessRequestStatusDto, actorUserId: string) {
    const request = await this.prisma.partnerAccessRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Partner access request not found');
    }

    const previousStatus = request.status;
    const now = new Date();

    const updateData: Prisma.PartnerAccessRequestUpdateInput = {
      status: dto.status,
      assignedAdmin: { connect: { id: actorUserId } },
      metadata: {
        ...(request.metadata as Record<string, unknown> | null),
        lastDecision: dto.reason ?? null,
      } as Prisma.InputJsonValue,
    };

    if (dto.status === PartnerAccessRequestStatus.CONTACTED) {
      updateData.contactedAt = now;
    } else if (dto.status === PartnerAccessRequestStatus.APPROVED) {
      updateData.approvedAt = now;
      updateData.contactedAt = now;
    } else if (dto.status === PartnerAccessRequestStatus.REJECTED) {
      updateData.rejectedAt = now;
      updateData.contactedAt = now;
    } else if (dto.status === PartnerAccessRequestStatus.CODE_SENT) {
      updateData.codeSentAt = now;
    } else if (dto.status === PartnerAccessRequestStatus.ACTIVATED) {
      updateData.activatedAt = now;
    }

    const updated = await this.prisma.partnerAccessRequest.update({
      where: { id },
      data: updateData,
      include: { user: true, assignedAdmin: true },
    });

    const action = this.mapStatusAction(dto.status);
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        requestId: updated.id,
        action,
        entityType: 'PartnerAccessRequest',
        entityId: updated.id,
        before: { status: previousStatus },
        after: { status: dto.status },
        reason: dto.reason,
      },
    });

    return this.getById(updated.id);
  }

  async createAccessCodeForRequest(requestId: string, actorUserId: string) {
    const request = await this.prisma.partnerAccessRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException('Partner access request not found');
    }

    if (request.status === PartnerAccessRequestStatus.REJECTED) {
      throw new BadRequestException('Rejected requests cannot receive access codes');
    }

    const code = await this.vouchersService.generateOne(
      actorUserId,
      {
        type: this.mapDurationToVoucherType(request.requestedDuration),
        valueAmount: 0,
        currency: 'EUR',
        durationDays: this.resolveRequestDurationDays(request.requestedDuration),
        maxRedemptions: 1,
        metadata: {
          requestId,
          partnerEmail: request.email,
          salonName: request.salonName,
          requestedDuration: request.requestedDuration,
        },
      },
    );

    await this.prisma.partnerAccessRequest.update({
      where: { id: requestId },
      data: {
        status: PartnerAccessRequestStatus.CODE_SENT,
        codeSentAt: new Date(),
        metadata: {
          ...(request.metadata as Record<string, unknown> | null),
          accessCodeId: code.id,
          accessCode: code.fullCode,
        } as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        requestId,
        action: 'ACCESS_CODE_CREATED_FROM_REQUEST',
        entityType: 'PartnerAccessRequest',
        entityId: requestId,
        before: { status: request.status },
        after: { status: PartnerAccessRequestStatus.CODE_SENT },
        reason: 'Access code created from partner request',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        requestId,
        action: 'ACCESS_CODE_SENT',
        entityType: 'PartnerAccessRequest',
        entityId: requestId,
        before: { status: request.status },
        after: { status: PartnerAccessRequestStatus.CODE_SENT },
        reason: 'Access code sent to partner',
      },
    });

    return { code: code.fullCode, voucherId: code.id };
  }

  async markActivated(id: string) {
    const request = await this.prisma.partnerAccessRequest.findUnique({ where: { id } });
    if (!request) {
      throw new NotFoundException('Partner access request not found');
    }

    const updated = await this.prisma.partnerAccessRequest.update({
      where: { id },
      data: {
        status: PartnerAccessRequestStatus.ACTIVATED,
        activatedAt: new Date(),
      },
      include: { user: true, assignedAdmin: true },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'PARTNER_ACCESS_REQUEST_ACTIVATED',
        entityType: 'PartnerAccessRequest',
        entityId: updated.id,
        requestId: updated.id,
        before: { status: request.status },
        after: { status: updated.status },
      },
    });

    return this.formatRequest(updated);
  }

  private mapStatusAction(status: PartnerAccessRequestStatus) {
    switch (status) {
      case PartnerAccessRequestStatus.CONTACTED:
        return 'PARTNER_ACCESS_REQUEST_CONTACTED';
      case PartnerAccessRequestStatus.APPROVED:
        return 'PARTNER_ACCESS_REQUEST_APPROVED';
      case PartnerAccessRequestStatus.REJECTED:
        return 'PARTNER_ACCESS_REQUEST_REJECTED';
      case PartnerAccessRequestStatus.CODE_SENT:
        return 'ACCESS_CODE_SENT';
      case PartnerAccessRequestStatus.ACTIVATED:
        return 'PARTNER_ACCESS_REQUEST_ACTIVATED';
      default:
        return 'PARTNER_ACCESS_REQUEST_STATUS_CHANGED';
    }
  }

  private resolveRequestDurationDays(duration: PartnerAccessRequestDuration) {
    switch (duration) {
      case PartnerAccessRequestDuration.HOUR:
        return 1;
      case PartnerAccessRequestDuration.DAY:
        return 1;
      case PartnerAccessRequestDuration.MONTH:
        return 30;
      case PartnerAccessRequestDuration.THREE_MONTHS:
        return 90;
      case PartnerAccessRequestDuration.SIX_MONTHS:
        return 180;
      case PartnerAccessRequestDuration.YEAR:
        return 365;
      case PartnerAccessRequestDuration.TRIAL:
        return 14;
      default:
        return 30;
    }
  }

  private mapDurationToVoucherType(duration: PartnerAccessRequestDuration) {
    if (duration === PartnerAccessRequestDuration.TRIAL) {
      return 'PROMO_TRIAL';
    }

    return 'PARTNER_MONTH';
  }

  private formatRequest(request: Prisma.PartnerAccessRequestGetPayload<{ include: { assignedAdmin: true; user: true } }>) {
    return {
      id: request.id,
      contactName: request.contactName,
      salonName: request.salonName,
      city: request.city,
      phone: request.phone,
      email: request.email,
      message: request.message,
      requestedDuration: request.requestedDuration,
      googlePlaceId: request.googlePlaceId,
      status: request.status,
      assignedAdminId: request.assignedAdminId,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      contactedAt: request.contactedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      codeSentAt: request.codeSentAt,
      activatedAt: request.activatedAt,
      metadata: request.metadata,
      assignedAdmin: request.assignedAdmin
        ? {
            id: request.assignedAdmin.id,
            email: request.assignedAdmin.email,
          }
        : null,
      user: request.user
        ? {
            id: request.user.id,
            email: request.user.email,
          }
        : null,
    };
  }
}
