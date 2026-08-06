import { SalonsService } from './salons.service';

describe('SalonsService.list', () => {
  const prisma = {
    salon: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  } as any;

  let service: SalonsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalonsService(prisma);
  });

  it('coerces string pagination params without throwing', async () => {
    prisma.salon.findMany.mockResolvedValue([]);
    prisma.salon.count.mockResolvedValue(0);

    const result = await service.list({
      city: 'Berlin',
      limit: '3' as any,
      offset: '0' as any,
    });

    expect(prisma.salon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
        skip: 0,
      }),
    );
    expect(result).toEqual({ items: [], total: 0 });
  });
});
