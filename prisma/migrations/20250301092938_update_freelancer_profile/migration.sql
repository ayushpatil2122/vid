/*
  Warnings:

  - You are about to drop the column `availability` on the `FreelancerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `portfolio` on the `FreelancerProfile` table. All the data in the column will be lost.
  - The `skills` column on the `FreelancerProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `country` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `firstname` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastname` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FreelancerProfile" DROP COLUMN "availability",
DROP COLUMN "portfolio",
ADD COLUMN     "availabilityStatus" "Availability" NOT NULL DEFAULT 'UNAVAILABLE',
ADD COLUMN     "certifications" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "equipmentCameras" TEXT,
ADD COLUMN     "equipmentLenses" TEXT,
ADD COLUMN     "equipmentLighting" TEXT,
ADD COLUMN     "equipmentOther" TEXT,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "maximumRate" DOUBLE PRECISION,
ADD COLUMN     "minimumRate" DOUBLE PRECISION,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "pinCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "tools" TEXT[],
ADD COLUMN     "weeklyHours" INTEGER,
DROP COLUMN "skills",
ADD COLUMN     "skills" TEXT[];

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "firstname" SET NOT NULL,
ALTER COLUMN "lastname" SET NOT NULL;

-- CreateTable
CREATE TABLE "PortfolioVideo" (
    "id" SERIAL NOT NULL,
    "freelancer_id" INTEGER NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioVideo_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PortfolioVideo" ADD CONSTRAINT "PortfolioVideo_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
