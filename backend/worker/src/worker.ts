import { Worker } from "bullmq";
import { encodeVideo } from "./encoder";
import { redis } from "../../api/src/redis";
import prisma from "../../api/src/prisma";




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
        await encodeVideo(inputPath, outputPath, height);

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

        await prisma.encodingJob.update({
            where: {
                id: encodingJobId,
            },
            data: {
                status: "FAILED",
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown encoding error",
            },
        });

        await prisma.video.update({
            where:{
                id:videoId
            },
            data:{
                status:'FAILED'
            }
        });

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

worker.on("failed", (job, error) => {
    console.log(`job ${job?.id} failed`, error.message)
})

console.log(" Video encoding worker started");