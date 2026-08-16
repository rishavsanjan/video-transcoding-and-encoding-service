import { Worker } from "bullmq";
import { encodeVideo } from "./encoder";
import { redis } from "../../api/src/redis";




const worker = new Worker("encode-video", async (job) => {
    console.log(`Processing job ${job.id}`);

    const { inputPath, outputPath, height } = job.data;

    await encodeVideo(inputPath, outputPath, height);

},
    {
        connection: redis,
        concurrency:2
    }
)

worker.on("completed", (job) => {
    console.log(`job ${job.id} completed`)
})

worker.on("failed", (job, error) => {
    console.log(`job ${job?.id} failed`, error.message)
})

console.log(" Video encoding worker started");