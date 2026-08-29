import path from "path";
import fs from "fs/promises";
import { uploadFileToS3 } from "./upload";

export async function uploadDirectoryToS3(
    directory: string,
    prefix: string
) {
    const files = await fs.readdir(directory);

    for (const file of files) {
        const localPath = path.join(
            directory,
            file
        );

        const key = `${prefix}/${file}`;

        const contentType =
            file.endsWith(".m3u8")
                ? "application/vnd.apple.mpegurl"
                : "video/mp2t";

        console.log(
            `Uploading: ${localPath}`
        );

        console.log(
            `S3 key: ${key}`
        );

        await uploadFileToS3(
            localPath,
            key,
            contentType
        );

        console.log(
            `Uploaded: ${key}`
        );
    }
}