import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class GetBookingSlotsDto {
  @IsString()
  @MinLength(1)
  salonId!: string;

  @IsString()
  @MinLength(1)
  serviceId!: string;

  @IsOptional()
  @IsString()
  serviceIds?: string;

  @IsDateString()
  date!: string;

  @Type(() => String)
  @IsOptional()
  @IsString()
  masterId?: string;
}
