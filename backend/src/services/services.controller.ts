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
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesService } from './services.service';

interface ServicesListQuery {
  salonId?: string;
  masterId?: string;
  category?: string;
  active?: boolean;
}

interface UpdateServiceDto extends Partial<CreateServiceDto> {
  isActive?: boolean;
}

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List services' })
  list(@Query() query: ServicesListQuery) {
    return this.servicesService.list(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get service by id' })
  getById(@Param('id') id: string) {
    return this.servicesService.getById(id);
  }

  @ApiBearerAuth()
  @Post('salons/:salonId')
  @ApiOperation({ summary: 'Create service for salon' })
  create(
    @Param('salonId') salonId: string,
    @Body() body: CreateServiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.create(salonId, body, req.user);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Update service' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.update(id, body, req.user);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete service' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.servicesService.remove(id, req.user);
  }
}
