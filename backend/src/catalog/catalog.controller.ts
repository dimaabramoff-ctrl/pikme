import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import { NearbyCatalogQueryDto } from './dto/nearby-catalog-query.dto';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('nearby')
  @ApiQuery({ name: 'latitude', required: true, type: Number })
  @ApiQuery({ name: 'longitude', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getNearby(@Query() query: NearbyCatalogQueryDto) {
    return this.catalogService.getNearby(query);
  }
}
