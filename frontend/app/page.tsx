"use client";

import EncodingProgress from "@/components/EncodingProcessBar";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { CloudUpload, Info, Play } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";


type Resolution = "4K UHD" | "1080p" | "720p";
type Codec = "H.264" | "H.265 (HEVC)" | "AV1";

const RESOLUTIONS: Resolution[] = ["4K UHD", "1080p", "720p"];
const CODECS: Codec[] = ["H.264", "H.265 (HEVC)", "AV1"];



const CODEC_EFFICIENCY: Record<Codec, number> = {
  "H.264": 1,
  "H.265 (HEVC)": 0.62,
  AV1: 0.48,
};

const RESOLUTION_WEIGHT: Record<Resolution, number> = {
  "4K UHD": 1,
  "1080p": 0.42,
  "720p": 0.22,
};



const BASE_SIZE_GB = 8.6;

interface metData {
  video: File | null
  filename: string,
  height: number,
  width: number,
  duration: number,
  avgBitrate: number,
  size: number
}


export default function VCodecEncode() {
  const [resolution, setResolution] = useState<Resolution>("4K UHD");
  const [codec, setCodec] = useState<Codec>("H.265 (HEVC)");
  const [crf, setCrf] = useState(18);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [metData, setMetData] = useState<metData>({
    video: null,
    filename: "",
    height: 0,
    width: 0,
    duration: 0,
    avgBitrate: 0,
    size: 0
  });

  const [videoId, setVideoId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const crfPercent = (crf / 51) * 100;

  const estimatedSizeGb = useMemo(() => {
    const crfFactor = 1.6 - (crf / 51) * 1.2;
    const size =
      BASE_SIZE_GB *
      RESOLUTION_WEIGHT[resolution] *
      CODEC_EFFICIENCY[codec] *
      crfFactor;
    return Math.max(0.1, size).toFixed(1);
  }, [resolution, codec, crf]);

  const outputLabel = useMemo(() => {
    const codecShort = codec.includes("H.265") ? "H.265" : codec;
    return `MP4 (${codecShort})`;
  }, [codec]);

  const handleFiles = useCallback((files: FileList | null) => {

    if (files && files.length > 0) {
      const video = document.createElement("video");

      video.preload = "metadata";
      // const avgBitRate = file size × 8 / duration
      const size = (Number((files[0].size / (1024 * 1024)).toFixed(2)));
      video.onloadedmetadata = () => {

        setMetData({
          video: files[0],
          filename: files[0].name,
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Number(video.duration.toFixed(1)),
          size: size,
          avgBitrate: Number((size * 8 / video.duration).toFixed(2))
        })
        URL.revokeObjectURL(video.src);
      };



      video.src = URL.createObjectURL(files[0]);
      setFileName(files[0].name);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleSliderPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const track = e.currentTarget;

    const updateFromClientX = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setCrf(Math.round(ratio * 51));
    };

    updateFromClientX(e.clientX);
    track.setPointerCapture(e.pointerId);

    const onMove = (moveEvent: PointerEvent) => updateFromClientX(moveEvent.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const handleVideoUploadMutation = useMutation({
    mutationKey: ["upload-video"],

    mutationFn: async () => {
      if (!metData?.video) {
        throw new Error("No video selected");
      }

      const video = metData.video;

      const { data } = await axios.post(
        "http://localhost:5000/api/videos/upload-url",
        {
          fileName: metData.filename || video.name,
          contentType: video.type || "video/mp4",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Upload URL response:", data);

      const { uploadUrl, videoId } = data;

      if (!uploadUrl || !videoId) {
        throw new Error("Invalid upload URL response from server");
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": video.type || "video/mp4",
        },
        body: video,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Video upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      console.log("Video uploaded successfully");

      const processResponse = await axios.post(
        `http://localhost:5000/api/videos/${videoId}/process`
      );

      console.log("Processing response:", processResponse.data);

      setVideoId(videoId);

      return {
        videoId,
        uploadResponse,
        processData: processResponse.data,
      };
    },

    onSuccess: (data) => {
      console.log("Upload + processing started:", data);
    },

    onError: (error) => {
      if (axios.isAxiosError(error)) {
        console.error("Status:", error.response?.status);
        console.error("Response:", error.response?.data);
        console.error("Headers:", error.response?.headers);
      } else {
        console.error("Video upload failed:", error);
      }
    },
  });



  console.log(metData)

  return (
    <div className="flex bg-background text-on-background font-body-md text-body-md h-screen overflow-hidden">
      {/* Main column */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Canvas */}
        <main className="flex-1 mt-16 p-layout-margin overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-12 gap-layout-gutter">
            {/* Left column */}
            <div className="col-span-12 xl:col-span-8 flex flex-col gap-layout-gutter">
              {/* Upload zone */}
              <section
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`bg-surface-container-low border rounded-lg p-8 flex flex-col items-center justify-center text-center border-dashed cursor-pointer transition-colors h-64 ${isDragOver
                  ? "border-primary bg-surface-container-low shadow-[0_0_0_2px_rgba(173,198,255,0.2)]"
                  : "border-outline-variant hover:bg-surface-container-low"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.mkv,video/*"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <span
                  className="material-symbols-outlined text-4xl text-on-surface-variant mb-4"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  <CloudUpload size={60} />
                </span>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">
                  {fileName ?? "Drag & Drop Source File"}
                </h2>
                <p className="font-body-md text-body-md text-on-surface-variant mb-4">
                  {fileName ? "Click to choose a different file" : "or click to browse local storage"}
                </p>
                <div className="flex gap-2">
                  {["MP4", "MOV", "MKV", "PRORES"].map((format) => (
                    <span
                      key={format}
                      className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-1 rounded"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </section>

              {/* Output configuration */}
              <section className="bg-surface-container-low border border-outline-variant rounded-lg p-6">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6 border-b border-outline-variant pb-2">
                  Output Configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Resolution */}
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface-variant block mb-3">
                      Resolution Presets
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {RESOLUTIONS.map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setResolution(res)}
                          className={`rounded py-2 font-data-tabular text-data-tabular transition-colors ${resolution === res
                            ? "bg-primary/10 border border-primary text-primary"
                            : "bg-surface border border-outline-variant text-on-surface-variant hover:border-outline"
                            }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Codec */}
                  <div>
                    <label className="font-label-caps text-label-caps text-on-surface-variant block mb-3">
                      Target Codec
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {CODECS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCodec(c)}
                          className={`rounded py-2 font-data-tabular text-data-tabular transition-colors ${codec === c
                            ? "bg-primary/10 border border-primary text-primary"
                            : "bg-surface border border-outline-variant text-on-surface-variant hover:border-outline"
                            }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CRF slider */}
                  <div className="col-span-1 md:col-span-2 mt-4">
                    <div className="flex justify-between items-center mb-3">
                      <label className="font-label-caps text-label-caps text-on-surface-variant">
                        Constant Rate Factor (CRF)
                      </label>
                      <span className="font-data-tabular text-data-tabular text-primary">{crf}</span>
                    </div>

                    <div
                      role="slider"
                      aria-label="Constant Rate Factor"
                      aria-valuemin={0}
                      aria-valuemax={51}
                      aria-valuenow={crf}
                      tabIndex={0}
                      onPointerDown={handleSliderPointer}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") setCrf((v) => Math.min(51, v + 1));
                        if (e.key === "ArrowLeft") setCrf((v) => Math.max(0, v - 1));
                      }}
                      className="relative w-full h-2 bg-surface-container rounded-full cursor-pointer"
                    >
                      <div
                        className="absolute top-0 left-0 h-full bg-primary rounded-full"
                        style={{ width: `${crfPercent}%` }}
                      />
                      <div
                        className="absolute top-1/2 w-4 h-4 bg-primary rounded-full -translate-y-1/2 -translate-x-1/2 border-2 border-surface-container-low hover:scale-110 transition-transform"
                        style={{ left: `${crfPercent}%` }}
                      />
                    </div>

                    <div className="flex justify-between mt-2 font-data-tabular text-data-tabular text-on-surface-variant text-[11px]">
                      <span>0 (Lossless)</span>
                      <span>51 (Worst)</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Right column */}
            <div className="col-span-12 xl:col-span-4 flex flex-col gap-layout-gutter">
              {/* Source metadata */}
              <section className="bg-surface-container-low border border-outline-variant rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-outline-variant pb-2">
                  <span className="material-symbols-outlined text-on-surface-variant"><Info color="white" /></span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">Source Metadata</h3>
                </div>

                <div className="space-y-3">
                  {[
                    ["Filename", fileName ?? metData.filename],
                    ["Resolution", (String(metData.width) + " x " + String(metData.height))],
                    ["Size", ((metData.size) + " MB")],
                    ["Average Bitrate", ((metData.avgBitrate)) + " Mbps"],
                    ["Duration", ((metData.duration)) + " seconds"],
                  ].map(([label, value], i) => (
                    <div key={label}>
                      {i > 0 && <div className="w-full h-px bg-outline-variant my-1" />}
                      <div className="flex justify-between items-center">
                        <span className="font-label-caps text-label-caps text-on-surface-variant">
                          {label}
                        </span>
                        <span className="font-data-tabular text-data-tabular text-on-surface truncate w-32 text-right">
                          {value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Job summary */}
              <section className="bg-surface-container-low border border-outline-variant rounded-lg p-6 flex flex-col flex-1">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Job Summary</h3>

                <div className="bg-surface-container rounded p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body-md text-body-md text-on-surface-variant">Target Format</span>
                    <span className="font-data-tabular text-data-tabular text-on-surface">{outputLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body-md text-body-md text-on-surface-variant">Est. Size</span>
                    <span className="font-data-tabular text-data-tabular text-primary">
                      ~{estimatedSizeGb} GB
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-auto w-full bg-primary-container text-on-primary-container font-headline-sm text-headline-sm rounded py-3 hover:bg-primary transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-primary cursor-pointer"
                  disabled={metData.filename.length === 0 || handleVideoUploadMutation.isPending}
                  onClick={() => { handleVideoUploadMutation.mutate() }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    <Play color="black" fill="black" />
                  </span>
                  Start Conversion
                </button>


              </section>
            </div>
            {
              (handleVideoUploadMutation.isSuccess && videoId != null) &&
              <div>
                <EncodingProgress videoId={videoId} />
              </div>
            }

          </div>
        </main>
      </div>
    </div>
  );
}