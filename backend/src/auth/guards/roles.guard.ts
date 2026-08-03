import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { buildApiError } from '../../common/api-error';
import { PrismaService } from '../../prisma/prisma.service';

interface GuardRequestUser {
  id: string;
  role: Role;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: GuardRequestUser; path?: string }>();

    if (!request.user || !requiredRoles.includes(request.user.role)) {
      if (request.user?.id) {
        await this.prisma.auditLog.create({
          data: {
            userId: request.user.id,
            action: 'ROLE_FORBIDDEN',
            entityType: 'AUTH',
            entityId: request.path,
          },
        });
      }

      throw new ForbiddenException(
        buildApiError(
          403,
          'FORBIDDEN',
          'Недостаточно прав для выполнения действия.',
        ),
      );
    }

    return true;
  }
}
