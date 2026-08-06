import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { Response } from 'express';
import { buildApiError } from '../common/api-error';
import { normalizeEntries } from '../common/normalize-entries';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterMasterDto } from './dto/register-master.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async registerCustomer(dto: RegisterCustomerDto) {
    this.ensurePasswordMatch(dto.password, dto.passwordConfirmation);
    this.ensureStrongPassword(dto.password);

    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizePhone(dto.phone);
    const normalizedName = this.normalizeName(dto.name);

    await this.ensureUniqueEmailPhone(email, phone);

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash,
          role: Role.CUSTOMER,
          isVerified: true,
        },
      });

      await tx.customerProfile.create({
        data: {
          userId: createdUser.id,
          firstName: normalizedName,
          lastName: '',
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: createdUser.id,
          action: 'REGISTER_CUSTOMER_SUCCESS',
          entityType: 'AUTH',
          entityId: createdUser.id,
        },
      });

      return createdUser;
    });

    return this.usersService.findAuthUserById(user.id);
  }

  async registerMaster(dto: RegisterMasterDto) {
    this.ensurePasswordMatch(dto.password, dto.passwordConfirmation);
    this.ensureStrongPassword(dto.password);

    const email = this.normalizeEmail(dto.email);
    const phone = this.normalizePhone(dto.phone);
    const normalizedName = this.normalizeName(dto.name);
    const specialization = normalizeEntries([dto.specialization])[0] ?? '';

    await this.ensureUniqueEmailPhone(email, phone);

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash,
          role: Role.MASTER,
          isVerified: false,
        },
      });

      await tx.masterProfile.create({
        data: {
          userId: createdUser.id,
          displayName: normalizedName,
          specialization,
          experienceYears: dto.experienceYears,
          acceptsHomeVisits: dto.acceptsHomeVisits,
          isIndependent: dto.independent,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: createdUser.id,
          action: 'REGISTER_MASTER_SUCCESS',
          entityType: 'AUTH',
          entityId: createdUser.id,
        },
      });

      return createdUser;
    });

    return this.usersService.findAuthUserById(user.id);
  }

  async login(dto: LoginDto, response: Response) {
    const normalizedLogin = this.normalizeLogin(dto.emailOrPhone);
    const user = await this.usersService.findByEmailOrPhone(normalizedLogin);

    if (!user) {
      await this.prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          entityId: normalizedLogin,
        },
      });
      throw new UnauthorizedException(
        buildApiError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль.'),
      );
    }

    const isValidPassword = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isValidPassword) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          entityId: user.id,
        },
      });
      throw new UnauthorizedException(
        buildApiError(401, 'INVALID_CREDENTIALS', 'Неверный логин или пароль.'),
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        buildApiError(401, 'ACCOUNT_DISABLED', 'Аккаунт отключен.'),
      );
    }

    const tokens = await this.issueSession(user.id, user.role);
    this.setRefreshCookie(response, tokens.refreshToken);

    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'AUTH',
        entityId: user.id,
      },
    });

    return {
      user: this.usersService.toAuthenticatedUser(user),
      accessToken: tokens.accessToken,
    };
  }

  async refresh(
    dto: RefreshTokenDto,
    cookieToken: string | undefined,
    response: Response,
  ) {
    const incomingToken = dto.refreshToken ?? cookieToken;

    if (!incomingToken) {
      throw new UnauthorizedException(
        buildApiError(
          401,
          'REFRESH_TOKEN_INVALID',
          'Недействительный refresh token.',
        ),
      );
    }

    const payload = await this.verifyRefreshToken(incomingToken);
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!session) {
      throw new UnauthorizedException(
        buildApiError(
          401,
          'REFRESH_TOKEN_INVALID',
          'Недействительный refresh token.',
        ),
      );
    }

    if (session.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.prisma.auditLog.create({
        data: {
          actorUserId: session.userId,
          action: 'REFRESH_TOKEN_REUSE_DETECTED',
          entityType: 'AUTH',
          entityId: session.id,
        },
      });

      throw new UnauthorizedException(
        buildApiError(
          401,
          'REFRESH_TOKEN_REUSED',
          'Refresh token уже использован.',
        ),
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        buildApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token истек.'),
      );
    }

    const hashMatches = await argon2.verify(session.tokenHash, incomingToken);
    if (!hashMatches) {
      throw new UnauthorizedException(
        buildApiError(
          401,
          'REFRESH_TOKEN_INVALID',
          'Недействительный refresh token.',
        ),
      );
    }

    const user = await this.usersService.findAuthUserById(session.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        buildApiError(401, 'ACCOUNT_DISABLED', 'Аккаунт отключен.'),
      );
    }

    const tokens = await this.rotateSession(
      session.id,
      session.familyId,
      user.id,
      user.role,
    );
    this.setRefreshCookie(response, tokens.refreshToken);

    return {
      user,
      accessToken: tokens.accessToken,
    };
  }

  async logout(cookieToken: string | undefined, response: Response) {
    if (cookieToken) {
      try {
        const payload = await this.verifyRefreshToken(cookieToken);
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await this.prisma.auditLog.create({
          data: {
            actorUserId: payload.sub,
            action: 'LOGOUT',
            entityType: 'AUTH',
            entityId: payload.jti,
          },
        });
      } catch {
        // Return success even if token is missing or invalid.
      }
    }

    this.clearRefreshCookie(response);

    return { success: true };
  }

  async logoutAll(userId: string, response: Response) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'LOGOUT_ALL',
        entityType: 'AUTH',
        entityId: userId,
      },
    });

    this.clearRefreshCookie(response);

    return { success: true };
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    this.ensurePasswordMatch(dto.newPassword, dto.newPasswordConfirmation);
    this.ensureStrongPassword(dto.newPassword);

    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!current) {
      throw new UnauthorizedException(
        buildApiError(401, 'UNAUTHORIZED', 'Требуется авторизация.'),
      );
    }

    const currentPasswordValid = await argon2.verify(
      current.passwordHash,
      dto.currentPassword,
    );
    if (!currentPasswordValid) {
      throw new UnauthorizedException(
        buildApiError(
          401,
          'CURRENT_PASSWORD_INVALID',
          'Текущий пароль неверный.',
        ),
      );
    }

    const nextHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: nextHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'PASSWORD_CHANGED',
          entityType: 'AUTH',
          entityId: user.id,
        },
      });
    });

    return { success: true };
  }

  async me(userId: string) {
    const profile = await this.usersService.getProfileByUserId(userId);
    if (!profile) {
      throw new UnauthorizedException(
        buildApiError(401, 'UNAUTHORIZED', 'Требуется авторизация.'),
      );
    }

    const authUser = this.usersService.toAuthenticatedUser(profile);

    return {
      ...authUser,
      customerProfile: profile.customerProfile,
      masterProfile: profile.masterProfile,
      salonAdminProfile: profile.salonAdmins,
    };
  }

  private async issueSession(userId: string, role: Role) {
    const familyId = randomUUID();
    return this.rotateSession(null, familyId, userId, role);
  }

  /** Issue fresh tokens for a user whose role just changed (e.g. after redeem) */
  async issueSessionPublic(userId: string, role: Role) {
    return this.issueSession(userId, role);
  }

  setRefreshCookiePublic(response: Response, refreshToken: string) {
    this.setRefreshCookie(response, refreshToken);
  }

  private async rotateSession(
    oldTokenId: string | null,
    familyId: string,
    userId: string,
    role: Role,
  ) {
    const refreshTokenId = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      role,
      type: 'refresh',
      jti: refreshTokenId,
      fid: familyId,
    };

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'local-refresh-secret',
      ),
      expiresIn: `${this.configService.get<number>(
        'JWT_REFRESH_TTL_DAYS',
        30,
      )}d` as StringValue,
    });

    const refreshHash = await argon2.hash(refreshToken);
    const expiresAt = new Date(
      Date.now() +
        this.configService.get<number>('JWT_REFRESH_TTL_DAYS', 30) *
          24 *
          60 *
          60 *
          1000,
    );

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      role,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>(
        'JWT_ACCESS_SECRET',
        'local-access-secret',
      ),
      expiresIn: this.configService.get<string>(
        'JWT_ACCESS_TTL',
        '15m',
      ) as StringValue,
    });

    await this.prisma.$transaction(async (tx) => {
      if (oldTokenId) {
        await tx.refreshToken.update({
          where: { id: oldTokenId },
          data: {
            revokedAt: new Date(),
            replacedByTokenId: refreshTokenId,
          },
        });
      }

      await tx.refreshToken.create({
        data: {
          id: refreshTokenId,
          userId,
          tokenHash: refreshHash,
          familyId,
          parentTokenId: oldTokenId,
          expiresAt,
        },
      });
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'local-refresh-secret',
        ),
      });
    } catch (error) {
      const errorName = (error as { name?: unknown }).name;
      const isExpired = errorName === 'TokenExpiredError';

      if (isExpired) {
        throw new UnauthorizedException(
          buildApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token истек.'),
        );
      }

      throw new UnauthorizedException(
        buildApiError(
          401,
          'REFRESH_TOKEN_INVALID',
          'Недействительный refresh token.',
        ),
      );
    }
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    const secure =
      this.configService.get<string>('COOKIE_SECURE', 'false') === 'true';
    const sameSiteValue = this.configService
      .get<string>('COOKIE_SAME_SITE', 'lax')
      .toLowerCase();
    const sameSite =
      sameSiteValue === 'none' || sameSiteValue === 'strict'
        ? sameSiteValue
        : 'lax';

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/auth',
      maxAge:
        this.configService.get<number>('JWT_REFRESH_TTL_DAYS', 30) *
        24 *
        60 *
        60 *
        1000,
    });
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie('refreshToken', {
      path: '/api/auth',
    });
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeName(value: string) {
    return value.trim().replace(/\s+/g, ' ');
  }

  private normalizePhone(phone: string) {
    const clean = phone.trim().replace(/\s+/g, '').replace(/[()-]/g, '');
    const startsWithPlus = clean.startsWith('+');
    const digits = clean.replace(/\D/g, '');
    return `${startsWithPlus ? '+' : '+'}${digits}`;
  }

  private normalizeLogin(value: string) {
    const trimmed = value.trim();
    if (trimmed.includes('@')) {
      return this.normalizeEmail(trimmed);
    }

    return this.normalizePhone(trimmed);
  }

  private ensurePasswordMatch(password: string, passwordConfirmation: string) {
    if (password !== passwordConfirmation) {
      throw new ConflictException(
        buildApiError(
          409,
          'PASSWORD_CONFIRMATION_MISMATCH',
          'Пароль и подтверждение пароля не совпадают.',
        ),
      );
    }
  }

  private ensureStrongPassword(password: string) {
    const isLongEnough = password.length >= 8;
    const withinMaxLength = password.length <= 128;
    const hasLetterAndNumber = /^(?=.*[A-Za-z])(?=.*\d).+$/.test(password);

    if (!isLongEnough || !withinMaxLength || !hasLetterAndNumber) {
      throw new ConflictException(
        buildApiError(
          409,
          'WEAK_PASSWORD',
          'Пароль должен быть 8-128 символов и содержать минимум одну букву и одну цифру.',
        ),
      );
    }
  }

  private async ensureUniqueEmailPhone(email: string, phone: string) {
    const [existingEmail, existingPhone] = await Promise.all([
      this.usersService.findByEmail(email),
      this.usersService.findByPhone(phone),
    ]);

    if (existingEmail) {
      throw new ConflictException(
        buildApiError(
          409,
          'EMAIL_ALREADY_EXISTS',
          'Пользователь с таким email уже существует.',
        ),
      );
    }

    if (existingPhone) {
      throw new ConflictException(
        buildApiError(
          409,
          'PHONE_ALREADY_EXISTS',
          'Пользователь с таким телефоном уже существует.',
        ),
      );
    }
  }
}
