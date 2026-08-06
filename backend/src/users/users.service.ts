import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, Role, User } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { buildApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

type AdminModerationAction =
  | 'suspend'
  | 'reactivate'
  | 'revoke-sessions'
  | 'remove-salon-membership';

export interface AdminUserSummary {
  id: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  accountStatus: AccountStatus;
  accountStatusReason: string | null;
  accountStatusUpdatedAt: string | null;
  deletionRequestedAt: string | null;
  anonymizedAt: string | null;
  lastActivityAt: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  customerProfile: { firstName?: string; lastName?: string } | null;
  masterProfile: { displayName?: string } | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAdmin(): Promise<AdminUserSummary[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customerProfile: true,
        masterProfile: true,
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      accountStatus: user.accountStatus,
      accountStatusReason: user.accountStatusReason ?? null,
      accountStatusUpdatedAt: user.accountStatusUpdatedAt?.toISOString() ?? null,
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
      anonymizedAt: user.anonymizedAt?.toISOString() ?? null,
      lastActivityAt: user.lastActivityAt?.toISOString() ?? null,
      isVerified: user.isVerified,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      customerProfile: user.customerProfile
        ? {
            firstName: user.customerProfile.firstName,
            lastName: user.customerProfile.lastName,
          }
        : null,
      masterProfile: user.masterProfile
        ? { displayName: user.masterProfile.displayName }
        : null,
    }));
  }

  async moderateUser(
    actorUserId: string,
    targetUserId: string,
    action: string,
    reason?: string,
  ) {
    const normalizedAction = action.trim().toLowerCase() as AdminModerationAction;
    if (!['suspend', 'reactivate', 'revoke-sessions', 'remove-salon-membership'].includes(normalizedAction)) {
      throw new BadRequestException(
        buildApiError(400, 'INVALID_MODERATION_ACTION', 'Unsupported moderation action.'),
      );
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new NotFoundException(
        buildApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден.'),
      );
    }

    const now = new Date();

    if (normalizedAction === 'suspend') {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            isActive: false,
            accountStatus: AccountStatus.SUSPENDED,
            accountStatusReason: reason ?? 'Suspended by admin',
            accountStatusUpdatedAt: now,
          },
        });

        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: now },
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: 'USER_SUSPENDED',
            entityType: 'User',
            entityId: targetUserId,
            reason: reason ?? 'Suspended by admin',
          },
        });
      });

      return { success: true };
    }

    if (normalizedAction === 'reactivate') {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: {
          isActive: true,
          accountStatus: AccountStatus.ACTIVE,
          accountStatusReason: reason ?? null,
          accountStatusUpdatedAt: now,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          action: 'USER_REACTIVATED',
          entityType: 'User',
          entityId: targetUserId,
          reason: reason ?? 'Reactivated by admin',
        },
      });

      return { success: true };
    }

    if (normalizedAction === 'revoke-sessions') {
      await this.prisma.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: now },
      });

      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          action: 'USER_SESSIONS_REVOKED',
          entityType: 'User',
          entityId: targetUserId,
          reason: reason ?? 'Sessions revoked by admin',
        },
      });

      return { success: true };
    }

    await this.prisma.salonAdmin.updateMany({
      where: { userId: targetUserId, isActive: true },
      data: { isActive: false },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'USER_SALON_MEMBERSHIP_REMOVED',
        entityType: 'User',
        entityId: targetUserId,
        reason: reason ?? 'Salon membership removed by admin',
      },
    });

    return { success: true };
  }

  async changeRole(
    actorUserId: string,
    targetUserId: string,
    role?: Role,
    reason?: string,
  ) {
    if (!role || !Object.values(Role).includes(role)) {
      throw new BadRequestException(
        buildApiError(400, 'INVALID_ROLE', 'Invalid role.'),
      );
    }

    const previous = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });

    if (!previous) {
      throw new NotFoundException(
        buildApiError(404, 'USER_NOT_FOUND', 'Пользователь не найден.'),
      );
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: targetUserId,
        before: { role: previous.role },
        after: { role },
        reason: reason ?? 'Role changed by admin',
      },
    });

    return { success: true };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findByEmailOrPhone(emailOrPhone: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
      },
      include: {
        customerProfile: true,
        masterProfile: true,
        salonAdmins: true,
      },
    });
  }

  async findAuthUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: true,
        masterProfile: true,
        salonAdmins: true,
      },
    });

    if (!user) {
      return null;
    }

    return this.toAuthenticatedUser(user);
  }

  async getProfileByUserId(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        customerProfile: true,
        masterProfile: true,
        salonAdmins: {
          include: {
            salon: true,
          },
        },
      },
    });
  }

  toAuthenticatedUser(
    user: User & {
      customerProfile?: { firstName: string; lastName: string } | null;
      masterProfile?: { displayName: string } | null;
      salonAdmins?: Array<{ id: string }>;
    },
  ): AuthenticatedUser {
    return {
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      isVerified: user.isVerified,
      name: this.resolveName(user),
    };
  }

  private resolveName(
    user: User & {
      customerProfile?: { firstName: string; lastName: string } | null;
      masterProfile?: { displayName: string } | null;
    },
  ) {
    if (user.masterProfile?.displayName) {
      return user.masterProfile.displayName;
    }

    if (user.customerProfile) {
      return `${user.customerProfile.firstName} ${user.customerProfile.lastName}`.trim();
    }

    return user.email;
  }

  hasRole(userRole: Role, target: Role) {
    return userRole === target;
  }
}
