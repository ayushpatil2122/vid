-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'IMAGE', 'AUDIO', 'DOCUMENT');

-- AlterTable
ALTER TABLE "Gig" ADD COLUMN     "faqs" JSONB,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packageDetails" JSONB,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GigSampleMedia" (
    "id" SERIAL NOT NULL,
    "gig_id" INTEGER NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GigSampleMedia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GigSampleMedia" ADD CONSTRAINT "GigSampleMedia_gig_id_fkey" FOREIGN KEY ("gig_id") REFERENCES "Gig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
