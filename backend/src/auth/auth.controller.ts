import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { buildApiError } from '../common/api-error';
import type { AuthenticatedUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterMasterDto } from './dto/register-master.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register/customer')
  @ApiOperation({ summary: 'Register customer account' })
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.authService.registerCustomer(dto);
  }

  @Public()
  @Post('register/master')
  @ApiOperation({ summary: 'Register master account' })
  registerMaster(@Body() dto: RegisterMasterDto) {
    return this.authService.registerMaster(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({
    default: {
      limit:
        process.env.NODE_ENV === 'e2e' || process.env.NODE_ENV === 'test'
          ? 50
          : 5,
      ttl: 60000,
    },
  })
  @ApiOperation({
    summary: 'Login and receive access token with refresh cookie',
  })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth('refreshToken')
  @ApiBody({ type: RefreshTokenDto, required: false })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokenFromCookie = request.cookies?.refreshToken as string | undefined;
    return this.authService.refresh(dto, tokenFromCookie, response);
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  @ApiCookieAuth('refreshToken')
  logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokenFromCookie = request.cookies?.refreshToken as string | undefined;
    return this.authService.logout(tokenFromCookie, response);
  }

  @Post('logout-all')
  @HttpCode(200)
  logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.logoutAll(user.id, response);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthenticatedUser) {
    if (!user?.id) {
      throw new UnauthorizedException(
        buildApiError(401, 'UNAUTHORIZED', 'Требуется авторизация.'),
      );
    }

    return this.authService.me(user.id);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }
}
