import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min, ValidateNested } from 'class-validator';
import { CreateVoucherDto } from './create-voucher.dto';

export class CreateVoucherBatchDto {
  @ApiProperty({ type: CreateVoucherDto })
  @ValidateNested()
  @Type(() => CreateVoucherDto)
  voucher!: CreateVoucherDto;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  @Max(500)
  count!: number;
}
