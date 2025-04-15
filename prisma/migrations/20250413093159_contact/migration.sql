/*
  Warnings:

  - You are about to alter the column `contactSubmissionId` on the `ContactFile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(36)`.
  - You are about to alter the column `fileUrl` on the `ContactFile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(512)`.
  - You are about to alter the column `fileType` on the `ContactFile` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.
  - You are about to alter the column `email` on the `ContactSubmission` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - You are about to alter the column `phone` on the `ContactSubmission` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(20)`.
  - The `category` column on the `ContactSubmission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `subject` on the `ContactSubmission` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - The `priority` column on the `ContactSubmission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `contactMethod` column on the `ContactSubmission` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `ContactSubmission` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('TECHNICAL', 'BILLING', 'ACCOUNT', 'FEATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'PHONE', 'ANY');

-- DropForeignKey
ALTER TABLE "ContactFile" DROP CONSTRAINT "ContactFile_contactSubmissionId_fkey";

-- AlterTable
ALTER TABLE "ContactFile" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileName" VARCHAR(255),
ALTER COLUMN "contactSubmissionId" SET DATA TYPE VARCHAR(36),
ALTER COLUMN "fileUrl" SET DATA TYPE VARCHAR(512),
ALTER COLUMN "fileType" SET DATA TYPE VARCHAR(100);

-- AlterTable
ALTER TABLE "ContactSubmission" ADD COLUMN     "assignedAdminId" VARCHAR(36),
ADD COLUMN     "createdBy" VARCHAR(36),
ADD COLUMN     "isResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActionAt" TIMESTAMP(3),
ADD COLUMN     "resolutionNotes" TEXT,
ADD COLUMN     "updatedBy" VARCHAR(36),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "phone" SET DATA TYPE VARCHAR(20),
DROP COLUMN "category",
ADD COLUMN     "category" "IssueCategory" NOT NULL DEFAULT 'OTHER',
ALTER COLUMN "subject" SET DATA TYPE VARCHAR(255),
DROP COLUMN "priority",
ADD COLUMN     "priority" "PriorityLevel" NOT NULL DEFAULT 'MEDIUM',
DROP COLUMN "contactMethod",
ADD COLUMN     "contactMethod" "ContactMethod" NOT NULL DEFAULT 'EMAIL',
DROP COLUMN "status",
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "ContactFile_contactSubmissionId_idx" ON "ContactFile"("contactSubmissionId");

-- CreateIndex
CREATE INDEX "ContactSubmission_email_idx" ON "ContactSubmission"("email");

-- CreateIndex
CREATE INDEX "ContactSubmission_status_idx" ON "ContactSubmission"("status");

-- CreateIndex
CREATE INDEX "ContactSubmission_priority_idx" ON "ContactSubmission"("priority");

-- CreateIndex
CREATE INDEX "ContactSubmission_assignedAdminId_idx" ON "ContactSubmission"("assignedAdminId");

-- CreateIndex
CREATE INDEX "ContactSubmission_createdAt_idx" ON "ContactSubmission"("createdAt");

-- AddForeignKey
ALTER TABLE "ContactFile" ADD CONSTRAINT "ContactFile_contactSubmissionId_fkey" FOREIGN KEY ("contactSubmissionId") REFERENCES "ContactSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
