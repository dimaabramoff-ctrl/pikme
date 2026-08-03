import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
