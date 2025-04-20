/*
  Warnings:

  - You are about to drop the column `postedTime` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `appliedJobsId` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[jobId,freelancerId]` on the table `Application` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "postedTime",
ADD COLUMN     "freelancer_id" INTEGER,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "appliedJobsId",
ADD COLUMN     "applied_jobs_id" INTEGER[];

-- CreateIndex
CREATE INDEX "Application_freelancerId_idx" ON "Application"("freelancerId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_freelancerId_key" ON "Application"("jobId", "freelancerId");

-- CreateIndex
CREATE INDEX "FreelancerProfile_user_id_idx" ON "FreelancerProfile"("user_id");

-- CreateIndex
CREATE INDEX "Job_posted_by_id_idx" ON "Job"("posted_by_id");

-- CreateIndex
CREATE INDEX "Job_freelancer_id_idx" ON "Job"("freelancer_id");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
