import { Request, Response } from "express";
import { encodingQueue } from "../queues/encoding.queue";
import prisma from "../prisma";
import { getVideoMetadata } from "../../../worker/src/helper";


export async function uploadVideo(req: Request, res: Response) {
    try {

        if (!req.file) {
            return res.status(400).json({
                message: "No video uploaded",
            });
        }
        const inputPath = req.file.path;
        const metadata = await getVideoMetadata(inputPath);
        console.log(req.body)
        const video = await prisma.video.create({
            data: {
                originalName: req.file.originalname,
                originalPath: req.file.path,
                width: metadata.width,
                height: metadata.height,
                duration: metadata.duration,
                fps: metadata.fps,
                bitrate: BigInt(metadata.bitrate),
                codec: metadata.codec,
                format: metadata.format,

                status: 'PROCESSING'
            }
        })

        const availableResolutions = [
            1080,
            720,
            480,
            360,
        ];

        const resolutions = availableResolutions.filter(
            (resolution) => resolution <= metadata.height
        );

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
                    duration: metadata.duration
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
        console.log("i m not here")
        return res.status(500).json({
            message: "failed to upload video."
        })
    }
}


export async function getVideo(
    req: Request,
    res: Response
) {
    try {
        const { videoId } = req.params as { videoId: string };
        
        if (!videoId) {
            return res.status(404).json({
                message: "Video Id not in params",
            });
        }

        const video = await prisma.video.findUnique({
            where: {
                id: videoId,
            },
            include: {
                encodingJobs: {
                    orderBy: {
                        resolution: "desc",
                    },
                },
            },
        });

        if (!video) {
            return res.status(404).json({
                message: "Video not found",
            });
        }

        return res.status(200).json({
            id: video.id,
            originalName: video.originalName,

            metadata: {
                width: video.width,
                height: video.height,
                duration: video.duration,
                fps: video.fps,
                bitrate: video.bitrate?.toString(),
                codec: video.codec,
                format: video.format,
            },

            status: video.status,

            encodingJobs: video.encodingJobs.map((job) => ({
                id: job.id,
                resolution: job.resolution,
                status: job.status,
                progress: job.progress,
                outputPath: job.outputPath,
                error: job.error,
            })),

            createdAt: video.createdAt,
            updatedAt: video.updatedAt,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Failed to fetch video",
        });
    }
}