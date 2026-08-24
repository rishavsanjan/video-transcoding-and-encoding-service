import { execFile } from "child_process";

export interface VideoMetadata {
    duration: number;
    width: number;
    height: number;
    fps: number;
    bitrate: number;
    codec: string;
    format: string;
}

export function getVideoMetadata(
    inputPath: string
): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
        execFile(
            "ffprobe",
            [
                "-v",
                "error",

                "-select_streams",
                "v:0",

                "-show_entries",
                "stream=width,height,r_frame_rate,codec_name,bit_rate",

                "-show_entries",
                "format=duration,format_name,bit_rate",

                "-of",
                "json",

                inputPath,
            ],
            (error, stdout, stderr) => {
                if (error) {
                    reject(
                        new Error(
                            `FFprobe failed: ${stderr || error.message}`
                        )
                    );
                    return;
                }

                try {
                    const result = JSON.parse(stdout);

                    const stream = result.streams?.[0];
                    const format = result.format;

                    if (!stream) {
                        throw new Error(
                            "No video stream found"
                        );
                    }

                    const duration = Number(
                        format?.duration
                    );

                    const width = Number(
                        stream.width
                    );

                    const height = Number(
                        stream.height
                    );

                    /*
                     * FFprobe returns FPS like:
                     *
                     * 30/1
                     * 30000/1001
                     */
                    const fpsString =
                        stream.r_frame_rate ?? "0/1";

                    const [numerator, denominator] =
                        fpsString.split("/").map(Number);

                    const fps =
                        denominator !== 0
                            ? numerator / denominator
                            : 0;

                    const bitrate = Number(
                        stream.bit_rate ??
                        format?.bit_rate ??
                        0
                    );

                    const codec =
                        stream.codec_name ?? "unknown";

                    const formatName =
                        format?.format_name ?? "unknown";

                    if (
                        !Number.isFinite(duration) ||
                        !Number.isFinite(width) ||
                        !Number.isFinite(height)
                    ) {
                        throw new Error(
                            "Could not determine video metadata"
                        );
                    }

                    resolve({
                        duration,
                        width,
                        height,
                        fps,
                        bitrate,
                        codec,
                        format: formatName,
                    });
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}