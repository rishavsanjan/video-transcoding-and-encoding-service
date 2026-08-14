import { encodeVideo } from "./encoder";
async function main() {
    await encodeVideo(
        "storage/uploads/VID_20260813_130330958.mp4",
        "storage/outputs/output-720p.mp4",
        720
    );
}

main().catch(console.error);