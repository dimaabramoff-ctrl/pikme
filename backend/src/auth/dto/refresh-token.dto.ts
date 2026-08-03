import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Optional fallback when cookie is not used',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  refreshToken?: string;
}
