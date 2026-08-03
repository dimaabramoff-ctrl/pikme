import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CreateSalonDto } from './dto/create-salon.dto';
import { SalonsService } from './salons.service';

interface SalonListQuery {
  search?: string;
  city?: string;
  postalCode?: string;
  serviceId?: string;
  minimumRating?: number;
  homeVisit?: boolean;
  verifiedOnly?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

@ApiTags('salons')
@Controller('salons')
export class SalonsController {
  constructor(private readonly salonsService: SalonsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List salons' })
  list(@Query() query: SalonListQuery) {
    return this.salonsService.list(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get salon by id' })
  getById(@Param('id') id: string) {
    return this.salonsService.getById(id);
  }

  @Public()
  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get salon by slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.salonsService.getBySlug(slug);
  }

  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create salon' })
  create(@Body() body: CreateSalonDto, @Req() req: AuthenticatedRequest) {
    return this.salonsService.create(body, req.user);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update salon' })
  update(
    @Param('id') id: string,
    @Body() body: Partial<CreateSalonDto>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.salonsService.update(id, body, req.user);
  }

  @ApiBearerAuth()
  @Roles(Role.SUPER_ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete salon' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.salonsService.remove(id, req.user);
  }
}
