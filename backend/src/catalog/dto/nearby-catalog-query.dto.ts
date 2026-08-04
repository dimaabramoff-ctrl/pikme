import { Transform, Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class NearbyCatalogQueryDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(10_000)
  radius?: number;

  // Backward-compatible alias for old clients using radiusKm.
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value) * 1000,
  )
  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(10_000)
  radiusKm?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
