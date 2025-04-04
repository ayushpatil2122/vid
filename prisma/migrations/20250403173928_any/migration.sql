/*
  Warnings:

  - The `certifications` column on the `FreelancerProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "FreelancerProfile" DROP COLUMN "certifications",
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[];
