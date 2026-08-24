-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "bitrate" BIGINT,
ADD COLUMN     "codec" TEXT,
ADD COLUMN     "duration" DOUBLE PRECISION,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "fps" DOUBLE PRECISION,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;
