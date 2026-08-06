import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  type BookingQuoteResult,
  type AvailableSlotsResponse,
  type AdminBookingItem,
  type CustomerBookingItem,
  BookingsService,
} from './bookings.service';
import { BuildBookingQuoteDto } from './dto/build-booking-quote.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { GetBookingSlotsDto } from './dto/get-booking-slots.dto';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Public()
  @Get('slots')
  @ApiOperation({
    summary: 'Get available booking slots for salon/service/date',
  })
  getSlots(
    @Query() query: GetBookingSlotsDto,
  ): Promise<AvailableSlotsResponse> {
    return this.bookingsService.getAvailableSlots(query);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create booking for customer' })
  create(@Req() req: AuthenticatedRequest, @Body() body: CreateBookingDto) {
    return this.bookingsService.createBooking(req.user.id, body);
  }

  @Public()
  @Post('quote')
  @ApiOperation({ summary: 'Recalculate booking draft with multiple services and modifiers' })
  getQuote(@Body() body: BuildBookingQuoteDto): Promise<BookingQuoteResult> {
    return this.bookingsService.buildQuote(body);
  }

  @ApiBearerAuth()
  @Get('my')
  @ApiOperation({ summary: 'Get current customer bookings' })
  getMyBookings(
    @CurrentUser() user: AuthenticatedRequest['user'],
  ): Promise<CustomerBookingItem[]> {
    return this.bookingsService.getMyBookings(user.id);
  }

  @ApiBearerAuth()
  @Get('admin/all')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all bookings for admin panel' })
  getAllBookingsForAdmin(): Promise<AdminBookingItem[]> {
    return this.bookingsService.getAllBookingsForAdmin();
  }

  @ApiBearerAuth()
  @Patch(':bookingId/confirm')
  @ApiOperation({ summary: 'Confirm booking' })
  confirmBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.bookingsService.confirmBooking(bookingId, { id: user.id, role: user.role });
  }

  @ApiBearerAuth()
  @Patch(':bookingId/reject')
  @ApiOperation({ summary: 'Reject booking request' })
  rejectBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Body() body: { reason?: string },
  ) {
    return this.bookingsService.rejectBooking(bookingId, { id: user.id, role: user.role }, body.reason);
  }

  @ApiBearerAuth()
  @Patch(':bookingId/cancel')
  @ApiOperation({ summary: 'Cancel booking' })
  cancelBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Body() body: { reason?: string },
  ) {
    return this.bookingsService.cancelBooking(bookingId, { id: user.id, role: user.role }, body.reason);
  }

  @ApiBearerAuth()
  @Patch(':bookingId/complete')
  @ApiOperation({ summary: 'Complete booking' })
  completeBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.bookingsService.completeBooking(bookingId, { id: user.id, role: user.role });
  }

  @ApiBearerAuth()
  @Patch(':bookingId/no-show')
  @ApiOperation({ summary: 'Mark booking as no-show' })
  markNoShow(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.bookingsService.markNoShow(bookingId, { id: user.id, role: user.role });
  }

  @ApiBearerAuth()
  @Patch(':bookingId/reschedule')
  @ApiOperation({ summary: 'Reschedule booking' })
  rescheduleBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Body() body: { startsAt: string; reason?: string },
  ) {
    return this.bookingsService.rescheduleBooking(
      bookingId,
      { id: user.id, role: user.role },
      body.startsAt,
      body.reason,
    );
  }

  @ApiBearerAuth()
  @Get('salon/:salonId/orders')
  @Roles(Role.SALON_OWNER, Role.SALON_ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get salon bookings for owner/admin panel' })
  getSalonOrders(
    @Param('salonId') salonId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
  ) {
    return this.bookingsService.getSalonPartnerBookings(salonId, {
      id: user.id,
      role: user.role,
    });
  }
}
