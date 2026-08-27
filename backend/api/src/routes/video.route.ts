import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { createUploadUrl, getVideo, processVideo, uploadVideo } from "../controller/video.controller";

const router = Router();


const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.resolve("storage/uploads"));
    },

    filename: (_req, file, cb) => {
        console.log("bb")
        const filename = `${Date.now()}-${file.originalname}`;
        cb(null, filename);
    }
})

const upload = multer({
    storage
})

router.post("/videos", upload.single("video"), uploadVideo);
router.get("/videos/:id", getVideo)
router.post(
    "/videos/upload-url",
    createUploadUrl
);
router.post(
    "/videos/:videoId/process",
    processVideo
);

export default router;