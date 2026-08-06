-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING_DELETION', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "public"."PartnerAccessRequestDuration" AS ENUM ('HOUR', 'DAY', 'MONTH', 'THREE_MONTHS', 'SIX_MONTHS', 'YEAR', 'TRIAL');

-- CreateEnum
CREATE TYPE "public"."PartnerAccessRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'APPROVED', 'REJECTED', 'CODE_SENT', 'ACTIVATED');

-- AlterTable
ALTER TABLE "public"."AuditLog" ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "targetSalonId" TEXT,
ADD COLUMN     "targetUserId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "accountStatus" "public"."AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "accountStatusReason" TEXT,
ADD COLUMN     "accountStatusUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."PartnerAccessRequest" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "salonName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "requestedDuration" "public"."PartnerAccessRequestDuration" NOT NULL,
    "googlePlaceId" TEXT,
    "userId" TEXT,
    "salonId" TEXT,
    "status" "public"."PartnerAccessRequestStatus" NOT NULL DEFAULT 'NEW',
    "assignedAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "codeSentAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "PartnerAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_status_createdAt_idx" ON "public"."PartnerAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_email_idx" ON "public"."PartnerAccessRequest"("email");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_phone_idx" ON "public"."PartnerAccessRequest"("phone");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_userId_idx" ON "public"."PartnerAccessRequest"("userId");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_salonId_idx" ON "public"."PartnerAccessRequest"("salonId");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_assignedAdminId_idx" ON "public"."PartnerAccessRequest"("assignedAdminId");

-- AddForeignKey
ALTER TABLE "public"."PartnerAccessRequest" ADD CONSTRAINT "PartnerAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerAccessRequest" ADD CONSTRAINT "PartnerAccessRequest_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerAccessRequest" ADD CONSTRAINT "PartnerAccessRequest_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
