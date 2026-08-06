import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { SalonsModule } from './salons/salons.module';
import { MastersModule } from './masters/masters.module';
import { ServicesModule } from './services/services.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { CatalogProvidersModule } from './catalog-providers/catalog-providers.module';
import { CatalogModule } from './catalog/catalog.module';
import { BookingsModule } from './bookings/bookings.module';
import { BusinessClaimsModule } from './business-claims/business-claims.module';
import { BusinessAccessCodesModule } from './business-access-codes/business-access-codes.module';
import { AdminModule } from './admin/admin.module';
import { PartnerAccessRequestsModule } from './partner-access-requests/partner-access-requests.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SalonStaffDraftsModule } from './salon-staff-drafts/salon-staff-drafts.module';
import { AppConfigModule } from './config/config.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '.env.local'),
        join(__dirname, '..', '.env'),
      ],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit:
          process.env.NODE_ENV === 'e2e' || process.env.NODE_ENV === 'test'
            ? 1000
            : 120,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    SalonsModule,
    MastersModule,
    ServicesModule,
    SchedulesModule,
    ReviewsModule,
    FavoritesModule,
    PortfolioModule,
    CatalogProvidersModule,
    CatalogModule,
    BookingsModule,
    BusinessClaimsModule,
    BusinessAccessCodesModule,
    PartnerAccessRequestsModule,
    VouchersModule,
    NotificationsModule,
    AdminModule,
    SalonStaffDraftsModule,
    AppConfigModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
