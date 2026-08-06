-- CreateEnum
CREATE TYPE "public"."BusinessClaimStatus" AS ENUM ('PENDING', 'CODE_ISSUED', 'ACTIVE_TRIAL', 'VERIFICATION_REQUIRED', 'APPROVED', 'REJECTED', 'REVOKED', 'TRANSFER_PENDING');

-- CreateEnum
CREATE TYPE "public"."VerificationLevel" AS ENUM ('UNVERIFIED', 'SELF_VERIFIED', 'CONTACT_VERIFIED', 'DOCUMENT_VERIFIED');

-- CreateEnum
CREATE TYPE "public"."BusinessAccessCodeType" AS ENUM ('TRIAL', 'STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "public"."BusinessAccessCodeStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."BusinessClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "salonId" TEXT,
    "googlePlaceId" TEXT,
    "status" "public"."BusinessClaimStatus" NOT NULL DEFAULT 'PENDING',
    "verificationLevel" "public"."VerificationLevel" NOT NULL DEFAULT 'UNVERIFIED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BusinessAccessCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "targetSalonId" TEXT,
    "targetGooglePlaceId" TEXT,
    "assignedEmail" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "type" "public"."BusinessAccessCodeType" NOT NULL DEFAULT 'STANDARD',
    "status" "public"."BusinessAccessCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessClaim_userId_idx" ON "public"."BusinessClaim"("userId");

-- CreateIndex
CREATE INDEX "BusinessClaim_salonId_idx" ON "public"."BusinessClaim"("salonId");

-- CreateIndex
CREATE INDEX "BusinessClaim_googlePlaceId_idx" ON "public"."BusinessClaim"("googlePlaceId");

-- CreateIndex
CREATE INDEX "BusinessClaim_status_idx" ON "public"."BusinessClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessClaim_userId_salonId_key" ON "public"."BusinessClaim"("userId", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessAccessCode_codeHash_key" ON "public"."BusinessAccessCode"("codeHash");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_targetSalonId_idx" ON "public"."BusinessAccessCode"("targetSalonId");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_targetGooglePlaceId_idx" ON "public"."BusinessAccessCode"("targetGooglePlaceId");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_assignedEmail_idx" ON "public"."BusinessAccessCode"("assignedEmail");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_status_idx" ON "public"."BusinessAccessCode"("status");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_type_idx" ON "public"."BusinessAccessCode"("type");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_expiresAt_idx" ON "public"."BusinessAccessCode"("expiresAt");

-- CreateIndex
CREATE INDEX "BusinessAccessCode_createdByUserId_idx" ON "public"."BusinessAccessCode"("createdByUserId");

-- AddForeignKey
ALTER TABLE "public"."BusinessClaim" ADD CONSTRAINT "BusinessClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessClaim" ADD CONSTRAINT "BusinessClaim_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessAccessCode" ADD CONSTRAINT "BusinessAccessCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessAccessCode" ADD CONSTRAINT "BusinessAccessCode_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BusinessAccessCode" ADD CONSTRAINT "BusinessAccessCode_targetSalonId_fkey" FOREIGN KEY ("targetSalonId") REFERENCES "public"."Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
