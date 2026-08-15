import { encodingQueue } from "./queues/encoding.queue";

async function main() {
    const job = await encodingQueue.add("encode-video", {
        inputPath: "storage/uploads/VID_20260813_130330958.mp4",
        outputPath: "storage/outputs/output-720p.mp4",
        height: 720,
    });

    console.log("Job added:", job.id);

    process.exit(0);
}

main().catch(console.error);