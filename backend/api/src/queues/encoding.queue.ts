import { Queue } from "bullmq";
import { redis } from "../redis";

export const encodingQueue = new Queue("encode-video", {
    connection: redis
})
