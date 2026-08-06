import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReviewsService } from './reviews.service';

interface ReviewsListQuery {
  rating?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

interface CreateReviewBody {
  bookingId: string;
  rating: number;
  text?: string;
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List reviews' })
  list(@Query() query: ReviewsListQuery) {
    return this.reviewsService.list(query);
  }

  @Public()
  @Get('masters/:masterId')
  @ApiOperation({ summary: 'List reviews for master' })
  listMaster(
    @Param('masterId') masterId: string,
    @Query() query: ReviewsListQuery,
  ) {
    return this.reviewsService.list({ ...query, masterId });
  }

  @Public()
  @Get('salons/:salonId')
  @ApiOperation({ summary: 'List reviews for salon' })
  listSalon(
    @Param('salonId') salonId: string,
    @Query() query: ReviewsListQuery,
  ) {
    return this.reviewsService.list({ ...query, salonId });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create verified review for completed booking' })
  create(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Body() body: CreateReviewBody,
  ) {
    return this.reviewsService.createByBooking({
      userId: user.id,
      role: user.role,
      bookingId: body.bookingId,
      rating: body.rating,
      text: body.text,
    });
  }

  @Patch(':reviewId/moderation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Moderate review status (admin audit)' })
  moderate(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('reviewId') reviewId: string,
    @Body() body: { status: 'APPROVED' | 'HIDDEN'; reason?: string },
  ) {
    return this.reviewsService.moderateReview(user.id, reviewId, body.status, body.reason);
  }

  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete review by admin' })
  remove(
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Param('reviewId') reviewId: string,
    @Body() body: { reason?: string },
  ) {
    return this.reviewsService.deleteByAdmin(user.id, reviewId, body.reason);
  }
}
