# Video Transcoding & Encoding Service

A scalable video processing backend that accepts video uploads, extracts
metadata, creates multiple resolution variants using FFmpeg, converts
them to HLS for adaptive streaming, and stores media assets in Amazon
S3.

The service uses **BullMQ + Redis** for background processing and
**Socket.IO + Redis Pub/Sub** for real-time encoding progress updates.

## Architecture

``` text
                         ┌──────────────┐
                         │   Frontend   │
                         └──────┬───────┘
                                │
                    Presigned S3 Upload
                                │
                                ▼
                         ┌──────────────┐
                         │      S3      │
                         │   Original   │
                         └──────┬───────┘
                                │
                         Process Request
                                │
                                ▼
                         ┌──────────────┐
                         │  Express API │
                         └──────┬───────┘
                                │
                    FFprobe + PostgreSQL
                                │
                                ▼
                         ┌──────────────┐
                         │    BullMQ    │
                         │    Redis     │
                         └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                 Worker      Worker      Worker
                    │           │           │
                  FFmpeg      FFmpeg      FFmpeg
                    │           │           │
                    └───────────┼───────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │      S3      │
                         │ HLS Outputs  │
                         └──────┬───────┘
                                │
                            CloudFront
                                │
                                ▼
                         ┌──────────────┐
                         │ Video Player │
                         └──────────────┘


Real-time progress:

FFmpeg → Worker → Redis Pub/Sub → Socket.IO → Frontend
```

## Features

-   Direct video uploads to S3 using presigned URLs
-   Video metadata extraction with FFprobe
-   Automatic resolution selection based on source resolution
-   Background video processing with BullMQ
-   Redis-backed job queue
-   Concurrent encoding workers
-   FFmpeg-based video transcoding
-   HLS adaptive streaming output
-   Multiple HLS variants:
    -   1080p
    -   720p
    -   480p
    -   360p
-   Automatic `master.m3u8` generation
-   S3 storage for original videos and encoded outputs
-   Temporary local worker storage during processing
-   Automatic temporary-file cleanup
-   PostgreSQL persistence with Prisma
-   Real-time encoding progress using Socket.IO
-   Redis Pub/Sub between workers and the API
-   Job retries with BullMQ
-   Encoding failure tracking
-   CloudFront-ready video delivery architecture

## Tech Stack

  Technology          Purpose
  ------------------- ----------------------------
  Node.js             Runtime
  TypeScript          Application language
  Express             REST API
  PostgreSQL          Application/database state
  Prisma              ORM
  Redis               Queue + Pub/Sub
  BullMQ              Background job processing
  FFmpeg              Video encoding
  FFprobe             Video metadata extraction
  Socket.IO           Real-time progress updates
  Amazon S3           Video/object storage
  Amazon CloudFront   CDN/video delivery
  HLS                 Adaptive video streaming

## Project Structure

``` text
backend/
├── api/
│   └── src/
│       ├── controller/
│       ├── queues/
│       ├── routes/
│       ├── prisma.ts
│       ├── redis.ts
│       └── server.ts
│
├── worker/
│   └── src/
│       ├── encoder.ts
│       ├── hlsEncoder.ts
│       ├── redisPublisher.ts
│       └── worker.ts
│
├── shared/
│   ├── media/
│   │   ├── ffprobe.ts
│   │   └── masterPlaylist.ts
│   │
│   └── storage/
│       ├── s3.ts
│       ├── upload.ts
│       ├── download.ts
│       └── head.ts
│
├── prisma/
│   └── schema.prisma
│
├── package.json
└── tsconfig.json
```

## Processing Flow

### 1. Upload

The client requests a presigned S3 URL:

``` text
POST /api/videos/upload-url
```

The API creates a video record and returns an upload URL.

The browser then uploads the video directly to S3:

``` text
Browser ───────────────► S3
```

The API server does not need to proxy the entire video file.

### 2. Start Processing

After the upload completes:

``` text
POST /api/videos/:videoId/process
```

The API verifies that the object exists in S3.

### 3. Metadata Extraction

The source video is temporarily downloaded by the API and inspected
using FFprobe.

Metadata includes:

-   Width
-   Height
-   Duration
-   FPS
-   Bitrate
-   Codec
-   Format

Example:

``` json
{
  "width": 1920,
  "height": 1080,
  "duration": 125.43,
  "fps": 30,
  "bitrate": 5200000,
  "codec": "h264",
  "format": "mp4"
}
```

### 4. Resolution Selection

The service avoids unnecessary upscaling.

For a 1080p source:

``` text
1080p
720p
480p
360p
```

For a 720p source:

``` text
720p
480p
360p
```

For a 480p source:

``` text
480p
360p
```

### 5. BullMQ

Each resolution becomes a separate BullMQ job:

``` text
Video
 │
 ├── 1080p job
 ├── 720p job
 ├── 480p job
 └── 360p job
```

Workers process jobs concurrently.

### 6. Worker Processing

Each worker:

``` text
S3
 ↓
Download source
 ↓
Temporary local file
 ↓
FFmpeg
 ↓
HLS files
 ↓
Upload HLS files to S3
 ↓
Delete temporary files
```

### 7. HLS Output

A processed video is stored approximately as:

