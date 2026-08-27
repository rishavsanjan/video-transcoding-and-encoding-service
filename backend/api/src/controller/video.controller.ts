import { Request, Response } from "express";
import { encodingQueue } from "../queues/encoding.queue";
import prisma from "../prisma";
import { getVideoMetadata } from "../../../shared/media/ffprobe";
import { uploadFileToS3 } from "../../../shared/storage/upload";
import { createUploadUrlFromAWS } from "../../../shared/storage/presigned";
import os from "os";
import path from "path";
import fs from "fs/promises";


import {
    downloadFileFromS3,
} from "../../../shared/storage/download";




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
                originalKey: "",
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

        const originalKey = `videos/${video.id}/original/source.mp4`;
        await uploadFileToS3(
            req.file.path,
            originalKey,
            req.file.mimetype
        );
        await prisma.video.update({
            where: {
                id: video.id,
            },
            data: {
                originalKey,
            },
        });

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
                    inputKey: `videos/${video.id}/original/source.mp4`,
                    outputKey: `videos/${video.id}/${encodingJob.resolution}p/output.mp4`,
                    height: encodingJob.resolution,
                    duration: metadata.duration
                }, {
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 5000,
                    },

                    removeOnComplete: true,
                    removeOnFail: false,
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
                outputPath: job.outputKey,
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

export async function createUploadUrl(
    req: Request,
    res: Response
) {
    try {
        const {
            fileName,
            contentType,
        } = req.body;

        if (!fileName || !contentType) {
            return res.status(400).json({
                message:
                    "fileName and contentType are required",
            });
        }

        if (!contentType.startsWith("video/")) {
            return res.status(400).json({
                message: "Only video files are allowed",
            });
        }

        const video = await prisma.video.create({
            data: {
                originalName: fileName,
                originalKey: "",
                status: "UPLOADING",
            },
        });

        const originalKey =
            `videos/${video.id}/original/source.mp4`;

        const uploadUrl =
            await createUploadUrlFromAWS(
                originalKey,
                contentType
            );

        await prisma.video.update({
            where: {
                id: video.id,
            },
            data: {
                originalKey,
            },
        });

        return res.status(200).json({
            videoId: video.id,
            uploadKey: originalKey,
            uploadUrl,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message:
                "Failed to create upload URL",
        });
    }
}

export async function processVideo(
    req: Request,
    res: Response
) {
    const { videoId } = req.params as { videoId: string };;

    let tempDir: string | undefined;

    try {
        // 1. Find video
        const video = await prisma.video.findUnique({
            where: {
                id: videoId,
            },
        });

        if (!video) {
            return res.status(404).json({
                message: "Video not found",
            });
        }

        // 2. Make sure it hasn't already been processed
        if (
            video.status !== "UPLOADING"
        ) {
            return res.status(409).json({
                message:
                    "Video is already being processed or has finished processing",
            });
        }

        // 3. Verify object exists in S3
        await getVideoMetadata(
            video.originalKey
        );

        // 4. Temporary directory
        tempDir = await fs.mkdtemp(
            path.join(
                os.tmpdir(),
                "video-process-"
            )
        );

        const inputPath = path.join(
            tempDir,
            "source.mp4"
        );

        // 5. Download source from S3
        await downloadFileFromS3(
            video.originalKey,
            inputPath
        );

        // 6. FFprobe
        const metadata =
            await getVideoMetadata(inputPath);

        // 7. Save metadata
        await prisma.video.update({
            where: {
                id: videoId,
            },
            data: {
                width: metadata.width,
                height: metadata.height,
                duration: metadata.duration,
                fps: metadata.fps,
                bitrate: BigInt(
                    metadata.bitrate
                ),
                codec: metadata.codec,
                format: metadata.format,
                status: "PROCESSING",
            },
        });

        // 8. Determine resolutions
        const availableResolutions = [
            1080,
            720,
            480,
            360,
        ];

        const resolutions =
            availableResolutions.filter(
                (resolution) =>
                    resolution <= metadata.height
            );

        // 9. Create encoding jobs
        const encodingJobs =
            await Promise.all(
                resolutions.map(
                    (resolution) =>
                        prisma.encodingJob.create({
                            data: {
                                videoId,
                                resolution,
                                status: "QUEUED",
                            },
                        })
                )
            );

        // 10. Add BullMQ jobs
        await Promise.all(
            encodingJobs.map(
                (encodingJob) => {
                    const outputKey =
                        `videos/${videoId}/${encodingJob.resolution}p/output.mp4`;

                    return encodingQueue.add(
                        "encode-video",
                        {
                            encodingJobId:
                                encodingJob.id,

                            videoId,

                            inputKey:
                                video.originalKey,

                            outputKey,

                            height:
                                encodingJob.resolution,

                            duration:
                                metadata.duration,
                        },
                        {
                            attempts: 3,

                            backoff: {
                                type: "exponential",
                                delay: 5000,
                            },

                            removeOnComplete: true,
                            removeOnFail: false,
                        }
                    );
                }
            )
        );

        return res.status(202).json({
            message:
                "Video processing started",

            videoId,

            resolutions,
        });

    } catch (error) {
        console.error(
            "Video processing failed:",
            error
        );

        return res.status(500).json({
            message:
                "Failed to process video",
        });

    } finally {
        if (tempDir) {
            await fs.rm(tempDir, {
                recursive: true,
                force: true,
            });
        }
    }
}