import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { SchedulesService } from './schedules.service';

interface ScheduleItemBody {
  salonId?: string;
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isDayOff?: boolean;
  acceptsBookings?: boolean;
  acceptsUrgentBookings?: boolean;
  supportsHomeVisits?: boolean;
}

interface ScheduleBreakBody {
  scheduleId: string;
  startTime: string;
  endTime: string;
}

interface UpdateScheduleBreakBody {
  startTime: string;
  endTime: string;
}

@ApiTags('schedules')
@Controller('masters')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Public()
  @Get(':masterId/schedule')
  @ApiOperation({ summary: 'Get master schedule' })
  getForMaster(@Param('masterId') masterId: string) {
    return this.schedulesService.getForMaster(masterId);
  }

  @ApiBearerAuth()
  @Get('me/schedule')
  @ApiOperation({ summary: 'Get my schedule' })
  getMy(@Req() req: AuthenticatedRequest) {
    return this.schedulesService.getMy(req.user.id);
  }

  @ApiBearerAuth()
  @Put('me/schedule')
  @ApiOperation({ summary: 'Replace my schedule' })
  replaceMy(
    @Req() req: AuthenticatedRequest,
    @Body() body: ScheduleItemBody[],
  ) {
    return this.schedulesService.replaceMy(req.user.id, body);
  }

  @ApiBearerAuth()
  @Post('me/schedule/breaks')
  @ApiOperation({ summary: 'Create a break for my schedule' })
  createBreak(
    @Req() req: AuthenticatedRequest,
    @Body() body: ScheduleBreakBody,
  ) {
    return this.schedulesService.createBreak(req.user.id, body);
  }

  @ApiBearerAuth()
  @Patch('me/schedule/breaks/:breakId')
  @ApiOperation({ summary: 'Update a break for my schedule' })
  updateBreak(
    @Req() req: AuthenticatedRequest,
    @Param('breakId') breakId: string,
    @Body() body: UpdateScheduleBreakBody,
  ) {
    return this.schedulesService.updateBreak(req.user.id, breakId, body);
  }

  @ApiBearerAuth()
  @Delete('me/schedule/breaks/:breakId')
  @ApiOperation({ summary: 'Delete a break for my schedule' })
  deleteBreak(
    @Req() req: AuthenticatedRequest,
    @Param('breakId') breakId: string,
  ) {
    return this.schedulesService.deleteBreak(req.user.id, breakId);
  }
}
