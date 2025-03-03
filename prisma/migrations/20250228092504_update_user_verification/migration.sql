/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `UserVerification` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "UserVerification" DROP CONSTRAINT "UserVerification_email_fkey";

-- AlterTable
ALTER TABLE "UserVerification" ADD COLUMN     "user_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "UserVerification_user_id_key" ON "UserVerification"("user_id");

-- AddForeignKey
ALTER TABLE "UserVerification" ADD CONSTRAINT "UserVerification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
