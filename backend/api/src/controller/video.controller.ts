import { Request, Response } from "express";
import { encodingQueue } from "../queues/encoding.queue";
import prisma from "../prisma";

const resolutions = [1080, 720, 480, 360];

export async function uploadVideo(req: Request, res: Response) {
    try {

        if (!req.file) {
            return res.status(400).json({
                message: "No video uploaded",
            });
        }
        const inputPath = req.file.path;

        const video = await prisma.video.create({
            data: {
                originalName: req.file.originalname,
                originalPath: req.file.path,
                status: 'PROCESSING'
            }
        })

        const encodingJobs = await Promise.all(
            resolutions.map((height) => {
                return prisma.encodingJob.create({
                    data: {
                        videoId: video.id,
                        resolution: height,
                        status: 'QUEUED'
                    }
                })
            })
        )

        await Promise.all(
            encodingJobs.map((encodingJob) => {
                const outputPath = `storage/outputs/${req.file!.filename}-${encodingJob.resolution}p.mp4`;
                return encodingQueue.add("encode-video", {
                    encodingJobId: encodingJob.id,
                    videoId: video.id,
                    inputPath,
                    outputPath,
                    height: encodingJob.resolution,
                });
            })
        )


        return res.status(202).json({
            message: "Video uploaded and encoding started",
            videoId: video.id,
            jobs: encodingJobs.map((job) => ({
                id: job.id,
                resolution: job.resolution,
                status: job.status,
            })),
        });

    } catch (error) {
        console.log(error)

        return res.status(500).json({
            message: "failed to upload video."
        })
    }
}