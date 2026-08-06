import { ConflictException } from '@nestjs/common';
import {
  BusinessClaimStatus,
  CatalogSourceType,
  PartnerSubscriptionPlan,
  PartnerSubscriptionSource,
  PartnerSubscriptionStatus,
  Role,
  VerificationLevel,
} from '@prisma/client';
import { BusinessClaimsService } from './business-claims.service';

describe('BusinessClaimsService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    salon: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    businessClaim: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    notification: { createMany: jest.fn() },
    salonAdmin: { upsert: jest.fn() },
    partnerSubscription: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)),
  } as any;

  let service: BusinessClaimsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BusinessClaimsService(prisma);
  });

  it('creates and links an external salon claim from google place data', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: Role.CUSTOMER });
    prisma.salon.findFirst.mockResolvedValueOnce(null);
    prisma.salon.create.mockResolvedValueOnce({ id: 'salon-ext-1' });
    prisma.salon.findUnique.mockResolvedValueOnce({ id: 'salon-ext-1', name: 'Studio Nord' });
    prisma.businessClaim.findFirst.mockResolvedValueOnce(null);
    prisma.businessClaim.findUnique.mockResolvedValueOnce(null);
    prisma.businessClaim.create.mockResolvedValueOnce({ id: 'claim-1', salonId: 'salon-ext-1' });

    const result = await service.createClaim('user-1', {
      googlePlaceId: 'google-place-1',
      factualSnapshot: {
        name: 'Studio Nord',
        address: 'Testweg 1',
        city: 'Berlin',
      },
    });

    expect(prisma.salon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Studio Nord',
          sourceType: CatalogSourceType.EXTERNAL,
          externalPlaceId: 'google-place-1',
        }),
      }),
    );
    expect(prisma.businessClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          salonId: 'salon-ext-1',
          googlePlaceId: 'google-place-1',
          status: BusinessClaimStatus.PENDING,
        }),
      }),
    );
    expect(result).toEqual({ id: 'claim-1', salonId: 'salon-ext-1' });
  });

  it('reopens a rejected claim instead of creating a duplicate row', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: Role.CUSTOMER });
    prisma.salon.findUnique.mockResolvedValueOnce({ id: 'salon-1', name: 'Studio Nord' });
    prisma.businessClaim.findFirst.mockResolvedValueOnce(null);
    prisma.businessClaim.findUnique.mockResolvedValueOnce({
      id: 'claim-old',
      status: BusinessClaimStatus.REJECTED,
    });
    prisma.businessClaim.update.mockResolvedValueOnce({ id: 'claim-old', status: BusinessClaimStatus.PENDING });

    const result = await service.createClaim('user-1', { salonId: 'salon-1' });

    expect(prisma.businessClaim.create).not.toHaveBeenCalled();
    expect(prisma.businessClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'claim-old' },
        data: expect.objectContaining({
          status: BusinessClaimStatus.PENDING,
          verificationLevel: VerificationLevel.UNVERIFIED,
        }),
      }),
    );
    expect(result).toEqual({ id: 'claim-old', status: BusinessClaimStatus.PENDING });
  });

  it('prevents approving a claim when another active owner already exists', async () => {
    prisma.businessClaim.findUnique.mockResolvedValue({
      id: 'claim-1',
      userId: 'user-1',
      salonId: 'salon-1',
      salon: { id: 'salon-1' },
    });
    prisma.businessClaim.findFirst.mockResolvedValue({ id: 'claim-owner-2' });

    await expect(service.approveClaim('admin-1', 'claim-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves claim, grants owner access, and starts a 30 day trial', async () => {
    prisma.businessClaim.findUnique.mockResolvedValue({
      id: 'claim-1',
      userId: 'user-1',
      salonId: 'salon-1',
      salon: { id: 'salon-1', name: 'Studio Nord' },
    });
    prisma.businessClaim.findFirst.mockResolvedValue(null);
    prisma.businessClaim.update.mockResolvedValueOnce({
      id: 'claim-1',
      userId: 'user-1',
      salonId: 'salon-1',
      status: BusinessClaimStatus.APPROVED,
    });

    const result = await service.approveClaim('admin-1', 'claim-1');

    expect(prisma.salonAdmin.upsert).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: Role.SALON_OWNER },
    });
    expect(prisma.partnerSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          salonId: 'salon-1',
          plan: PartnerSubscriptionPlan.PICKME_PARTNER_TRIAL,
          status: PartnerSubscriptionStatus.TRIAL,
          source: PartnerSubscriptionSource.MANUAL,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'BUSINESS_CLAIM_ACTIVATED',
          entityId: 'claim-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'claim-1',
        status: BusinessClaimStatus.APPROVED,
      }),
    );
  });
});