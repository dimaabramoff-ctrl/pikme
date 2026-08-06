-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PartnerSubscriptionPlan" ADD VALUE 'PICKME_PARTNER_QUARTERLY';
ALTER TYPE "public"."PartnerSubscriptionPlan" ADD VALUE 'PICKME_PARTNER_SEMIANNUAL';
ALTER TYPE "public"."PartnerSubscriptionPlan" ADD VALUE 'PICKME_PARTNER_BIENNIAL';

-- AlterEnum
ALTER TYPE "public"."PartnerSubscriptionSource" ADD VALUE 'ACCESS_CODE';

-- CreateTable
CREATE TABLE "public"."PartnerPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "providerReference" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerPayment_userId_salonId_idx" ON "public"."PartnerPayment"("userId", "salonId");

-- CreateIndex
CREATE INDEX "PartnerPayment_status_idx" ON "public"."PartnerPayment"("status");

-- CreateIndex
CREATE INDEX "PartnerPayment_salonId_idx" ON "public"."PartnerPayment"("salonId");

-- AddForeignKey
ALTER TABLE "public"."PartnerPayment" ADD CONSTRAINT "PartnerPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerPayment" ADD CONSTRAINT "PartnerPayment_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
