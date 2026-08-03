import { Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'List favorites' })
  list(@Req() req: AuthenticatedRequest) {
    return this.favoritesService.list(req.user.id);
  }

  @Post('salons/:salonId')
  @ApiOperation({ summary: 'Add salon to favorites' })
  addSalon(
    @Req() req: AuthenticatedRequest,
    @Param('salonId') salonId: string,
  ) {
    return this.favoritesService.addSalon(req.user.id, salonId);
  }

  @Delete('salons/:salonId')
  @ApiOperation({ summary: 'Remove salon from favorites' })
  removeSalon(
    @Req() req: AuthenticatedRequest,
    @Param('salonId') salonId: string,
  ) {
    return this.favoritesService.removeSalon(req.user.id, salonId);
  }

  @Post('masters/:masterId')
  @ApiOperation({ summary: 'Add master to favorites' })
  addMaster(
    @Req() req: AuthenticatedRequest,
    @Param('masterId') masterId: string,
  ) {
    return this.favoritesService.addMaster(req.user.id, masterId);
  }

  @Delete('masters/:masterId')
  @ApiOperation({ summary: 'Remove master from favorites' })
  removeMaster(
    @Req() req: AuthenticatedRequest,
    @Param('masterId') masterId: string,
  ) {
    return this.favoritesService.removeMaster(req.user.id, masterId);
  }
}
