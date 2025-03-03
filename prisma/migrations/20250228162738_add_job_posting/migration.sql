/*
  Warnings:

  - You are about to drop the `UserVerification` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "JobDifficulty" AS ENUM ('EASY', 'INTERMEDIATE', 'HARD');

-- CreateEnum
CREATE TYPE "ProjectLength" AS ENUM ('SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM');

-- DropForeignKey
ALTER TABLE "UserVerification" DROP CONSTRAINT "UserVerification_user_id_fkey";

-- DropTable
DROP TABLE "UserVerification";

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT[],
    "budgetMin" DOUBLE PRECISION NOT NULL,
    "budgetMax" DOUBLE PRECISION NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "jobDifficulty" "JobDifficulty" NOT NULL,
    "projectLength" "ProjectLength" NOT NULL,
    "keyResponsibilities" TEXT[],
    "requiredSkills" TEXT[],
    "tools" TEXT[],
    "scope" TEXT NOT NULL,
    "posted_by_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "note" TEXT,
    "videoFileUrl" TEXT,
    "postedTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT NOT NULL DEFAULT 'Remote',
    "proposals" INTEGER NOT NULL DEFAULT 0,
    "categoryColor" TEXT NOT NULL DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
