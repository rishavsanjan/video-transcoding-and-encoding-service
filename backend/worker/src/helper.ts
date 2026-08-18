import { execFile } from "child_process";

export function getVideoDuration(
    inputPath: string
): Promise<number> {
    return new Promise((resolve, reject) => {
        execFile(
            "ffprobe",
            [
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                inputPath,
            ],
            (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }

                const duration = Number(stdout.trim());

                if (!Number.isFinite(duration)) {
                    reject(
                        new Error("Could not determine video duration")
                    );
                    return;
                }

                resolve(duration);
            }
        );
    });
}