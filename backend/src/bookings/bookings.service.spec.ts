import { BookingsService } from './bookings.service';

describe('BookingsService quote validation', () => {
  const prisma = {
    service: { findMany: jest.fn() },
  } as any;

  it('rejects duplicate base service in one booking selection', async () => {
    const service = new BookingsService(prisma);

    await expect(
      service.buildQuote({
        salonId: 'salon-1',
        items: [
          { serviceId: 'service-1', quantity: 1, modifierOptionIds: [] },
          { serviceId: 'service-1', quantity: 1, modifierOptionIds: [] },
        ],
      }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_DUPLICATE_SERVICE' },
    });
  });

  it('rejects quantity > 1 for base service', async () => {
    const service = new BookingsService(prisma);

    await expect(
      service.buildQuote({
        salonId: 'salon-1',
        items: [
          { serviceId: 'service-1', quantity: 2, modifierOptionIds: [] },
        ],
      }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_INVALID_SERVICE_QUANTITY' },
    });
  });
});
