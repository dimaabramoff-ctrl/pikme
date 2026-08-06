/*
  Warnings:

  - You are about to drop the column `actorUserId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `after` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `before` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `targetSalonId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `targetUserId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `accountStatus` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `accountStatusReason` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `accountStatusUpdatedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `anonymizedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `deletionRequestedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `lastActivityAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `PartnerAccessRequest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."PartnerAccessRequest" DROP CONSTRAINT "PartnerAccessRequest_assignedAdminId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PartnerAccessRequest" DROP CONSTRAINT "PartnerAccessRequest_salonId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PartnerAccessRequest" DROP CONSTRAINT "PartnerAccessRequest_userId_fkey";

-- AlterTable
ALTER TABLE "public"."AuditLog" DROP COLUMN "actorUserId",
DROP COLUMN "after",
DROP COLUMN "before",
DROP COLUMN "reason",
DROP COLUMN "requestId",
DROP COLUMN "targetSalonId",
DROP COLUMN "targetUserId",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "accountStatus",
DROP COLUMN "accountStatusReason",
DROP COLUMN "accountStatusUpdatedAt",
DROP COLUMN "anonymizedAt",
DROP COLUMN "deletionRequestedAt",
DROP COLUMN "lastActivityAt";

-- DropTable
DROP TABLE "public"."PartnerAccessRequest";

-- DropEnum
DROP TYPE "public"."AccountStatus";

-- DropEnum
DROP TYPE "public"."PartnerAccessRequestDuration";

-- DropEnum
DROP TYPE "public"."PartnerAccessRequestStatus";
