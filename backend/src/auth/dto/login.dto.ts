import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'customer@example.test' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  emailOrPhone!: string;

  @ApiProperty({ example: 'Passw0rd123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
