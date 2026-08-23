import { spawn } from "child_process";
import { redisPublisher } from "./redisPublisher";

export function encodeVideo(
    inputPath: string,
    outputPath: string,
    height: number,
    duration: number,
    onProgress: (progress: number, status: 'PROCESSING' | 'COMPLETED' | 'QUEUED' | 'FAILED') => void
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
            "-i",
            inputPath,
            "-vf",
            `scale=-2:${height}`,
            "-c:v",
            "libx264",
            "-c:a",
            "aac",

            "-progress",
            "pipe:1",
            "-nostats",

            outputPath,
        ]);


        let progressData = "";

        ffmpeg.stdout.on("data", (data) => {
            progressData += data.toString();

            const lines = progressData.split("\n");

            progressData = lines.pop() || "";

            for (const line of lines) {
                if (!line.startsWith("out_time_ms=")) {
                    continue;
                }

                const value = Number(
                    line.replace("out_time_ms=", "")
                );

                if (!Number.isFinite(value)) {
                    continue;
                }

                const currentTime = value / 1_000_000;

                const progress = Math.min(
                    100,
                    Math.round((currentTime / duration) * 100)
                );

                onProgress(progress, 'PROCESSING');
            }
        });



        ffmpeg.on("close", (code) => {
            if (code == 0) {
                console.log(`${height}p encoding completed`);
                onProgress(100, 'COMPLETED');
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
                onProgress(0, 'FAILED');
            }
        })

        ffmpeg.on("error", (error) => {
            reject(error);
        });
    })
}