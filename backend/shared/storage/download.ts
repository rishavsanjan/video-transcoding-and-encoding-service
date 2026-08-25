import {
    GetObjectCommand,
} from "@aws-sdk/client-s3";

import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

import { s3 } from "./s3";

export async function downloadFileFromS3(
    key: string,
    destination: string
) {
    const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    });

    const response = await s3.send(command);

    if (!response.Body) {
        throw new Error(
            `S3 object has no body: ${key}`
        );
    }

    await pipeline(
        response.Body as NodeJS.ReadableStream,
        createWriteStream(destination)
    );
}