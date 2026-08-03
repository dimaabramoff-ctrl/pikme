-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('CUSTOMER', 'MASTER', 'SALON_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "public"."PresenceStatus" AS ENUM ('ONLINE', 'AWAY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "public"."MasterWorkStatus" AS ENUM ('AVAILABLE', 'SOON_AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('pending', 'confirmed', 'inProgress', 'completed', 'cancelled', 'rejected', 'noShow');

-- CreateEnum
CREATE TYPE "public"."FavoriteEntityType" AS ENUM ('SALON', 'MASTER');

-- CreateEnum
CREATE TYPE "public"."CatalogSourceType" AS ENUM ('PICKME', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('pending', 'authorized', 'paid', 'failed', 'refunded', 'partiallyRefunded', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'BOOKING_STARTS_SOON', 'BOOKING_COMPLETED', 'NEW_REVIEW', 'SCHEDULE_CHANGED', 'PRICE_CHANGED', 'SALON_MESSAGE');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "presenceStatus" "public"."PresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "provider" "public"."AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "providerAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MasterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT,
    "displayName" TEXT NOT NULL,
    "sourceType" "public"."CatalogSourceType" NOT NULL DEFAULT 'PICKME',
    "externalProvider" TEXT,
    "externalPlaceId" TEXT,
    "specialization" TEXT,
    "biography" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "isIndependent" BOOLEAN NOT NULL DEFAULT false,
    "acceptsBookings" BOOLEAN NOT NULL DEFAULT true,
    "acceptsUrgentBookings" BOOLEAN NOT NULL DEFAULT true,
    "acceptsHomeVisits" BOOLEAN NOT NULL DEFAULT false,
    "homeVisitRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "homeVisitBaseFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "homeVisitPerKmFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currentStatus" "public"."MasterWorkStatus" NOT NULL DEFAULT 'OFFLINE',
    "availableAt" TIMESTAMP(3),
    "minutesUntilAvailable" INTEGER,
    "publicLatitude" DOUBLE PRECISION,
    "publicLongitude" DOUBLE PRECISION,
    "avatarUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "completedBookingsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Salon" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "addressLine" TEXT NOT NULL,
    "addressLine1" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'DE',
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "openingStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceType" "public"."CatalogSourceType" NOT NULL DEFAULT 'PICKME',
    "externalProvider" TEXT,
    "externalPlaceId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "homeVisitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "openingHoursJson" JSONB,
    "cancellationPolicyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalonAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "role" TEXT DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalonAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalonMaster" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "role" TEXT DEFAULT 'TEAM_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "acceptsHomeVisits" BOOLEAN NOT NULL DEFAULT false,
    "temporarilyDisabled" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalonMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Service" (
    "id" TEXT NOT NULL,
    "salonId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "basePrice" DECIMAL(65,30) NOT NULL,
    "price" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "durationMinutes" INTEGER NOT NULL,
    "availableInSalon" BOOLEAN NOT NULL DEFAULT true,
    "availableAtHome" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MasterService" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceOverride" DECIMAL(65,30),
    "durationMinutesOverride" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableInSalon" BOOLEAN NOT NULL DEFAULT true,
    "availableAtHome" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkingSchedule" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "salonId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "acceptsBookings" BOOLEAN NOT NULL DEFAULT true,
    "acceptsUrgentBookings" BOOLEAN NOT NULL DEFAULT true,
    "supportsHomeVisits" BOOLEAN NOT NULL DEFAULT false,
    "bookingBufferMinutes" INTEGER NOT NULL DEFAULT 5,
    "homeVisitBufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleBreak" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "ScheduleBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "salonId" TEXT,
    "serviceId" TEXT NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'pending',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isHomeVisit" BOOLEAN NOT NULL DEFAULT false,
    "cancellationPolicySnapshot" JSONB,
    "commissionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingExtra" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "BookingExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingStatusHistory" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromStatus" "public"."BookingStatus",
    "toStatus" "public"."BookingStatus" NOT NULL,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HomeVisitDetails" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationLatitude" DOUBLE PRECISION NOT NULL,
    "destinationLongitude" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "arrivalWindowStart" TIMESTAMP(3) NOT NULL,
    "arrivalWindowEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeVisitDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HomeVisitQuote" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationLatitude" DOUBLE PRECISION NOT NULL,
    "destinationLongitude" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "travelMinutes" INTEGER NOT NULL,
    "serviceDurationMinutes" INTEGER NOT NULL,
    "arrivalWindowStart" TIMESTAMP(3) NOT NULL,
    "arrivalWindowEnd" TIMESTAMP(3) NOT NULL,
    "priceBreakdownJson" JSONB NOT NULL,
    "tariffVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeVisitQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "salonId" TEXT,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Favorite" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "entityType" "public"."FavoriteEntityType" NOT NULL,
    "salonId" TEXT,
    "masterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "parentTokenId" TEXT,
    "replacedByTokenId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MasterPortfolioItem" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "serviceCategory" TEXT,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterPortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalonPhoto" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalonPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "externalPaymentIntentId" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "platformCommissionAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "reason" TEXT,
    "externalRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlatformCommission" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "percentageRate" DECIMAL(65,30),
    "fixedFee" DECIMAL(65,30),
    "homeVisitFee" DECIMAL(65,30),
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "public"."User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "public"."CustomerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterProfile_userId_key" ON "public"."MasterProfile"("userId");

-- CreateIndex
CREATE INDEX "MasterProfile_salonId_idx" ON "public"."MasterProfile"("salonId");

-- CreateIndex
CREATE INDEX "MasterProfile_isVerified_idx" ON "public"."MasterProfile"("isVerified");

-- CreateIndex
CREATE INDEX "MasterProfile_isIndependent_idx" ON "public"."MasterProfile"("isIndependent");

-- CreateIndex
CREATE UNIQUE INDEX "Salon_slug_key" ON "public"."Salon"("slug");

-- CreateIndex
CREATE INDEX "Salon_name_idx" ON "public"."Salon"("name");

-- CreateIndex
CREATE INDEX "Salon_city_idx" ON "public"."Salon"("city");

-- CreateIndex
CREATE INDEX "Salon_postalCode_idx" ON "public"."Salon"("postalCode");

-- CreateIndex
CREATE INDEX "Salon_latitude_longitude_idx" ON "public"."Salon"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "Salon_isVerified_idx" ON "public"."Salon"("isVerified");

-- CreateIndex
CREATE INDEX "SalonAdmin_salonId_idx" ON "public"."SalonAdmin"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "SalonAdmin_userId_salonId_key" ON "public"."SalonAdmin"("userId", "salonId");

-- CreateIndex
CREATE INDEX "SalonMaster_masterId_idx" ON "public"."SalonMaster"("masterId");

-- CreateIndex
CREATE INDEX "SalonMaster_salonId_isActive_idx" ON "public"."SalonMaster"("salonId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SalonMaster_salonId_masterId_key" ON "public"."SalonMaster"("salonId", "masterId");

-- CreateIndex
CREATE INDEX "Service_salonId_idx" ON "public"."Service"("salonId");

-- CreateIndex
CREATE INDEX "Service_category_idx" ON "public"."Service"("category");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "public"."Service"("isActive");

-- CreateIndex
CREATE INDEX "MasterService_serviceId_idx" ON "public"."MasterService"("serviceId");

-- CreateIndex
CREATE INDEX "MasterService_isActive_idx" ON "public"."MasterService"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MasterService_masterId_serviceId_key" ON "public"."MasterService"("masterId", "serviceId");

-- CreateIndex
CREATE INDEX "WorkingSchedule_masterId_dayOfWeek_idx" ON "public"."WorkingSchedule"("masterId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "WorkingSchedule_salonId_idx" ON "public"."WorkingSchedule"("salonId");

-- CreateIndex
CREATE INDEX "ScheduleBreak_scheduleId_idx" ON "public"."ScheduleBreak"("scheduleId");

-- CreateIndex
CREATE INDEX "Booking_masterId_startsAt_endsAt_idx" ON "public"."Booking"("masterId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Booking_customerProfileId_startsAt_idx" ON "public"."Booking"("customerProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "BookingExtra_bookingId_idx" ON "public"."BookingExtra"("bookingId");

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_createdAt_idx" ON "public"."BookingStatusHistory"("bookingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HomeVisitDetails_bookingId_key" ON "public"."HomeVisitDetails"("bookingId");

-- CreateIndex
CREATE INDEX "HomeVisitQuote_masterId_expiresAt_idx" ON "public"."HomeVisitQuote"("masterId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "public"."Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_masterId_idx" ON "public"."Review"("masterId");

-- CreateIndex
CREATE INDEX "Review_salonId_idx" ON "public"."Review"("salonId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "public"."Review"("rating");

-- CreateIndex
CREATE INDEX "Favorite_customerProfileId_idx" ON "public"."Favorite"("customerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_customerProfileId_entityType_salonId_masterId_key" ON "public"."Favorite"("customerProfileId", "entityType", "salonId", "masterId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "public"."Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "public"."RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerProfileId_idx" ON "public"."CustomerAddress"("customerProfileId");

-- CreateIndex
CREATE INDEX "MasterPortfolioItem_masterId_idx" ON "public"."MasterPortfolioItem"("masterId");

-- CreateIndex
CREATE INDEX "SalonPhoto_salonId_idx" ON "public"."SalonPhoto"("salonId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "public"."Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "public"."Refund"("paymentId");

-- CreateIndex
CREATE INDEX "PlatformCommission_bookingId_idx" ON "public"."PlatformCommission"("bookingId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "public"."CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterProfile" ADD CONSTRAINT "MasterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterProfile" ADD CONSTRAINT "MasterProfile_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalonAdmin" ADD CONSTRAINT "SalonAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalonAdmin" ADD CONSTRAINT "SalonAdmin_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalonMaster" ADD CONSTRAINT "SalonMaster_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalonMaster" ADD CONSTRAINT "SalonMaster_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Service" ADD CONSTRAINT "Service_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterService" ADD CONSTRAINT "MasterService_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterService" ADD CONSTRAINT "MasterService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkingSchedule" ADD CONSTRAINT "WorkingSchedule_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleBreak" ADD CONSTRAINT "ScheduleBreak_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."WorkingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingExtra" ADD CONSTRAINT "BookingExtra_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HomeVisitDetails" ADD CONSTRAINT "HomeVisitDetails_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HomeVisitDetails" ADD CONSTRAINT "HomeVisitDetails_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."HomeVisitQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HomeVisitQuote" ADD CONSTRAINT "HomeVisitQuote_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Favorite" ADD CONSTRAINT "Favorite_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "public"."CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MasterPortfolioItem" ADD CONSTRAINT "MasterPortfolioItem_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "public"."MasterProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalonPhoto" ADD CONSTRAINT "SalonPhoto_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlatformCommission" ADD CONSTRAINT "PlatformCommission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
