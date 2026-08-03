import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterMasterDto {
  @ApiProperty({ example: 'Max Barber' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'master@example.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '+491234567891' })
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

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(0)
  experienceYears!: number;

  @ApiProperty({ example: 'Barber' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  specialization!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  acceptsHomeVisits!: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  independent!: boolean;
}
