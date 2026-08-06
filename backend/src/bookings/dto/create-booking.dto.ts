import {
  ArrayMaxSize,
  IsIn,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BookingSelectionItemDto {
  @IsString()
  @MinLength(1)
  serviceId!: string;

  @Type(() => Number)
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifierOptionIds?: string[];
}

export class CreateBookingDto {
  @IsString()
  @MinLength(1)
  salonId!: string;

  @IsString()
  @MinLength(1)
  serviceId!: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  masterId?: string;

  @IsString()
  @IsIn(['IN_SALON', 'CARD'])
  paymentMethod!: 'IN_SALON' | 'CARD';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BookingSelectionItemDto)
  items?: BookingSelectionItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(280)
  additionalWish?: string;
}
