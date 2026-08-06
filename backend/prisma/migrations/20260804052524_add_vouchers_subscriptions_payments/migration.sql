-- CreateEnum
CREATE TYPE "public"."VoucherCodeType" AS ENUM ('PARTNER_MONTH', 'PARTNER_YEAR', 'CLIENT_DISCOUNT', 'BOOKING_CREDIT', 'PROMO_TRIAL');

-- CreateEnum
CREATE TYPE "public"."VoucherCodeStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."VoucherRedemptionStatus" AS ENUM ('APPLIED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "public"."PartnerSubscriptionPlan" AS ENUM ('PICKME_PARTNER_MONTHLY', 'PICKME_PARTNER_YEARLY', 'PICKME_PARTNER_TRIAL');

-- CreateEnum
CREATE TYPE "public"."PartnerSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PartnerSubscriptionSource" AS ENUM ('VOUCHER', 'MANUAL', 'PAYMENT');

-- CreateEnum
CREATE TYPE "public"."BookingPaymentProvider" AS ENUM ('STRIPE', 'MANUAL_IN_SALON', 'DEMO');

-- CreateEnum
CREATE TYPE "public"."BookingPaymentStatus" AS ENUM ('PENDING', 'REQUIRES_ACTION', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "public"."BonusCreditEventType" AS ENUM ('CREDIT_GRANTED', 'CREDIT_USED', 'CREDIT_EXPIRED', 'CREDIT_REVERSED');

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SALON_OWNER';

-- CreateTable
CREATE TABLE "public"."VoucherCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "type" "public"."VoucherCodeType" NOT NULL,
    "valueAmount" DECIMAL(65,30),
    "valuePercent" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'EUR',
    "durationDays" INTEGER,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "public"."VoucherCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedUserId" TEXT,
    "assignedSalonId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "VoucherCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VoucherRedemption" (
    "id" TEXT NOT NULL,
    "voucherCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT,
    "bookingId" TEXT,
    "status" "public"."VoucherRedemptionStatus" NOT NULL DEFAULT 'APPLIED',
    "amountApplied" DECIMAL(65,30),
    "percentApplied" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'EUR',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PartnerSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "plan" "public"."PartnerSubscriptionPlan" NOT NULL,
    "status" "public"."PartnerSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "public"."PartnerSubscriptionSource" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "voucherRedemptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BonusCreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "public"."BonusCreditEventType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "expiresAt" TIMESTAMP(3),
    "voucherCodeId" TEXT,
    "bookingId" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonusCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BookingPayment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "provider" "public"."BookingPaymentProvider" NOT NULL,
    "providerPaymentIntentId" TEXT,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "travelFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "platformFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."BookingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "voucherRedemptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "BookingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoucherCode_codePrefix_idx" ON "public"."VoucherCode"("codePrefix");

-- CreateIndex
CREATE INDEX "VoucherCode_type_idx" ON "public"."VoucherCode"("type");

-- CreateIndex
CREATE INDEX "VoucherCode_status_idx" ON "public"."VoucherCode"("status");

-- CreateIndex
CREATE INDEX "VoucherCode_assignedUserId_idx" ON "public"."VoucherCode"("assignedUserId");

-- CreateIndex
CREATE INDEX "VoucherCode_assignedSalonId_idx" ON "public"."VoucherCode"("assignedSalonId");

-- CreateIndex
CREATE INDEX "VoucherCode_createdByUserId_idx" ON "public"."VoucherCode"("createdByUserId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_voucherCodeId_idx" ON "public"."VoucherRedemption"("voucherCodeId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_userId_idx" ON "public"."VoucherRedemption"("userId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_salonId_idx" ON "public"."VoucherRedemption"("salonId");

-- CreateIndex
CREATE INDEX "VoucherRedemption_bookingId_idx" ON "public"."VoucherRedemption"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherRedemption_voucherCodeId_userId_bookingId_key" ON "public"."VoucherRedemption"("voucherCodeId", "userId", "bookingId");

-- CreateIndex
CREATE INDEX "PartnerSubscription_userId_salonId_idx" ON "public"."PartnerSubscription"("userId", "salonId");

-- CreateIndex
CREATE INDEX "PartnerSubscription_status_endsAt_idx" ON "public"."PartnerSubscription"("status", "endsAt");

-- CreateIndex
CREATE INDEX "BonusCreditLedger_userId_createdAt_idx" ON "public"."BonusCreditLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BonusCreditLedger_expiresAt_idx" ON "public"."BonusCreditLedger"("expiresAt");

-- CreateIndex
CREATE INDEX "BookingPayment_bookingId_idx" ON "public"."BookingPayment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingPayment_customerId_idx" ON "public"."BookingPayment"("customerId");

-- CreateIndex
CREATE INDEX "BookingPayment_partnerId_idx" ON "public"."BookingPayment"("partnerId");

-- CreateIndex
CREATE INDEX "BookingPayment_providerPaymentIntentId_idx" ON "public"."BookingPayment"("providerPaymentIntentId");

-- AddForeignKey
ALTER TABLE "public"."VoucherCode" ADD CONSTRAINT "VoucherCode_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherCode" ADD CONSTRAINT "VoucherCode_assignedSalonId_fkey" FOREIGN KEY ("assignedSalonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherCode" ADD CONSTRAINT "VoucherCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_voucherCodeId_fkey" FOREIGN KEY ("voucherCodeId") REFERENCES "public"."VoucherCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VoucherRedemption" ADD CONSTRAINT "VoucherRedemption_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerSubscription" ADD CONSTRAINT "PartnerSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerSubscription" ADD CONSTRAINT "PartnerSubscription_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerSubscription" ADD CONSTRAINT "PartnerSubscription_voucherRedemptionId_fkey" FOREIGN KEY ("voucherRedemptionId") REFERENCES "public"."VoucherRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BonusCreditLedger" ADD CONSTRAINT "BonusCreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BonusCreditLedger" ADD CONSTRAINT "BonusCreditLedger_voucherCodeId_fkey" FOREIGN KEY ("voucherCodeId") REFERENCES "public"."VoucherCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BonusCreditLedger" ADD CONSTRAINT "BonusCreditLedger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPayment" ADD CONSTRAINT "BookingPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPayment" ADD CONSTRAINT "BookingPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPayment" ADD CONSTRAINT "BookingPayment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BookingPayment" ADD CONSTRAINT "BookingPayment_voucherRedemptionId_fkey" FOREIGN KEY ("voucherRedemptionId") REFERENCES "public"."VoucherRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
