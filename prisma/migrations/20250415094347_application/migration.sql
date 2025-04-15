-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appliedJobsId" INTEGER[];

-- CreateTable
CREATE TABLE "Application" (
    "id" SERIAL NOT NULL,
    "freelancer_id" INTEGER NOT NULL,
    "job_id" INTEGER NOT NULL,
    "aboutFreelancer" TEXT NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_freelancer_id_fkey" FOREIGN KEY ("freelancer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
