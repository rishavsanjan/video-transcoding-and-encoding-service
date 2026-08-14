import { spawn } from "child_process";

export function encodeVideo(
    inputPath: string,
    outputPath: string,
    height: number
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
            outputPath,
        ])

        ffmpeg.stderr.on("data", (data) => {
            console.log(data.toString());
        });

        ffmpeg.on("close", (code) => {
            if (code == 0) {
                console.log(`${height}p encoding completed`);
                resolve();
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        })

        ffmpeg.on("error", (error) => {
            reject(error);
        });
    })
}