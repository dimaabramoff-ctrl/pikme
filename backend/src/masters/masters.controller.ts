import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UpdateMasterDto } from './dto/update-master.dto';
import { MastersService } from './masters.service';

interface MastersListQuery {
  search?: string;
  salonId?: string;
  serviceId?: string;
  specialization?: string;
  minimumRating?: number;
  acceptsHomeVisits?: boolean;
  independent?: boolean;
  verifiedOnly?: boolean;
  sort?: string;
  limit?: number;
  offset?: number;
}

@ApiTags('masters')
@Controller('masters')
export class MastersController {
  constructor(private readonly mastersService: MastersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List masters' })
  list(@Query() query: MastersListQuery) {
    return this.mastersService.list(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get master by id' })
  getById(@Param('id') id: string) {
    return this.mastersService.getById(id);
  }

  @Public()
  @Get('salon/:salonId')
  @ApiOperation({ summary: 'Get masters for a salon' })
  getBySalon(@Param('salonId') salonId: string) {
    return this.mastersService.getBySalon(salonId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current master profile' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.mastersService.getMe(req.user.id);
  }

  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ summary: 'Update current master profile' })
  updateMe(@Req() req: AuthenticatedRequest, @Body() body: UpdateMasterDto) {
    return this.mastersService.updateMe(req.user.id, body);
  }
}
