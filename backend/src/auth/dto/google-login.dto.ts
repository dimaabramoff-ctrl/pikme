import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Google identity token from Google Identity Services',
  })
  @IsString()
  @MinLength(10)
  idToken!: string;

  @ApiPropertyOptional({ example: '+4917612345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  acceptTerms!: boolean;
}
