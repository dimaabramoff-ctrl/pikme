-- CreateEnum
CREATE TYPE "public"."StaffDraftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "public"."SalonStaffDraft" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "specialization" TEXT,
    "status" "public"."StaffDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "workStatus" "public"."MasterWorkStatus" NOT NULL DEFAULT 'AVAILABLE',
    "avatarUrl" TEXT,
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalonStaffDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalonStaffDraft_salonId_idx" ON "public"."SalonStaffDraft"("salonId");

-- CreateIndex
CREATE INDEX "SalonStaffDraft_createdByUserId_idx" ON "public"."SalonStaffDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "SalonStaffDraft_status_idx" ON "public"."SalonStaffDraft"("status");

-- AddForeignKey
ALTER TABLE "public"."SalonStaffDraft" ADD CONSTRAINT "SalonStaffDraft_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "public"."Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalonStaffDraft" ADD CONSTRAINT "SalonStaffDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
