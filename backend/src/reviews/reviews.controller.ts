import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ReviewsService } from './reviews.service';

interface ReviewsListQuery {
  rating?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

interface CreateReviewBody {
  bookingId: string;
  customerProfileId: string;
  masterId: string;
  salonId?: string;
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
  @ApiOperation({ summary: 'Create review' })
  create(@Body() body: CreateReviewBody) {
    return this.reviewsService.create(body);
  }
}
