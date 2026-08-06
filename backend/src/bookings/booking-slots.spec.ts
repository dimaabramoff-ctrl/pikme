import { BookingStatus } from '@prisma/client';
import { calculateAvailableSlots } from './booking-slots';

describe('booking slots calculation', () => {
  it('returns slots from working schedule excluding occupied intervals', () => {
    const date = new Date('2026-08-04T00:00:00.000Z');
    const now = new Date('2026-08-04T08:00:00.000Z');

    const slots = calculateAvailableSlots({
      date,
      durationMinutes: 60,
      now,
      schedules: [
        {
          id: 'schedule-1',
          dayOfWeek: 2,
          shiftStart: '09:00',
          shiftEnd: '13:00',
          isDayOff: false,
          acceptsBookings: true,
          breaks: [],
        },
      ],
      bookings: [
        {
          startsAt: new Date('2026-08-04T10:00:00.000Z'),
          endsAt: new Date('2026-08-04T11:00:00.000Z'),
          status: BookingStatus.confirmed,
        },
      ],
    });

    expect(slots.map((item) => item.toISOString())).toEqual([
      '2026-08-04T09:00:00.000Z',
      '2026-08-04T11:00:00.000Z',
      '2026-08-04T11:15:00.000Z',
      '2026-08-04T11:30:00.000Z',
      '2026-08-04T11:45:00.000Z',
      '2026-08-04T12:00:00.000Z',
    ]);
  });

  it('respects service duration and excludes only overlapping long slots', () => {
    const date = new Date('2026-08-04T00:00:00.000Z');
    const now = new Date('2026-08-04T08:00:00.000Z');

    const slots = calculateAvailableSlots({
      date,
      durationMinutes: 90,
      now,
      schedules: [
        {
          id: 'schedule-1',
          dayOfWeek: 2,
          shiftStart: '09:00',
          shiftEnd: '12:00',
          isDayOff: false,
          acceptsBookings: true,
          breaks: [],
        },
      ],
      bookings: [
        {
          startsAt: new Date('2026-08-04T10:00:00.000Z'),
          endsAt: new Date('2026-08-04T10:30:00.000Z'),
          status: BookingStatus.confirmed,
        },
      ],
    });

    expect(slots.map((item) => item.toISOString())).toEqual([
      '2026-08-04T10:30:00.000Z',
    ]);
  });
});
