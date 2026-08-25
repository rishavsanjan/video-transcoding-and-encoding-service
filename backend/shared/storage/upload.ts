import {
    PutObjectCommand,
} from "@aws-sdk/client-s3";

import { createReadStream } from "fs";

import { s3 } from "./s3";

export async function uploadFileToS3(
    filePath: string,
    key: string,
    contentType: string
) {
    const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
    });

    await s3.send(command);

    return key;
}