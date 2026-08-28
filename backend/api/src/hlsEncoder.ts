import { spawn } from "child_process";

export function encodeHLS(
    inputPath: string,
    outputDir: string,
    height: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        const playlistPath =
            `${outputDir}/playlist.m3u8`;

        const segmentPath =
            `${outputDir}/segment%03d.ts`;

        const ffmpeg = spawn("ffmpeg", [
            "-i",
            inputPath,

            "-vf",
            `scale=-2:${height}`,

            "-c:v",
            "libx264",

            "-c:a",
            "aac",

            "-f",
            "hls",

            "-hls_time",
            "6",

            "-hls_playlist_type",
            "vod",

            "-hls_segment_filename",
            segmentPath,

            playlistPath,
        ]);

        ffmpeg.stdout.on("data", (data) => {
            console.log(
                `FFmpeg: ${data}`
            );
        });

        ffmpeg.stderr.on("data", (data) => {
            console.log(
                `FFmpeg: ${data}`
            );
        });

        ffmpeg.on("error", reject);

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `FFmpeg exited with code ${code}`
                    )
                );
            }
        });
    });
}