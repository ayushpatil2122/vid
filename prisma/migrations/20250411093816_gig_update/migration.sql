-- AlterEnum
ALTER TYPE "MediaType" ADD VALUE 'THUMBNAIL';

-- AlterTable
ALTER TABLE "Gig" ADD COLUMN     "thumbnailUrl" TEXT,
ALTER COLUMN "faqs" SET DEFAULT '[]',
ALTER COLUMN "packageDetails" SET DEFAULT '[]',
ALTER COLUMN "tags" SET DEFAULT ARRAY[]::TEXT[];
