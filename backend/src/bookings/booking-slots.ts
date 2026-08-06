import { BookingStatus } from '@prisma/client';

export interface ScheduleBreakLike {
  startTime: string;
  endTime: string;
}

export interface WorkingScheduleLike {
  id: string;
  dayOfWeek: number;
  shiftStart: string;
  shiftEnd: string;
  isDayOff: boolean;
  acceptsBookings: boolean;
  breaks: ScheduleBreakLike[];
}

export interface BookingIntervalLike {
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
}

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.pending,
  BookingStatus.confirmed,
  BookingStatus.inProgress,
];

interface DatedInterval {
  start: Date;
  end: Date;
}

export function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function withTime(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function buildInterval(
  baseDate: Date,
  startTime: string,
  endTime: string,
): DatedInterval {
  const start = withTime(baseDate, startTime);
  let end = withTime(baseDate, endTime);

  if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  return { start, end };
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function ceilToStep(date: Date, stepMinutes: number) {
  const result = new Date(date);
  result.setSeconds(0, 0);
  const minutes = result.getMinutes();
  const remainder = minutes % stepMinutes;
  if (remainder === 0) return result;
  result.setMinutes(minutes + (stepMinutes - remainder));
  return result;
}

interface ScheduleCandidate {
  schedule: WorkingScheduleLike;
  baseDate: Date;
}

function getScheduleCandidatesForDay(
  schedules: WorkingScheduleLike[],
  date: Date,
) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const nextDayStart = new Date(dayStart);
  nextDayStart.setDate(nextDayStart.getDate() + 1);

  const previousDay = new Date(dayStart);
  previousDay.setDate(previousDay.getDate() - 1);

  const targetDayOfWeek = dayStart.getDay();
  const previousDayOfWeek = previousDay.getDay();

  const candidates: ScheduleCandidate[] = [];

  for (const schedule of schedules) {
    if (schedule.isDayOff || !schedule.acceptsBookings) continue;

    if (schedule.dayOfWeek === targetDayOfWeek) {
      candidates.push({ schedule, baseDate: dayStart });
      continue;
    }

    if (
      schedule.dayOfWeek === previousDayOfWeek &&
      parseTimeToMinutes(schedule.shiftEnd) <=
        parseTimeToMinutes(schedule.shiftStart)
    ) {
      candidates.push({ schedule, baseDate: previousDay });
    }
  }

  return { candidates, dayStart, nextDayStart };
}

function getBreakIntervals(schedule: WorkingScheduleLike, baseDate: Date) {
  return schedule.breaks.map((item) =>
    buildInterval(baseDate, item.startTime, item.endTime),
  );
}

export function isSlotAvailableForSchedules(params: {
  startsAt: Date;
  durationMinutes: number;
  date: Date;
  schedules: WorkingScheduleLike[];
  bookings: BookingIntervalLike[];
}) {
  const { startsAt, durationMinutes, date, schedules, bookings } = params;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

  const { candidates, dayStart, nextDayStart } = getScheduleCandidatesForDay(
    schedules,
    date,
  );

  const insideShift = candidates.some(({ schedule, baseDate }) => {
    const shift = buildInterval(
      baseDate,
      schedule.shiftStart,
      schedule.shiftEnd,
    );
    if (!overlaps(shift.start, shift.end, dayStart, nextDayStart)) return false;

    const breakIntervals = getBreakIntervals(schedule, baseDate);
    const intersectsBreak = breakIntervals.some((interval) =>
      overlaps(startsAt, endsAt, interval.start, interval.end),
    );

    if (intersectsBreak) return false;

    return shift.start <= startsAt && endsAt <= shift.end;
  });

  if (!insideShift) return false;

  const hasConflict = bookings
    .filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status))
    .some((booking) =>
      overlaps(startsAt, endsAt, booking.startsAt, booking.endsAt),
    );

  return !hasConflict;
}

export function calculateAvailableSlots(params: {
  date: Date;
  durationMinutes: number;
  schedules: WorkingScheduleLike[];
  bookings: BookingIntervalLike[];
  now: Date;
  stepMinutes?: number;
}) {
  const {
    date,
    durationMinutes,
    schedules,
    bookings,
    now,
    stepMinutes = 15,
  } = params;

  if (durationMinutes <= 0) return [];

  const { candidates, dayStart, nextDayStart } = getScheduleCandidatesForDay(
    schedules,
    date,
  );
  const result = new Set<number>();

  for (const { schedule, baseDate } of candidates) {
    const shift = buildInterval(
      baseDate,
      schedule.shiftStart,
      schedule.shiftEnd,
    );
    if (!overlaps(shift.start, shift.end, dayStart, nextDayStart)) continue;

    const startBoundary = shift.start > dayStart ? shift.start : dayStart;
    const endBoundary = shift.end < nextDayStart ? shift.end : nextDayStart;

    let cursor = startBoundary > now ? startBoundary : now;
    cursor = ceilToStep(cursor, stepMinutes);

    while (cursor < endBoundary) {
      const slotEnd = new Date(cursor.getTime() + durationMinutes * 60 * 1000);
      if (slotEnd > endBoundary) break;

      const isAvailable = isSlotAvailableForSchedules({
        startsAt: cursor,
        durationMinutes,
        date,
        schedules,
        bookings,
      });

      if (isAvailable) {
        result.add(cursor.getTime());
      }

      cursor = new Date(cursor.getTime() + stepMinutes * 60 * 1000);
    }
  }

  return [...result].sort((a, b) => a - b).map((time) => new Date(time));
}
