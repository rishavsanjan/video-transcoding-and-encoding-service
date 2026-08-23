"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";

type EncodingProgress = {
    videoId: string;
    resolution: number;
    progress: number;
    status: "PROCESSING" | "COMPLETED" | "FAILED";
};

export default function EncodingProgress({
    videoId,
}: {
    videoId: string;
}) {
    const [progress, setProgress] = useState<
        Record<number, EncodingProgress>
    >({});

    useEffect(() => {
        socket.emit("join-video", videoId);

        const handleProgress = (data: EncodingProgress) => {
            setProgress((previous) => ({
                ...previous,
                [data.resolution]: data,
            }));
        };

        socket.on("encoding-progress", handleProgress);
        console.log("i am recieving progress")
        return () => {
            socket.off("encoding-progress", handleProgress);
        };
    }, [videoId]);

    return (
        <div>
            {[1080, 720, 480, 360].map((resolution) => {
                const job = progress[resolution];

                return (
                    <div key={resolution}>
                        <p>
                            {resolution}p —{" "}
                            {job?.status ?? "QUEUED"}
                        </p>

                        <progress
                            value={job?.progress ?? 0}
                            max={100}
                        />

                        <span>
                            {job?.progress ?? 0}%
                        </span>
                    </div>
                );
            })}
        </div>
    );
}