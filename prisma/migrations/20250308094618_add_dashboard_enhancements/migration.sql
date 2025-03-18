-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "daysLeft" INTEGER,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PortfolioVideo" ADD COLUMN     "category" TEXT,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FreelancerSoftware" (
    "id" SERIAL NOT NULL,
    "freelancer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "FreelancerSoftware_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FreelancerSoftware" ADD CONSTRAINT "FreelancerSoftware_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
