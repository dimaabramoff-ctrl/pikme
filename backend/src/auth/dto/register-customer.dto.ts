import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'Anna Keller' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'customer@example.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+491234567890' })
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  phone!: string;

  @ApiProperty({ example: 'Passw0rd123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Пароль должен содержать минимум одну букву и одну цифру.',
  })
  password!: string;

  @ApiProperty({ example: 'Passw0rd123' })
  @IsString()
  passwordConfirmation!: string;
}
