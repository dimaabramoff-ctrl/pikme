import { BookingStatus, Role } from '@prisma/client';
import { ReviewsService } from './reviews.service';

function createPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    customerProfile: { findUnique: jest.fn() },
    booking: { findUnique: jest.fn() },
    review: {
      findUnique: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    salonAdmin: { findFirst: jest.fn() },
    salonMaster: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    masterProfile: { update: jest.fn() },
    salon: { update: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg as Promise<unknown>[]);
      }
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma as unknown);
      }
      return null;
    }),
    ...overrides,
  } as any;
}

let prisma: ReturnType<typeof createPrismaMock>;

describe('ReviewsService', () => {
  beforeEach(() => {
    prisma = createPrismaMock();
  });

  it('rejects review when booking is not completed', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerProfileId: 'customer-1',
      masterId: 'master-1',
      salonId: 'salon-1',
      status: BookingStatus.confirmed,
    });

    const service = new ReviewsService(prisma);

    await expect(
      service.createByBooking({
        userId: 'user-1',
        role: Role.CUSTOMER,
        bookingId: 'booking-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({
      response: { code: 'REVIEW_BOOKING_NOT_COMPLETED' },
    });
  });

  it('rejects review for foreign booking', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerProfileId: 'customer-2',
      masterId: 'master-1',
      salonId: 'salon-1',
      status: BookingStatus.completed,
    });

    const service = new ReviewsService(prisma);

    await expect(
      service.createByBooking({
        userId: 'user-1',
        role: Role.CUSTOMER,
        bookingId: 'booking-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({
      response: { code: 'REVIEW_FOREIGN_BOOKING' },
    });
  });

  it('rejects duplicate review for same booking', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerProfileId: 'customer-1',
      masterId: 'master-1',
      salonId: 'salon-1',
      status: BookingStatus.completed,
    });
    prisma.review.findUnique.mockResolvedValue({ id: 'review-1' });

    const service = new ReviewsService(prisma);

    await expect(
      service.createByBooking({
        userId: 'user-1',
        role: Role.CUSTOMER,
        bookingId: 'booking-1',
        rating: 4,
      }),
    ).rejects.toMatchObject({
      response: { code: 'REVIEW_ALREADY_EXISTS' },
    });
  });

  it('rejects owner/staff review for own salon', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerProfileId: 'customer-1',
      masterId: 'master-1',
      salonId: 'salon-1',
      status: BookingStatus.completed,
    });
    prisma.review.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue([{ id: 'admin-link' }, null]);

    const service = new ReviewsService(prisma);

    await expect(
      service.createByBooking({
        userId: 'user-1',
        role: Role.CUSTOMER,
        bookingId: 'booking-1',
        rating: 5,
      }),
    ).rejects.toMatchObject({
      response: { code: 'REVIEW_SELF_SALON_FORBIDDEN' },
    });
  });

  it('creates verified review and writes audit log', async () => {
    prisma.customerProfile.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      customerProfileId: 'customer-1',
      masterId: 'master-1',
      salonId: 'salon-1',
      status: BookingStatus.completed,
    });
    prisma.review.findUnique.mockResolvedValue(null);
    prisma.$transaction
      .mockResolvedValueOnce([null, null])
      .mockImplementationOnce(async (fn: (tx: any) => Promise<any>) =>
        fn({ review: { aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } }) } }),
      );
    prisma.review.create.mockResolvedValue({
      id: 'review-1',
      bookingId: 'booking-1',
      customerProfileId: 'customer-1',
      masterId: 'master-1',
      salonId: 'salon-1',
      rating: 5,
      text: 'Top',
    });

    const service = new ReviewsService(prisma);

    const result = await service.createByBooking({
      userId: 'user-1',
      role: Role.CUSTOMER,
      bookingId: 'booking-1',
      rating: 5,
      text: 'Top',
    });

    expect(result.id).toBe('review-1');
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
