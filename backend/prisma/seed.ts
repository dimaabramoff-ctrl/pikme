import { BookingStatus, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();
const TEST_PASSWORD = 'TestPass123';

async function main() {
  const passwordHash = await argon2.hash(TEST_PASSWORD);

  await prisma.auditLog.deleteMany();
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
      },
    }),
  ]);

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
    admin: await prisma.user.create({
      data: {
        email: 'admin@example.test',
        phone: '+49000000003',
        passwordHash,
        role: Role.SALON_ADMIN,
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

  await prisma.customerProfile.create({
    data: {
      userId: users.customer2.id,
      firstName: 'Lukas',
      lastName: 'Weber',
    },
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

  await prisma.salonAdmin.create({
    data: {
      userId: users.admin.id,
      salonId: salons[0].id,
    },
  });

  const masterUsers = await Promise.all(
    Array.from({ length: 10 }).map((_, index) =>
      prisma.user.create({
        data: {
          email: index === 0 ? 'master@example.test' : `master${index + 1}@example.test`,
          phone: `+490000001${String(index).padStart(2, '0')}`,
          passwordHash,
          role: Role.MASTER,
          isVerified: true,
        },
      }),
    ),
  );

  const masters = await Promise.all(
    masterUsers.map((user, index) =>
      prisma.masterProfile.create({
        data: {
          userId: user.id,
          salonId: index < 7 ? salons[index % salons.length].id : null,
          displayName: `Master ${index + 1}`,
          specialization: index % 2 === 0 ? 'Barber' : 'Colorist',
          experienceYears: 2 + index,
          isIndependent: index >= 7,
          acceptsBookings: true,
          acceptsUrgentBookings: true,
          acceptsHomeVisits: index % 3 === 0,
          homeVisitRadiusKm: 6,
          homeVisitBaseFee: '8',
          homeVisitPerKmFee: '1.2',
          currentStatus: index % 3 === 0 ? 'AVAILABLE' : index % 3 === 1 ? 'SOON_AVAILABLE' : 'BUSY',
          publicLatitude: 52.52 + index * 0.004,
          publicLongitude: 13.39 + index * 0.003,
        },
      }),
    ),
  );

  await prisma.salonMaster.createMany({
    data: masters
      .filter((master) => !!master.salonId)
      .map((master) => ({
        salonId: master.salonId!,
        masterId: master.id,
      })),
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

  const services = await Promise.all(
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

  await prisma.masterService.createMany({
    data: masters.flatMap((master, masterIndex) =>
      services
        .filter((_, serviceIndex) => (masterIndex + serviceIndex) % 2 === 0)
        .map((service) => ({
          masterId: master.id,
          serviceId: service.id,
        })),
    ),
  });

  await prisma.workingSchedule.createMany({
    data: masters.flatMap((master) =>
      [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        masterId: master.id,
        dayOfWeek,
        shiftStart: '09:00',
        shiftEnd: '18:00',
        acceptsBookings: true,
        supportsHomeVisits: master.acceptsHomeVisits,
      })),
    ),
  });

  const booking = await prisma.booking.create({
    data: {
      customerProfileId: customerProfile.id,
      masterId: masters[0].id,
      salonId: masters[0].salonId,
      serviceId: services[0].id,
      status: BookingStatus.confirmed,
      startsAt: new Date(Date.now() + 30 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      totalPrice: '18',
      currency: 'EUR',
    },
  });

  await prisma.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      fromStatus: BookingStatus.pending,
      toStatus: BookingStatus.confirmed,
      changedBy: users.admin.id,
    },
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
        userId: users.admin.id,
        type: 'BOOKING_CREATED',
        title: 'Новая запись',
        message: 'Появилась новая запись в салоне.',
      },
    ],
  });

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
