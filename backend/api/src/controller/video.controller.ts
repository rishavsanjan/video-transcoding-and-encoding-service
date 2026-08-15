import { Request, Response } from "express";
import { encodingQueue } from "../queues/encoding.queue";

export async function uploadVideo(req: Request, res: Response) {
    try {

        if (!req.file) {
            return res.status(400).json({
                message: "No video uploaded",
            });
        }

        const inputPath = req.file.path;
        const outputPath = `storage/outputs/${req.file.filename}-720p.mp4`;
        const job = await encodingQueue.add("encode-video", {
            inputPath,
            outputPath,
            height: 720,
        });

        return res.status(202).json({
            message: "Video uploaded and encoding job created",
            jobId: job.id,
        });

    } catch (error) {
        console.log(error)

        return res.status(500).json({
            message: "failed to upload video."
        })
    }
}