``` text
videos/
└── <videoId>/
    ├── original/
    │   └── source.mp4
    │
    └── hls/
        ├── master.m3u8
        │
        ├── 1080p/
        │   ├── playlist.m3u8
        │   ├── segment000.ts
        │   ├── segment001.ts
        │   └── ...
        │
        ├── 720p/
        │   ├── playlist.m3u8
        │   └── ...
        │
        ├── 480p/
        │   ├── playlist.m3u8
        │   └── ...
        │
        └── 360p/
            ├── playlist.m3u8
            └── ...
```

The player uses:

``` text
master.m3u8
```

as the entry point for adaptive streaming.

## Real-Time Progress

Workers publish encoding progress to Redis:

``` text
video:<videoId>:progress
```

Example message:

``` json
{
  "videoId": "17f91cc6-e5ba-4174-88f7-0b0c0c3075c4",
  "resolution": 720,
  "progress": 67,
  "status": "PROCESSING"
}
```

The API subscribes to the Redis channel and forwards the event through
Socket.IO.

``` text
Worker
  │
  │ Redis PUBLISH
  ▼
Redis
  │
  │ Redis SUBSCRIBE
  ▼
API
  │
  │ Socket.IO emit
  ▼
Frontend
```

Clients join a video-specific Socket.IO room:

``` text
video:<videoId>
```

This ensures progress events are sent only to clients watching that
video.

## API Endpoints

### Request an upload URL

``` http
POST /api/videos/upload-url
Content-Type: application/json
```

Example body:

``` json
{
  "fileName": "my-video.mp4",
  "contentType": "video/mp4"
}
```

### Process uploaded video

``` http
POST /api/videos/:videoId/process
```

This verifies the S3 object, extracts metadata, creates encoding jobs,
and starts processing.

### Get video status

``` http
GET /api/videos/:videoId
```

Returns video metadata, overall status, and individual encoding-job
status.

## Environment Variables

Create a `.env` file:

``` env
PORT=5000

DATABASE_URL="postgresql://..."

REDIS_HOST=localhost
REDIS_PORT=6379

AWS_REGION=eu-north-1
S3_BUCKET_NAME=your-bucket-name

# Optional when FFmpeg/FFprobe are not globally available
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

Do not commit `.env` or AWS credentials to GitHub.

For AWS deployments, prefer IAM roles over long-lived access keys.

## Local Development

### Prerequisites

Install:

-   Node.js
-   PostgreSQL
-   Redis
-   FFmpeg
-   FFprobe
-   AWS account with an S3 bucket

Verify FFmpeg:

``` bash
ffmpeg -version
```

Verify FFprobe:

``` bash
ffprobe -version
```

Verify Redis:

``` bash
redis-cli ping
```

Expected:

``` text
PONG
```

### Install dependencies

``` bash
npm install
```

### Prisma

Run migrations:

``` bash
npx prisma migrate dev
```

Generate Prisma Client if required:

``` bash
npx prisma generate
```

### Start the API

``` bash
npm run dev
```

### Start the worker

If API and worker use separate scripts, start the worker with its
corresponding script.

The worker should report:

``` text
Video encoding worker started
```

## S3 Security

The S3 bucket should remain private.

The intended production architecture is:

``` text
Frontend
   ↓
CloudFront
   ↓
Private S3
```

CloudFront uses Origin Access Control (OAC) to access S3.

Do not make the entire S3 bucket publicly readable just to serve videos.

## Error Handling and Retries

Encoding jobs use BullMQ retries.

Example:

``` text
attempt 1
   ↓
failure
   ↓
attempt 2
   ↓
failure
   ↓
attempt 3
   ↓
FAILED
```

Permanent failures are recorded in PostgreSQL:

``` text
EncodingJob
├── status = FAILED
└── error = "..."
```

The video can also be marked as failed.

## Current Limitations

The project intentionally leaves some production features for later:

-   S3 multipart uploads are not currently implemented.
-   HLS currently uses MPEG-TS segments.
-   CloudFront private viewer authorization is not yet fully integrated.
-   HLS variant bandwidth values can be improved by using measured
    encoded bitrates.
-   Authentication/authorization is not covered yet.
-   Upload size limits should be enforced.
-   Production worker deployment/scaling still needs to be configured.
-   Observability and metrics can be expanded.

## Future Improvements

Planned improvements include:

-   S3 multipart uploads for very large files
-   HLS CMAF/fMP4 segments
-   CloudFront signed cookies
-   Authentication and per-video authorization
-   Worker autoscaling
-   Dockerized workers
-   ECS/EKS deployment
-   Prometheus + Grafana monitoring
-   Structured logging
-   Dead-letter/error handling
-   Video thumbnails
-   Audio-only extraction
-   Subtitle processing
-   Multiple codec support
-   GPU-accelerated encoding
-   Encoding presets
-   Per-user storage quotas
-   Upload cancellation/resume support

## Production Architecture

The long-term architecture is designed to scale horizontally:

``` text
                         ┌─────────────┐
                         │   Frontend  │
                         └──────┬──────┘
                                │
                         CloudFront
                                │
                                ▼
                              S3
                                ▲
                                │
                         ┌──────┴──────┐
                         │   Workers   │
                         │  FFmpeg     │
                         └──────▲──────┘
                                │
                              BullMQ
                                │
                              Redis
                                ▲
                                │
                         ┌──────┴──────┐
                         │     API     │
                         │   Express   │
                         └──────┬──────┘
                                │
                           PostgreSQL
```

Multiple workers can process different encoding jobs simultaneously
while sharing the same S3 storage and Redis queue.

## License

Add your preferred license here, for example:

``` text
MIT License
```

## Author

Built as a learning/project implementation of a distributed video
transcoding and streaming pipeline.
