/*
  Warnings:

  - You are about to drop the column `outputPath` on the `EncodingJob` table. All the data in the column will be lost.
  - You are about to drop the column `originalPath` on the `Video` table. All the data in the column will be lost.
  - Added the required column `originalKey` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EncodingJob" DROP COLUMN "outputPath",
ADD COLUMN     "outputKey" TEXT;

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "originalPath",
ADD COLUMN     "originalKey" TEXT NOT NULL;
