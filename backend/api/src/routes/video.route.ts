import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { uploadVideo } from "../controller/video.controller";

const router = Router();

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.resolve("storage/uploads"));
    },

    filename: (_req, file, cb) => {
        const filename = `${Date.now()}-${file.originalname}`;
        cb(null, filename);
    }
})

const upload = multer({
    storage
})

router.post("/videos", upload.single("video"), uploadVideo);

export default router;