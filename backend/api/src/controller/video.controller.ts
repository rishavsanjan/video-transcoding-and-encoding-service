import { Request, Response } from "express";
import { encodingQueue } from "../queues/encoding.queue";

const resolutions = [1080, 720, 480, 360];

export async function uploadVideo(req: Request, res: Response) {
    try {

        if (!req.file) {
            return res.status(400).json({
                message: "No video uploaded",
            });
        }

        const inputPath = req.file.path;

        const jobs = await Promise.all(
            resolutions.map((height) => {
                const outputPath = `storage/outputs/${req.file!.filename}-${height}p.mp4`;
                return encodingQueue.add("encode-video", {
                    inputPath,
                    outputPath,
                    height:height,
                });
            })
        )


        return res.status(202).json({
            message: "Video uploaded and encoding jobs created",
            jobs: jobs.map((job) => ({
                id: job.id,
                resolution: job.data.height,
            })),
        });

    } catch (error) {
        console.log(error)

        return res.status(500).json({
            message: "failed to upload video."
        })
    }
}