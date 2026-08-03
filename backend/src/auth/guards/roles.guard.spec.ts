import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('allows when role matches', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.MASTER]),
    } as unknown as Reflector;

    const prisma = {
      auditLog: { create: jest.fn() },
    };

    const guard = new RolesGuard(reflector, prisma as never);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u1', role: Role.MASTER },
          path: '/master/profile',
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
