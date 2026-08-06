/*
  Warnings:

  - You are about to drop the column `userId` on the `AuditLog` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED', 'PENDING_DELETION', 'ANONYMIZED');

-- CreateEnum
CREATE TYPE "public"."PartnerAccessRequestStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'CODE_SENT', 'ACTIVATED');

-- CreateEnum
CREATE TYPE "public"."PartnerAccessRequestDuration" AS ENUM ('HOUR', 'DAY', 'MONTH', 'THREE_MONTHS', 'SIX_MONTHS', 'YEAR', 'TRIAL');

-- AlterEnum
ALTER TYPE "public"."VoucherCodeType" ADD VALUE 'PARTNER_DAY';

-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropIndex
DROP INDEX "public"."AuditLog_userId_idx";

-- AlterTable
ALTER TABLE "public"."AuditLog" DROP COLUMN "userId",
ADD COLUMN     "actorUserId" TEXT,
ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "targetUserId" TEXT;

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
    "status" "public"."PartnerAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignedAdminId" TEXT,
    "userId" TEXT,
    "contactedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "codeSentAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_email_idx" ON "public"."PartnerAccessRequest"("email");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_status_idx" ON "public"."PartnerAccessRequest"("status");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_userId_idx" ON "public"."PartnerAccessRequest"("userId");

-- CreateIndex
CREATE INDEX "PartnerAccessRequest_assignedAdminId_idx" ON "public"."PartnerAccessRequest"("assignedAdminId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "public"."AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_idx" ON "public"."AuditLog"("targetUserId");

-- AddForeignKey
ALTER TABLE "public"."PartnerAccessRequest" ADD CONSTRAINT "PartnerAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PartnerAccessRequest" ADD CONSTRAINT "PartnerAccessRequest_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
