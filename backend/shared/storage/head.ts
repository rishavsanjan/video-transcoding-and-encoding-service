import {
    HeadObjectCommand,
} from "@aws-sdk/client-s3";

import { s3 } from "./s3";

export async function getS3ObjectMetadata(
    key: string
) {
    const command = new HeadObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    });

    return await s3.send(command);
}