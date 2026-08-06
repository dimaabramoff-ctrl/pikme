import { IsEmail, IsOptional, IsString } from 'class-validator';

export class RequestTrialDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string; // "OWNER", "MANAGER", "STAFF"
}
