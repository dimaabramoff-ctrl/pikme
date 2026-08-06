import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CatalogService } from './catalog.service';
import { NearbyCatalogQueryDto } from './dto/nearby-catalog-query.dto';
import { ExternalPlacesProvider } from '../catalog-providers/external-places.provider';

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly externalPlacesProvider: ExternalPlacesProvider,
  ) {}

  @Public()
  @Get('nearby')
  @ApiQuery({ name: 'latitude', required: true, type: Number })
  @ApiQuery({ name: 'longitude', required: true, type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  @ApiQuery({ name: 'query', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'pageToken', required: false, type: String })
  @ApiQuery({ name: 'filters', required: false, type: String })
  async getNearby(@Query() query: NearbyCatalogQueryDto, @Res() res: Response) {
    const payload = await this.catalogService.getNearby(query);

    res.setHeader(
      'x-catalog-google-requests-made',
      String(payload.diagnostics.googleRequestsMade),
    );
    res.setHeader(
      'x-catalog-google-raw-results',
      String(payload.diagnostics.googleRawResults),
    );
    res.setHeader(
      'x-catalog-unique-results',
      String(payload.diagnostics.uniqueResults),
    );
    res.setHeader(
      'x-catalog-returned-on-this-page',
      String(payload.diagnostics.returnedOnThisPage),
    );
    res.setHeader('x-catalog-has-more', String(payload.diagnostics.hasMore));
    res.setHeader(
      'x-catalog-radius-meters-used',
      String(payload.diagnostics.radiusMetersUsed),
    );

    return res.json(payload);
  }

  @Public()
  @Get('google-photo')
  @ApiQuery({ name: 'name', required: true, type: String })
  @ApiQuery({ name: 'maxHeight', required: false, type: Number })
  @ApiQuery({ name: 'maxWidth', required: false, type: Number })
  async getGooglePhoto(
    @Query('name') photoName: string,
    @Query('maxHeight') maxHeight: string | undefined,
    @Query('maxWidth') maxWidth: string | undefined,
    @Res() res: Response,
  ) {
    if (!photoName || !photoName.trim()) {
      throw new BadRequestException('name is required');
    }

    const normalizedName = photoName.trim();
    if (!normalizedName.startsWith('places/')) {
      throw new BadRequestException('name must start with places/');
    }

    const parsedMaxHeight = maxHeight ? Number(maxHeight) : undefined;
    const parsedMaxWidth = maxWidth ? Number(maxWidth) : undefined;

    const { buffer, contentType, cacheControl } =
      await this.externalPlacesProvider.getGooglePhotoMedia(normalizedName, {
        maxHeightPx: Number.isFinite(parsedMaxHeight)
          ? parsedMaxHeight
          : undefined,
        maxWidthPx: Number.isFinite(parsedMaxWidth) ? parsedMaxWidth : undefined,
      });

    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  }
}
