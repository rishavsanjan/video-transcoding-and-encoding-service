-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EncodingStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "originalPath" TEXT NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncodingJob" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "resolution" INTEGER NOT NULL,
    "status" "EncodingStatus" NOT NULL DEFAULT 'QUEUED',
    "outputPath" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncodingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncodingJob_videoId_idx" ON "EncodingJob"("videoId");

-- AddForeignKey
ALTER TABLE "EncodingJob" ADD CONSTRAINT "EncodingJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
