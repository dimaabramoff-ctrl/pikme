import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PortfolioService } from './portfolio.service';

interface PortfolioUpsertBody {
  imageUrl: string;
  title?: string | null;
  description?: string | null;
  serviceCategory?: string | null;
  sortOrder?: number;
}

@ApiTags('portfolio')
@ApiBearerAuth()
@Controller('masters')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get(':masterId/portfolio')
  @ApiOperation({ summary: 'Get portfolio for master' })
  list(@Param('masterId') masterId: string) {
    return this.portfolioService.list(masterId);
  }

  @Post('me/portfolio')
  @ApiOperation({ summary: 'Create portfolio item for current master' })
  create(@Req() req: AuthenticatedRequest, @Body() body: PortfolioUpsertBody) {
    return this.portfolioService.create(req.user.id, body);
  }

  @Patch('me/portfolio/:itemId')
  @ApiOperation({ summary: 'Update portfolio item for current master' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('itemId') itemId: string,
    @Body() body: Partial<PortfolioUpsertBody>,
  ) {
    return this.portfolioService.update(req.user.id, itemId, body);
  }

  @Delete('me/portfolio/:itemId')
  @ApiOperation({ summary: 'Delete portfolio item for current master' })
  remove(@Req() req: AuthenticatedRequest, @Param('itemId') itemId: string) {
    return this.portfolioService.remove(req.user.id, itemId);
  }
}
