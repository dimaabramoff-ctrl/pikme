import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('users/me')
  async getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.usersService.getProfileByUserId(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      customerProfile: profile?.customerProfile,
      masterProfile: profile?.masterProfile,
      salonAdminProfile: profile?.salonAdmins ?? [],
    };
  }

  @Get('master/profile')
  @Roles(Role.MASTER)
  getMasterProfile(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id, role: user.role, name: user.name };
  }

  @Get('salon-admin/profile')
  @Roles(Role.SALON_ADMIN)
  getSalonAdminProfile(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id, role: user.role, name: user.name };
  }

  @Get('admin/profile')
  @Roles(Role.SUPER_ADMIN)
  getAdminProfile(@CurrentUser() user: AuthenticatedUser) {
    return { id: user.id, role: user.role, name: user.name };
  }
}
