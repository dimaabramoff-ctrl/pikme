import { NotFoundException } from '@nestjs/common';
import { MastersService } from './masters.service';

describe('MastersService.list', () => {
  const prisma = {
    salon: { findFirst: jest.fn() },
    service: { findFirst: jest.fn() },
    masterProfile: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    salonMaster: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  } as any;

  let service: MastersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MastersService(prisma);
  });

  it('returns public masters for a real salon and service while coercing string pagination', async () => {
    prisma.salon.findFirst.mockResolvedValue({ id: 'salon-1' });
    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', salonId: 'salon-1' });
    prisma.masterProfile.findMany.mockResolvedValue([
      {
        id: 'master-1',
        displayName: 'Anna Keller',
        currentStatus: 'AVAILABLE',
        availableAt: new Date('2026-08-06T10:00:00.000Z'),
        minutesUntilAvailable: 15,
        specialization: 'Colorist',
        biography: null,
        experienceYears: 8,
        ratingAverage: 4.8,
        reviewCount: 120,
        acceptsHomeVisits: false,
        avatarUrl: null,
        services: [{ service: { id: 'service-1', name: 'Женская стрижка' } }],
        salonLinks: [{ salon: { id: 'salon-1', name: 'Mitte Style Lab' } }],
      },
    ]);
    prisma.masterProfile.count.mockResolvedValue(1);

    const result = await service.list({
      salonId: 'salon-1',
      serviceId: 'service-1',
      limit: '50' as any,
      offset: '0' as any,
    });

    expect(prisma.masterProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
      }),
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'master-1',
        displayName: 'Anna Keller',
        photoUrl: null,
        services: [{ id: 'service-1', name: 'Женская стрижка' }],
        salon: { id: 'salon-1', name: 'Mitte Style Lab' },
      }),
    ]);
  });

  it('returns an empty array for a salon without masters', async () => {
    prisma.salon.findFirst.mockResolvedValue({ id: 'salon-empty' });
    prisma.service.findFirst.mockResolvedValue(null);
    prisma.masterProfile.findMany.mockResolvedValue([]);
    prisma.masterProfile.count.mockResolvedValue(0);

    const result = await service.list({
      salonId: 'salon-empty',
      limit: 20,
      offset: 0,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns an empty array when a service exists but no master is assigned to it', async () => {
    prisma.salon.findFirst.mockResolvedValue({ id: 'salon-1' });
    prisma.service.findFirst.mockResolvedValue({ id: 'service-unused', salonId: 'salon-1' });
    prisma.masterProfile.findMany.mockResolvedValue([]);
    prisma.masterProfile.count.mockResolvedValue(0);

    const result = await service.list({
      salonId: 'salon-1',
      serviceId: 'service-unused',
      limit: 20,
      offset: 0,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('rejects an invalid salon id with 404', async () => {
    prisma.salon.findFirst.mockResolvedValue(null);

    await expect(
      service.list({
        salonId: 'missing-salon',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid service id with 404', async () => {
    prisma.salon.findFirst.mockResolvedValue({ id: 'salon-1' });
    prisma.service.findFirst.mockResolvedValue(null);

    await expect(
      service.list({
        salonId: 'salon-1',
        serviceId: 'missing-service',
        limit: 20,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not throw on nullable master profile fields', async () => {
    prisma.salon.findFirst.mockResolvedValue({ id: 'salon-1' });
    prisma.service.findFirst.mockResolvedValue({ id: 'service-1', salonId: 'salon-1' });
    prisma.masterProfile.findMany.mockResolvedValue([
      {
        id: 'master-nullables',
        displayName: 'Null Friendly',
        currentStatus: 'SOON_AVAILABLE',
        availableAt: null,
        minutesUntilAvailable: null,
        specialization: null,
        biography: null,
        experienceYears: 0,
        ratingAverage: 0,
        reviewCount: 0,
        acceptsHomeVisits: true,
        avatarUrl: null,
        services: [],
        salonLinks: [],
      },
    ]);
    prisma.masterProfile.count.mockResolvedValue(1);

    const result = await service.list({
      salonId: 'salon-1',
      serviceId: 'service-1',
      limit: 20,
      offset: 0,
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        specialization: null,
        biography: null,
        photoUrl: null,
        salon: null,
      }),
    );
  });
});
