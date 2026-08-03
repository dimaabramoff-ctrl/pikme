import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { buildApiError } from '../../common/api-error';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser | false) {
    if (err || !user) {
      throw new UnauthorizedException(
        buildApiError(
          401,
          'REFRESH_TOKEN_INVALID',
          'Недействительный refresh token.',
        ),
      );
    }

    return user;
  }
}
