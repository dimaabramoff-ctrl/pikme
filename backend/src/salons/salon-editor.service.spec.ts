import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MasterWorkStatus, Role } from '@prisma/client';
import { SalonEditorService } from './salon-editor.service';

describe('SalonEditorService', () => {
  const baseSalon = {
    id: 'salon-1',
    name: 'Studio Nord',
    description: 'Alte Beschreibung',
    phone: '+49 30 111111',
    email: 'studio@example.test',
    website: 'https://studio.example.test',
    addressLine: 'Testweg 1',
    city: 'Berlin',
    postalCode: '10115',
    sourceType: 'PICKME',
    openingHoursJson: { displayText: 'Mo-Fr 09:00 - 18:00' },
    cancellationPolicyJson: null,
    updatedAt: new Date('2026-08-05T10:00:00.000Z'),
    photos: [{ id: 'photo-1', imageUrl: 'https://img/1.jpg', sortOrder: 0 }],
    services: [{
      id: 'service-1',
      name: 'Herrenschnitt',
      description: 'Kurz und sauber',
      category: 'Herren',
      basePrice: 27,
      durationMinutes: 30,
      availableInSalon: true,
      availableAtHome: false,
      isActive: true,
    }],
    masters: [{
      masterId: 'master-1',
      master: {
        displayName: 'Anna',
        specialization: 'Coloration',
        biography: 'Bio',
        experienceYears: 5,
        acceptsHomeVisits: false,
        currentStatus: MasterWorkStatus.AVAILABLE,
        avatarUrl: null,
        services: [{ serviceId: 'service-1' }],
        schedules: [{
          dayOfWeek: 1,
          shiftStart: '09:00',
          shiftEnd: '18:00',
          isDayOff: false,
          acceptsBookings: true,
          acceptsUrgentBookings: true,
          supportsHomeVisits: false,
          breaks: [],
        }],
      },
    }],
  };

  const prisma = {
    salon: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    salonAdmin: {
      findFirst: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    service: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    salonMaster: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    masterProfile: {
      create: jest.fn(),
      update: jest.fn(),
    },
    masterService: {
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    workingSchedule: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
    scheduleBreak: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    salonPhoto: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)),
  } as any;

  let service: SalonEditorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SalonEditorService(prisma);
    prisma.salon.findUnique.mockResolvedValue({ ...baseSalon });
    prisma.salonAdmin.findFirst.mockResolvedValue({ id: 'membership-1', isActive: true });
  });

  it('saves draft without changing the public salon fields', async () => {
    const state = await service.getEditorState('salon-1', { id: 'user-1', role: Role.SALON_OWNER });

    const draft = {
      ...state.draft,
      overview: {
        ...state.draft.overview,
        name: 'Neuer Draft Name',
        description: 'Nur im Entwurf sichtbar',
      },
    };

    await service.saveDraft('salon-1', { id: 'user-1', role: Role.SALON_OWNER }, draft);

    expect(prisma.salon.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'salon-1' },
      data: expect.objectContaining({
        cancellationPolicyJson: expect.objectContaining({
          pickmeOwnerEditor: expect.objectContaining({
            draft: expect.objectContaining({
              overview: expect.objectContaining({ name: 'Neuer Draft Name' }),
            }),
          }),
        }),
      }),
    }));
    expect(prisma.salon.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Neuer Draft Name' }),
    }));
  });

  it('rejects publish when required fields are missing', async () => {
    prisma.salon.findUnique.mockResolvedValueOnce({
      ...baseSalon,
      cancellationPolicyJson: {
        pickmeOwnerEditor: {
          draft: {
            overview: {
              name: '',
              businessType: '',
              tagline: '',
              description: '',
              phone: '',
              email: '',
              website: '',
              addressLine: '',
              city: '',
              postalCode: '',
              openingHoursText: '',
              languages: [],
              amenities: [],
              parking: '',
              accessibility: '',
              paymentMethods: [],
              foundedYear: null,
            },
            moreInfo: {
              about: '',
              history: '',
              serviceDirections: [],
              rules: [],
              teamNote: '',
            },
            services: [],
            staff: [],
            photos: [],
            coverPhotoId: null,
          },
        },
      },
    });

    await expect(service.publishDraft('salon-1', { id: 'user-1', role: Role.SALON_OWNER })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks non owners from reading editor state', async () => {
    prisma.salonAdmin.findFirst.mockResolvedValue(null);

    await expect(service.getEditorState('salon-1', { id: 'user-2', role: Role.CUSTOMER })).rejects.toBeInstanceOf(ForbiddenException);
  });
});