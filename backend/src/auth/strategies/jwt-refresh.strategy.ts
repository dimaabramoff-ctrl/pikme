import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RefreshTokenPayload } from '../auth.types';

function extractRefreshToken(req: {
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const fromCookie = req.cookies?.refreshToken;
  if (fromCookie) {
    return fromCookie;
  }

  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractRefreshToken]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_REFRESH_SECRET',
        'local-refresh-secret',
      ),
      passReqToCallback: true,
    });
  }

  validate(
    req: { cookies?: Record<string, string>; headers?: Record<string, string> },
    payload: RefreshTokenPayload,
  ) {
    return {
      ...payload,
      refreshToken: extractRefreshToken(req),
    };
  }
}
