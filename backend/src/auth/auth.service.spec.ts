/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  const mockPrisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    customerProfile: { create: jest.fn() },
    masterProfile: { create: jest.fn() },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(
      async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    ),
  };

  const mockJwtService = {
    signAsync: jest.fn(() => Promise.resolve('jwt-token')),
    verifyAsync: jest.fn(() =>
      Promise.resolve({
        sub: 'user-1',
        role: Role.CUSTOMER,
        type: 'refresh',
        jti: 'token-id',
        fid: 'family-id',
      }),
    ),
  };

  const mockConfig = {
    get: jest.fn((key: string, fallback: unknown) => {
      const map: Record<string, unknown> = {
        JWT_ACCESS_SECRET: 'access',
        JWT_REFRESH_SECRET: 'refresh',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL_DAYS: 30,
        COOKIE_SECURE: 'false',
        COOKIE_SAME_SITE: 'lax',
      };
      return map[key] ?? fallback;
    }),
  };

  const mockUsers = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findByEmailOrPhone: jest.fn(),
    findAuthUserById: jest.fn(),
    getProfileByUserId: jest.fn(),
    toAuthenticatedUser: jest.fn((user) => ({
      id: user.id,
      role: user.role,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      isVerified: user.isVerified,
      name: 'Test User',
    })),
  } as unknown as UsersService;

  const response = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockPrisma as never,
      mockJwtService as never,
      mockConfig as never,
      mockUsers,
    );
  });

  it('registers customer', async () => {
    mockUsers.findByEmail = jest.fn().mockResolvedValue(null);
    mockUsers.findByPhone = jest.fn().mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: 'u1' });
    mockUsers.findAuthUserById = jest
      .fn()
      .mockResolvedValue({ id: 'u1', role: Role.CUSTOMER });

    const result = await service.registerCustomer({
      name: 'Anna',
      email: ' Customer@example.test ',
      phone: '+49 111 22',
      password: 'Passw0rd123',
      passwordConfirmation: 'Passw0rd123',
    });

    expect(result).toEqual({ id: 'u1', role: Role.CUSTOMER });
    expect(mockPrisma.user.create).toHaveBeenCalled();
    expect(mockPrisma.customerProfile.create).toHaveBeenCalled();
  });

  it('rejects duplicate email', async () => {
    mockUsers.findByEmail = jest.fn().mockResolvedValue({ id: 'u1' });
    mockUsers.findByPhone = jest.fn().mockResolvedValue(null);

    await expect(
      service.registerCustomer({
        name: 'Anna',
        email: 'customer@example.test',
        phone: '+49111',
        password: 'Passw0rd123',
        passwordConfirmation: 'Passw0rd123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects password mismatch', async () => {
    await expect(
      service.registerCustomer({
        name: 'Anna',
        email: 'customer@example.test',
        phone: '+49111',
        password: 'Passw0rd123',
        passwordConfirmation: 'Passw0rd124',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login returns access token and sets cookie', async () => {
    const passwordHash = await argon2.hash('TestPass123');

    mockUsers.findByEmailOrPhone = jest.fn().mockResolvedValue({
      id: 'u1',
      role: Role.CUSTOMER,
      email: 'customer@example.test',
      phone: '+49111',
      isActive: true,
      isVerified: true,
      passwordHash,
    });

    const result = await service.login(
      { emailOrPhone: 'customer@example.test', password: 'TestPass123' },
      response as never,
    );

    expect(result.accessToken).toBeDefined();
    expect(response.cookie).toHaveBeenCalled();
  });

  it('rejects invalid login', async () => {
    mockUsers.findByEmailOrPhone = jest.fn().mockResolvedValue(null);

    await expect(
      service.login(
        { emailOrPhone: 'x', password: 'Passw0rd123' },
        response as never,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
