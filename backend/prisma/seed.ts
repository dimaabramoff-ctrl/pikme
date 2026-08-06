import { BookingStatus, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'TestPass123';

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function plusDays(days: number, hour = 10, minute = 0) {
  const base = new Date();
  base.setDate(base.getDate() + days);
  base.setHours(hour, minute, 0, 0);
  return base;
}

async function main() {
  const passwordHash = await argon2.hash(TEST_PASSWORD);

  await prisma.auditLog.deleteMany();
  await prisma.businessAccessCode.deleteMany();
  await prisma.businessClaim.deleteMany();
  await prisma.partnerAccessRequest.deleteMany();
  await prisma.bookingPayment.deleteMany();
  await prisma.bonusCreditLedger.deleteMany();
  await prisma.partnerSubscription.deleteMany();
  await prisma.voucherRedemption.deleteMany();
  await prisma.voucherCode.deleteMany();
  await prisma.platformCommission.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.review.deleteMany();
  await prisma.homeVisitDetails.deleteMany();
  await prisma.homeVisitQuote.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingExtra.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.scheduleBreak.deleteMany();
  await prisma.workingSchedule.deleteMany();
  await prisma.masterService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.salonMaster.deleteMany();
  await prisma.salonAdmin.deleteMany();
  await prisma.masterPortfolioItem.deleteMany();
  await prisma.salonPhoto.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.masterProfile.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.salon.deleteMany();
  await prisma.user.deleteMany();

  const salons = await Promise.all([
    prisma.salon.create({
      data: {
        slug: 'mitte-style-lab',
        name: 'Mitte Style Lab',
        description: 'Современный городской салон.',
        addressLine: 'Testplatz 10',
        addressLine1: 'Testplatz 10',
        city: 'Berlin',
        country: 'Germany',
        postalCode: '10115',
        latitude: 52.531,
        longitude: 13.384,
        openingHoursJson: { displayText: 'Mo-Fr 09:00 - 18:00' },
      },
    }),
    prisma.salon.create({
      data: {
        slug: 'nord-barber-point',
        name: 'Nord Barber Point',
        description: 'Классические и современные стрижки.',
        addressLine: 'Testweg 22',
        addressLine1: 'Testweg 22',
        city: 'Berlin',
        country: 'Germany',
        postalCode: '13355',
        latitude: 52.552,
        longitude: 13.39,
        openingHoursJson: { displayText: 'Mo-Sa 10:00 - 19:00' },
      },
    }),
    prisma.salon.create({
      data: {
        slug: 'friedrich-glow-studio',
        name: 'Friedrich Glow Studio',
        description: 'Салон с акцентом на окрашивание и укладку.',
        addressLine: 'Demoallee 5',
        addressLine1: 'Demoallee 5',
        city: 'Berlin',
        country: 'Germany',
        postalCode: '10969',
        latitude: 52.507,
        longitude: 13.401,
        openingHoursJson: { displayText: 'Mo-Sa 09:00 - 20:00' },
      },
    }),
  ]);

  const demoSalon = await prisma.salon.create({
    data: {
      slug: 'pickme-demo-salon',
      name: 'PickMe Demo Salon',
      description:
        'Demo-Profil eines vollständig verbundenen PickMe Partners mit realen Live-Daten für Buchung, Teamstatus und Verfügbarkeit.',
      phone: '+49 30 7000100',
      email: 'demo-salon@pickme.local',
      website: 'https://demo.pickme.local/salon',
      addressLine: 'Invalidenstrasse 33',
      addressLine1: 'Invalidenstrasse 33',
      city: 'Berlin',
      country: 'Germany',
      postalCode: '10115',
      latitude: 52.5326,
      longitude: 13.3849,
      isVerified: true,
      homeVisitEnabled: false,
      ratingAverage: 4.9,
      ratingCount: 42,
      openingHoursJson: {
        displayText: 'Mo-Sa 08:30 - 20:30',
        week: {
          mon: '08:30-20:30',
          tue: '08:30-20:30',
          wed: '08:30-20:30',
          thu: '08:30-20:30',
          fri: '08:30-20:30',
          sat: '09:00-18:00',
          sun: 'Geschlossen',
        },
      },
      cancellationPolicyJson: {
        pickmeProfileFlags: {
          isDemoProfile: true,
          isTestProfile: false,
          profileKind: 'DEMO_SALON',
          labels: ['Demo-Profil', 'PickMe Partner'],
        },
        profileMeta: {
          businessType: 'Friseursalon',
          languages: ['Deutsch', 'English', 'Türkçe'],
          amenities: ['WLAN', 'Kaffee', 'Klimaanlage', 'Kinderbereich'],
          parking: 'Parkhaus am Nordbahnhof, 2h gratis',
          paymentMethods: ['IN_SALON', 'CARD', 'PAYPAL', 'APPLE_GOOGLE_PAY'],
          moreInfo:
            'Dieses Profil ist eine kuratierte Live-Demo mit echten Backend-Daten aus der Datenbank (kein presentation fallback).',
        },
      },
    },
  });

  const testbetrieb = await prisma.salon.create({
    data: {
      slug: 'pickme-testbetrieb',
      name: 'PickMe Testbetrieb',
      description:
        'Testbetrieb für sicheren End-to-End Claim- und Owner-Onboarding-Flow.',
      addressLine: 'Warschauer Strasse 10',
      addressLine1: 'Warschauer Strasse 10',
      city: 'Berlin',
      country: 'Germany',
      postalCode: '10243',
      latitude: 52.5059,
      longitude: 13.4486,
      sourceType: 'EXTERNAL',
      externalProvider: 'PICKME_TEST',
      externalPlaceId: 'pickme-testbetrieb-berlin-001',
      isVerified: false,
      homeVisitEnabled: false,
      openingHoursJson: {
        displayText: 'Mo-Sa 10:00 - 19:00',
      },
      cancellationPolicyJson: {
        pickmeProfileFlags: {
          isDemoProfile: false,
          isTestProfile: true,
          profileKind: 'TESTBETRIEB',
          testMarker: 'pickme-testbetrieb-berlin-001',
        },
        profileMeta: {
          externalLike: true,
          connectedState: 'NOT_CONNECTED',
        },
      },
    },
  });

  const users = {
    customer: await prisma.user.create({
      data: {
        email: 'customer@example.test',
        phone: '+49000000001',
        passwordHash,
        role: Role.CUSTOMER,
        isVerified: true,
      },
    }),
    customer2: await prisma.user.create({
      data: {
        email: 'customer2@example.test',
        phone: '+49000000002',
        passwordHash,
        role: Role.CUSTOMER,
        isVerified: true,
      },
    }),
    claimCustomer: await prisma.user.create({
      data: {
        email: 'claim.customer@example.test',
        phone: '+49000000012',
        passwordHash,
        role: Role.CUSTOMER,
        isVerified: true,
      },
    }),
    admin: await prisma.user.create({
      data: {
        email: 'admin@example.test',
        phone: '+49000000003',
        passwordHash,
        role: Role.SALON_OWNER,
        isVerified: true,
      },
    }),
    owner2: await prisma.user.create({
      data: {
        email: 'owner2@example.test',
        phone: '+49000000005',
        passwordHash,
        role: Role.SALON_ADMIN,
        isVerified: true,
      },
    }),
    demoSalonOwner: await prisma.user.create({
      data: {
        email: 'demo.salon.owner@example.test',
        phone: '+49000000021',
        passwordHash,
        role: Role.SALON_OWNER,
        isVerified: true,
      },
    }),
    superAdmin: await prisma.user.create({
      data: {
        email: 'superadmin@example.test',
        phone: '+49000000004',
        passwordHash,
        role: Role.SUPER_ADMIN,
        isVerified: true,
      },
    }),
  };

  const customerProfile = await prisma.customerProfile.create({
    data: {
      userId: users.customer.id,
      firstName: 'Anna',
      lastName: 'Keller',
    },
  });

  await prisma.customerProfile.createMany({
    data: [
      {
        userId: users.customer2.id,
        firstName: 'Lukas',
        lastName: 'Weber',
      },
      {
        userId: users.claimCustomer.id,
        firstName: 'Mira',
        lastName: 'Sommer',
      },
    ],
  });

  await prisma.customerAddress.createMany({
    data: [
      {
        customerProfileId: customerProfile.id,
        label: 'Дом (в зоне)',
        addressLine1: 'Sample Street 11',
        city: 'Berlin',
        country: 'Germany',
        postalCode: '10117',
        latitude: 52.521,
        longitude: 13.405,
        isDefault: true,
      },
      {
        customerProfileId: customerProfile.id,
        label: 'Дом (вне зоны)',
        addressLine1: 'Far Sample Road 99',
        city: 'Berlin',
        country: 'Germany',
        postalCode: '14199',
        latitude: 52.452,
        longitude: 13.274,
        isDefault: false,
      },
    ],
  });

  await prisma.salonAdmin.createMany({
    data: [
      {
        userId: users.admin.id,
        salonId: salons[0].id,
        role: 'OWNER',
      },
      {
        userId: users.owner2.id,
        salonId: salons[1].id,
        role: 'OWNER',
      },
      {
        userId: users.demoSalonOwner.id,
        salonId: demoSalon.id,
        role: 'OWNER',
      },
    ],
  });

  await prisma.salonPhoto.createMany({
    data: [
      {
        salonId: demoSalon.id,
        imageUrl:
          'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1600&q=80',
        sortOrder: 0,
      },
      {
        salonId: demoSalon.id,
        imageUrl:
          'https://images.unsplash.com/photo-1595475038665-5b7f95f32371?auto=format&fit=crop&w=1600&q=80',
        sortOrder: 1,
      },
      {
        salonId: demoSalon.id,
        imageUrl:
          'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1600&q=80',
        sortOrder: 2,
      },
      {
        salonId: testbetrieb.id,
        imageUrl:
          'https://images.unsplash.com/photo-1580618864180-f6d7d39b8ff0?auto=format&fit=crop&w=1600&q=80',
        sortOrder: 0,
      },
    ],
  });

  const serviceTemplates = [
    { name: 'Мужская стрижка', category: 'men_haircut', price: '18', durationMinutes: 30 },
    { name: 'Борода', category: 'beard', price: '12', durationMinutes: 20 },
    { name: 'Стрижка и борода', category: 'combo', price: '28', durationMinutes: 50 },
    { name: 'Женская стрижка', category: 'women_haircut', price: '35', durationMinutes: 60 },
    { name: 'Детская стрижка', category: 'kids_haircut', price: '17', durationMinutes: 30 },
    { name: 'Окрашивание', category: 'coloring', price: '65', durationMinutes: 120 },
    { name: 'Укладка', category: 'styling', price: '30', durationMinutes: 45 },
  ];

  const baseServices = await Promise.all(
    serviceTemplates.map((service, index) =>
      prisma.service.create({
        data: {
          salonId: salons[index % salons.length].id,
          name: service.name,
          category: service.category,
          basePrice: service.price,
          price: service.price,
          durationMinutes: service.durationMinutes,
          availableAtHome: index % 2 === 0,
        },
      }),
    ),
  );

  const demoSalonServices = await Promise.all([
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Herrenschnitt', category: 'herren', basePrice: '30', price: '30', durationMinutes: 35, isActive: true } }),
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Damenschnitt', category: 'damen', basePrice: '44', price: '44', durationMinutes: 55, isActive: true } }),
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Waschen & Föhnen', category: 'styling', basePrice: '32', price: '32', durationMinutes: 40, isActive: true } }),
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Bartpflege', category: 'bart', basePrice: '24', price: '24', durationMinutes: 30, isActive: true } }),
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Farbe', category: 'farbe', basePrice: '79', price: '79', durationMinutes: 115, isActive: true } }),
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Balayage', category: 'balayage', basePrice: '149', price: '149', durationMinutes: 170, isActive: true } }),
    prisma.service.create({ data: { salonId: demoSalon.id, name: 'Kinderhaarschnitt', category: 'kinder', basePrice: '25', price: '25', durationMinutes: 30, isActive: true } }),
  ]);

  const demoZuhauseServices = await Promise.all([
    prisma.service.create({ data: { salonId: null, name: 'Haarschnitt zuhause', category: 'demo_zuhause_haircut', basePrice: '46', price: '46', durationMinutes: 60, availableInSalon: false, availableAtHome: true, isActive: true } }),
    prisma.service.create({ data: { salonId: null, name: 'Styling', category: 'demo_zuhause_styling', basePrice: '38', price: '38', durationMinutes: 45, availableInSalon: false, availableAtHome: true, isActive: true } }),
    prisma.service.create({ data: { salonId: null, name: 'Nägel', category: 'demo_zuhause_nails', basePrice: '49', price: '49', durationMinutes: 70, availableInSalon: false, availableAtHome: true, isActive: true } }),
    prisma.service.create({ data: { salonId: null, name: 'Hausbesuch', category: 'demo_zuhause_visit', basePrice: '20', price: '20', durationMinutes: 20, availableInSalon: false, availableAtHome: true, isActive: true } }),
    prisma.service.create({ data: { salonId: null, name: 'Beratung', category: 'demo_zuhause_consulting', basePrice: '25', price: '25', durationMinutes: 30, availableInSalon: false, availableAtHome: true, isActive: true } }),
  ]);

  const masterUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: 'master@example.test',
        phone: '+49000000100',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'master2@example.test',
        phone: '+49000000101',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'master3@example.test',
        phone: '+49000000102',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'master4@example.test',
        phone: '+49000000103',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'master5@example.test',
        phone: '+49000000104',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'demo.salon.anna@example.test',
        phone: '+49000000121',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'demo.salon.mila@example.test',
        phone: '+49000000122',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'demo.salon.deniz@example.test',
        phone: '+49000000123',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'demo.zuhause.master@example.test',
        phone: '+49000000131',
        passwordHash,
        role: Role.MASTER,
        isVerified: true,
      },
    }),
  ]);

  const baseMasters = await Promise.all(
    masterUsers.slice(0, 5).map((user, index) =>
      prisma.masterProfile.create({
        data: {
          userId: user.id,
          salonId: salons[index % salons.length].id,
          displayName: `Master ${index + 1}`,
          specialization: index % 2 === 0 ? 'Barber' : 'Colorist',
          experienceYears: 2 + index,
          isIndependent: false,
          acceptsBookings: true,
          acceptsUrgentBookings: true,
          acceptsHomeVisits: index % 3 === 0,
          homeVisitRadiusKm: 6,
          homeVisitBaseFee: '8',
          homeVisitPerKmFee: '1.2',
          currentStatus:
            index % 3 === 0
              ? 'AVAILABLE'
              : index % 3 === 1
                ? 'SOON_AVAILABLE'
                : 'BUSY',
          publicLatitude: 52.52 + index * 0.004,
          publicLongitude: 13.39 + index * 0.003,
        },
      }),
    ),
  );

  const demoMasterAnna = await prisma.masterProfile.create({
    data: {
      userId: masterUsers[5].id,
      salonId: demoSalon.id,
      displayName: 'Anna',
      specialization: 'Coloristin',
      biography:
        'Senior Coloristin mit Fokus auf Balayage, Blondkorrektur und präzise Beratungen.',
      experienceYears: 9,
      isIndependent: false,
      acceptsBookings: true,
      acceptsUrgentBookings: true,
      acceptsHomeVisits: false,
      currentStatus: 'AVAILABLE',
      availableAt: null,
      minutesUntilAvailable: 0,
      avatarUrl:
        'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80',
      isVerified: true,
      ratingAverage: 4.95,
      reviewCount: 18,
      completedBookingsCount: 126,
    },
  });

  const demoMasterMila = await prisma.masterProfile.create({
    data: {
      userId: masterUsers[6].id,
      salonId: demoSalon.id,
      displayName: 'Mila',
      specialization: 'Damen & Styling',
      biography: 'Spezialistin für Finish, Blowout und Event-Styling mit Zeitmanagement im 20-Minuten-Takt.',
      experienceYears: 7,
      isIndependent: false,
      acceptsBookings: true,
      acceptsUrgentBookings: true,
      acceptsHomeVisits: false,
      currentStatus: 'BUSY',
      availableAt: plusMinutes(70),
      minutesUntilAvailable: 70,
      avatarUrl:
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
      isVerified: true,
      ratingAverage: 4.86,
      reviewCount: 14,
      completedBookingsCount: 101,
    },
  });

  const demoMasterDeniz = await prisma.masterProfile.create({
    data: {
      userId: masterUsers[7].id,
      salonId: demoSalon.id,
      displayName: 'Deniz',
      specialization: 'Herren & Bart',
      biography: 'Fade, Kontur und präzise Bartlinien. Hohe Taktung mit kurzen Umstiegszeiten.',
      experienceYears: 8,
      isIndependent: false,
      acceptsBookings: true,
      acceptsUrgentBookings: true,
      acceptsHomeVisits: false,
      currentStatus: 'SOON_AVAILABLE',
      availableAt: plusMinutes(25),
      minutesUntilAvailable: 25,
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80',
      isVerified: true,
      ratingAverage: 4.8,
      reviewCount: 10,
      completedBookingsCount: 88,
    },
  });

  const demoZuhauseMaster = await prisma.masterProfile.create({
    data: {
      userId: masterUsers[8].id,
      salonId: null,
      displayName: 'PickMe Demo Zuhause',
      specialization: 'Selbstständiger Anbieter für Haare, Styling und Nails zuhause',
      biography:
        'DEMO_ZUHAUSE_PROFILE: Angaben vom Anbieter. Fokus auf Hausbesuche im Radius Berlin-Mitte/Prenzlauer Berg.',
      experienceYears: 6,
      isIndependent: true,
      acceptsBookings: true,
      acceptsUrgentBookings: true,
      acceptsHomeVisits: true,
      homeVisitRadiusKm: 10,
      homeVisitBaseFee: '9',
      homeVisitPerKmFee: '1.4',
      currentStatus: 'AVAILABLE',
      availableAt: plusMinutes(15),
      minutesUntilAvailable: 15,
      publicLatitude: 52.529,
      publicLongitude: 13.41,
      avatarUrl:
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
      isVerified: true,
      ratingAverage: 4.92,
      reviewCount: 24,
      completedBookingsCount: 143,
    },
  });

  const allMasters = [
    ...baseMasters,
    demoMasterAnna,
    demoMasterMila,
    demoMasterDeniz,
    demoZuhauseMaster,
  ];

  await prisma.salonMaster.createMany({
    data: [
      ...allMasters
        .filter((master) => !!master.salonId)
        .map((master) => ({
          salonId: master.salonId!,
          masterId: master.id,
        })),
    ],
  });

  await prisma.masterService.createMany({
    data: [
      ...baseMasters.flatMap((master, masterIndex) =>
        baseServices
          .filter((_, serviceIndex) => (masterIndex + serviceIndex) % 2 === 0)
          .map((service) => ({
            masterId: master.id,
            serviceId: service.id,
            availableAtHome: master.acceptsHomeVisits,
          })),
      ),
      {
        masterId: demoMasterAnna.id,
        serviceId: demoSalonServices[1].id,
      },
      {
        masterId: demoMasterAnna.id,
        serviceId: demoSalonServices[2].id,
      },
      {
        masterId: demoMasterAnna.id,
        serviceId: demoSalonServices[4].id,
      },
      {
        masterId: demoMasterAnna.id,
        serviceId: demoSalonServices[5].id,
      },
      {
        masterId: demoMasterMila.id,
        serviceId: demoSalonServices[1].id,
      },
      {
        masterId: demoMasterMila.id,
        serviceId: demoSalonServices[2].id,
      },
      {
        masterId: demoMasterMila.id,
        serviceId: demoSalonServices[6].id,
      },
      {
        masterId: demoMasterDeniz.id,
        serviceId: demoSalonServices[0].id,
      },
      {
        masterId: demoMasterDeniz.id,
        serviceId: demoSalonServices[3].id,
      },
      {
        masterId: demoMasterDeniz.id,
        serviceId: demoSalonServices[6].id,
      },
      ...demoZuhauseServices.map((service) => ({
        masterId: demoZuhauseMaster.id,
        serviceId: service.id,
        availableInSalon: false,
        availableAtHome: true,
      })),
    ],
  });

  await prisma.workingSchedule.createMany({
    data: [
      ...baseMasters.flatMap((master) =>
        [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          masterId: master.id,
          dayOfWeek,
          shiftStart: '09:00',
          shiftEnd: '18:00',
          acceptsBookings: true,
          supportsHomeVisits: master.acceptsHomeVisits,
        })),
      ),
      ...[1, 2, 3, 4, 5, 6].flatMap((dayOfWeek) => ([
        {
          masterId: demoMasterAnna.id,
          salonId: demoSalon.id,
          dayOfWeek,
          shiftStart: '08:30',
          shiftEnd: '17:30',
          acceptsBookings: true,
          supportsHomeVisits: false,
        },
        {
          masterId: demoMasterMila.id,
          salonId: demoSalon.id,
          dayOfWeek,
          shiftStart: '09:00',
          shiftEnd: '19:00',
          acceptsBookings: true,
          supportsHomeVisits: false,
        },
        {
          masterId: demoMasterDeniz.id,
          salonId: demoSalon.id,
          dayOfWeek,
          shiftStart: '10:00',
          shiftEnd: '20:00',
          acceptsBookings: true,
          supportsHomeVisits: false,
        },
        {
          masterId: demoZuhauseMaster.id,
          dayOfWeek,
          shiftStart: '09:00',
          shiftEnd: '18:00',
          acceptsBookings: true,
          supportsHomeVisits: true,
          bookingBufferMinutes: 10,
          homeVisitBufferMinutes: 25,
        },
      ])),
    ],
  });

  const milaMondaySchedule = await prisma.workingSchedule.findFirst({
    where: { masterId: demoMasterMila.id, dayOfWeek: 1 },
    select: { id: true },
  });
  const zuhauseMondaySchedule = await prisma.workingSchedule.findFirst({
    where: { masterId: demoZuhauseMaster.id, dayOfWeek: 1 },
    select: { id: true },
  });

  if (milaMondaySchedule?.id) {
    await prisma.scheduleBreak.createMany({
      data: [
        { scheduleId: milaMondaySchedule.id, startTime: '13:00', endTime: '13:45', reason: 'Pause' },
      ],
    });
  }

  if (zuhauseMondaySchedule?.id) {
    await prisma.scheduleBreak.createMany({
      data: [
        { scheduleId: zuhauseMondaySchedule.id, startTime: '12:30', endTime: '13:00', reason: 'Pause' },
      ],
    });
  }

  const busyBookingForMila = await prisma.booking.create({
    data: {
      customerProfileId: customerProfile.id,
      masterId: demoMasterMila.id,
      salonId: demoSalon.id,
      serviceId: demoSalonServices[1].id,
      status: BookingStatus.confirmed,
      startsAt: plusMinutes(-10),
      endsAt: plusMinutes(50),
      totalPrice: '44',
      currency: 'EUR',
    },
  });

  const soonBookingForDeniz = await prisma.booking.create({
    data: {
      customerProfileId: customerProfile.id,
      masterId: demoMasterDeniz.id,
      salonId: demoSalon.id,
      serviceId: demoSalonServices[0].id,
      status: BookingStatus.confirmed,
      startsAt: plusMinutes(40),
      endsAt: plusMinutes(75),
      totalPrice: '30',
      currency: 'EUR',
    },
  });

  const zuhauseBooking = await prisma.booking.create({
    data: {
      customerProfileId: customerProfile.id,
      masterId: demoZuhauseMaster.id,
      salonId: null,
      serviceId: demoZuhauseServices[0].id,
      status: BookingStatus.confirmed,
      startsAt: plusMinutes(90),
      endsAt: plusMinutes(150),
      totalPrice: '46',
      currency: 'EUR',
      isHomeVisit: true,
    },
  });

  const completedBooking = await prisma.booking.create({
    data: {
      customerProfileId: customerProfile.id,
      masterId: demoMasterAnna.id,
      salonId: demoSalon.id,
      serviceId: demoSalonServices[5].id,
      status: BookingStatus.completed,
      startsAt: plusDays(-2, 11, 0),
      endsAt: plusDays(-2, 13, 50),
      totalPrice: '149',
      currency: 'EUR',
    },
  });

  const completedZuhauseBooking = await prisma.booking.create({
    data: {
      customerProfileId: customerProfile.id,
      masterId: demoZuhauseMaster.id,
      salonId: null,
      serviceId: demoZuhauseServices[1].id,
      status: BookingStatus.completed,
      startsAt: plusDays(-3, 15, 0),
      endsAt: plusDays(-3, 15, 45),
      totalPrice: '38',
      currency: 'EUR',
      isHomeVisit: true,
    },
  });

  await prisma.bookingStatusHistory.createMany({
    data: [
      {
        bookingId: busyBookingForMila.id,
        fromStatus: BookingStatus.pending,
        toStatus: BookingStatus.confirmed,
        changedBy: users.demoSalonOwner.id,
      },
      {
        bookingId: soonBookingForDeniz.id,
        fromStatus: BookingStatus.pending,
        toStatus: BookingStatus.confirmed,
        changedBy: users.demoSalonOwner.id,
      },
      {
        bookingId: zuhauseBooking.id,
        fromStatus: BookingStatus.pending,
        toStatus: BookingStatus.confirmed,
        changedBy: users.demoSalonOwner.id,
      },
      {
        bookingId: completedBooking.id,
        fromStatus: BookingStatus.confirmed,
        toStatus: BookingStatus.completed,
        changedBy: users.demoSalonOwner.id,
      },
      {
        bookingId: completedZuhauseBooking.id,
        fromStatus: BookingStatus.confirmed,
        toStatus: BookingStatus.completed,
        changedBy: users.demoSalonOwner.id,
      },
    ],
  });

  await prisma.review.createMany({
    data: [
      {
        bookingId: completedBooking.id,
        customerProfileId: customerProfile.id,
        masterId: demoMasterAnna.id,
        salonId: demoSalon.id,
        rating: 5,
        text: 'Top Beratung und perfektes Ergebnis.',
      },
      {
        bookingId: completedZuhauseBooking.id,
        customerProfileId: customerProfile.id,
        masterId: demoZuhauseMaster.id,
        salonId: null,
        rating: 5,
        text: 'Pünktlich, sauber gearbeitet und die freie Zeitfenster-Anzeige stimmt mit dem Terminplan.',
      },
    ],
  });

  await prisma.masterPortfolioItem.createMany({
    data: [
      {
        masterId: demoMasterAnna.id,
        imageUrl:
          'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80',
        title: 'Balayage Soft Blonde',
        description: 'Vorher/Nachher',
        serviceCategory: 'balayage',
      },
      {
        masterId: demoMasterMila.id,
        imageUrl:
          'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
        title: 'Event Styling',
        description: 'Volumen und Halt',
        serviceCategory: 'styling',
      },
      {
        masterId: demoMasterDeniz.id,
        imageUrl:
          'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=80',
        title: 'Beard Contour',
        description: 'Konturen + Pflege',
        serviceCategory: 'bart',
      },
      {
        masterId: demoZuhauseMaster.id,
        imageUrl:
          'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1200&q=80',
        title: 'Home Styling Set',
        description: 'Compact home setup',
        serviceCategory: 'demo_zuhause_styling',
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: users.customer.id,
        type: 'BOOKING_CONFIRMED',
        title: 'Запись подтверждена',
        message: 'Ваша запись подтверждена мастером.',
      },
      {
        userId: users.demoSalonOwner.id,
        type: 'BOOKING_CREATED',
        title: 'Новая запись',
        message: 'Появилась новая запись в Demo Salon.',
      },
    ],
  });

  console.log('Seed completed successfully');
  console.log('Demo profiles created:');
  console.log(`- Demo salon slug: ${demoSalon.slug}, id: ${demoSalon.id}`);
  console.log(`- Demo zuhause master id: ${demoZuhauseMaster.id}`);
  console.log(`- Testbetrieb slug: ${testbetrieb.slug}, id: ${testbetrieb.id}, marker: pickme-testbetrieb-berlin-001`);
  console.log('Accounts:');
  console.log('- claim.customer@example.test / TestPass123');
  console.log('- superadmin@example.test / TestPass123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
