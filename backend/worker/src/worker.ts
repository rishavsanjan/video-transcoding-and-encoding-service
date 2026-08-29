import os from "os";
import path from "path";
import fs from "fs/promises";
import { Worker } from "bullmq";
import { encodeVideo } from "./encoder";
import { redis } from "../../api/src/redis";
import prisma from "../../api/src/prisma";
import { getVideoMetadata } from "./helper";
import { redisPublisher } from "./redisPublisher";
import { downloadFileFromS3 } from "../../shared/storage/download";
import { uploadFileToS3 } from "../../shared/storage/upload";
import { encodeHLS } from "../../api/src/hlsEncoder";
import { uploadDirectoryToS3 } from "../../shared/storage/directory";




const worker = new Worker("encode-video", async (job) => {
    // console.log(`Processing job ${job.id}`);

    // const { inputPath, outputPath, height } = job.data;

    // await encodeVideo(inputPath, outputPath, height);

    const {
        encodingJobId,
        videoId,
        inputKey,
        outputKey,
        height,
        duration
    } = job.data;

    console.log(`Processing ${height}p job: ${encodingJobId}`);

    await prisma.encodingJob.update({
        where: {
            id: encodingJobId
        },
        data: {
            status: 'PROCESSING'
        }
    })

    try {

        let lastProgress = -1;

        const onProgress = async (progress: number, status: 'PROCESSING' | 'COMPLETED' | 'QUEUED' | 'FAILED') => {
            if (progress <= lastProgress) {
                return;
            }

            lastProgress = progress;

            try {
                await redisPublisher.publish(
                    `video:${videoId}:progress`,
                    JSON.stringify({
                        videoId,
                        resolution: height,
                        progress,
                        status: status,
                    })
                );
            } catch (error) {
                console.error(
                    "Failed to publish progress:",
                    error
                );
            }
        };

        const tempDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "video-")
        );

        const inputPath = path.join(
            tempDir,
            "source.mp4"
        );



        await downloadFileFromS3(
            inputKey,
            inputPath
        );

        const hlsDir = path.join(
            tempDir,
            `${height}p`
        );

        await fs.mkdir(hlsDir, {
            recursive: true,
        });

        await encodeHLS(
            inputPath,
            hlsDir,
            height
        );

        console.log("HLS encoding finished");

        const files = await fs.readdir(hlsDir);

        console.log("Generated files:", files);

        await uploadDirectoryToS3(
            hlsDir,
            `videos/${videoId}/hls/${height}p`
        );
        await prisma.encodingJob.update({
            where: {
                id: encodingJobId
            },
            data: {
                status: 'COMPLETED',
                progress: 100
            }
        })

        await redisPublisher.publish(
            `video:${videoId}:progress`,
            JSON.stringify({
                videoId,
                resolution: height,
                progress: 100,
                status: "COMPLETED",
            })
        );

        const remainingJobs = await prisma.encodingJob.count({
            where: {
                videoId,
                status: {
                    not: 'COMPLETED'
                }
            }
        })

        if (remainingJobs === 0) {
            await prisma.video.update({
                where: {
                    id: videoId
                },
                data: {
                    status: 'COMPLETED'
                }
            })
        }

        console.log(`${height}p encoding completed`);
        await fs.rm(tempDir, {
            recursive: true,
            force: true,
        });
    } catch (error) {
        console.error(`${height}p encoding failed`, error);

        throw error;

    }

},
    {
        connection: redis,
        concurrency: 2
    }
)

worker.on("completed", (job) => {
    console.log(`job ${job.id} completed`)
})

worker.on("failed", async (job, error) => {
    if (!job) return;

    console.error(
        `Job ${job.id} failed:`,
        error.message
    );

    if (job.attemptsMade < (job.opts.attempts ?? 1)) {
        return;
    }

    console.error(
        `Job ${job.id} permanently failed`
    );

    const { encodingJobId, videoId } = job.data;

    await prisma.encodingJob.update({
        where: {
            id: encodingJobId,
        },
        data: {
            status: "FAILED",
            error: error.message,
        },
    });

    await prisma.video.update({
        where: {
            id: videoId,
        },
        data: {
            status: "FAILED",
        },
    });
});

console.log(" Video encoding worker started");