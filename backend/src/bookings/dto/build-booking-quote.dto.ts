import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BookingQuoteItemDto {
  @IsString()
  @MinLength(1)
  serviceId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifierOptionIds?: string[];
}

export class BuildBookingQuoteDto {
  @IsString()
  @MinLength(1)
  salonId!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BookingQuoteItemDto)
  items!: BookingQuoteItemDto[];
}
