-- AlterTable
ALTER TABLE "FreelancerProfile" ADD COLUMN     "services" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastNameChange" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserBadge" ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true;
