import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Passw0rd123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ example: 'NewPassw0rd123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Пароль должен содержать минимум одну букву и одну цифру.',
  })
  newPassword!: string;

  @ApiProperty({ example: 'NewPassw0rd123' })
  @IsString()
  newPasswordConfirmation!: string;
}
