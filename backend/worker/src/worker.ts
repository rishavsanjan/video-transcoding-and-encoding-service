import { Worker } from "bullmq";
import { encodeVideo } from "./encoder";
import { redis } from "../../api/src/redis";
import prisma from "../../api/src/prisma";
import { getVideoDuration } from "./helper";




const worker = new Worker("encode-video", async (job) => {
    // console.log(`Processing job ${job.id}`);

    // const { inputPath, outputPath, height } = job.data;

    // await encodeVideo(inputPath, outputPath, height);

    const {
        encodingJobId,
        videoId,
        inputPath,
        outputPath,
        height,
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

        const onProgress = async (progress: number) => {
            if (progress === lastProgress) {
                return;
            }

            lastProgress = progress;

            await prisma.encodingJob.update({
                where: {
                    id: encodingJobId,
                },
                data: {
                    progress,
                },
            });
        };
        const duration = await getVideoDuration(inputPath);
        await encodeVideo(inputPath, outputPath, height, duration, onProgress);

        await prisma.encodingJob.update({
            where: {
                id: encodingJobId
            },
            data: {
                status: 'COMPLETED'
            }
        })

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

    console.error(`Job ${job.id} permanently failed:`, error.message);

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