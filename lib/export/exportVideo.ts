import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebMTarget, Muxer as WebMMuxer } from "webm-muxer";
import { aspectDimensions, cloneProject, type EditorProject, type RuntimeAsset } from "@/lib/editor/model";
import { templateById } from "@/lib/motion/registry";

export type ExportFormat = "mp4" | "webm";
export type ExportResolution = "720p" | "1080p" | "2K" | "4K" | "8K";

export type ExportOptions = {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: 30 | 60;
  loops: 1 | 2 | 3 | 4;
};

export const resolutionHeights: Record<ExportResolution, number> = {
  "720p": 720,
  "1080p": 1080,
  "2K": 1440,
  "4K": 2160,
  "8K": 4320,
};

export const exportDimensions = (project: EditorProject, resolution: ExportResolution) =>
  aspectDimensions(project.aspectRatio, resolutionHeights[resolution]);

export const estimateExport = (project: EditorProject, options: ExportOptions) => {
  const dimensions = exportDimensions(project, options.resolution);
  const duration = project.duration * options.loops;
  const pixels = dimensions.width * dimensions.height;
  const bitrate = Math.round(Math.max(3_000_000, pixels * options.fps * 0.075));
  const maxBytes = Math.ceil((bitrate * duration) / 8 * 1.1);
  return { ...dimensions, duration, bitrate, maxBytes, frames: Math.round(duration * options.fps) };
};

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const seekVideos = async (assets: ReadonlyMap<string, RuntimeAsset>, time: number) => {
  const tasks: Promise<void>[] = [];
  for (const asset of assets.values()) {
    if (!(asset.source instanceof HTMLVideoElement) || !Number.isFinite(asset.source.duration) || asset.source.duration <= 0) continue;
    const video = asset.source;
    const target = time % video.duration;
    if (Math.abs(video.currentTime - target) < 0.04) continue;
    tasks.push(new Promise<void>((resolve) => {
      const done = () => resolve();
      video.addEventListener("seeked", done, { once: true });
      window.setTimeout(done, 250);
      video.currentTime = target;
    }));
  }
  await Promise.all(tasks);
};

export const exportProjectVideo = async (
  sourceProject: EditorProject,
  assets: ReadonlyMap<string, RuntimeAsset>,
  options: ExportOptions,
  onProgress: (progress: number) => void,
  signal: AbortSignal,
) => {
  if (!("VideoEncoder" in window) || !("VideoFrame" in window)) {
    throw new Error("This browser does not expose WebCodecs. Try the latest Chrome or Edge, or choose the browser fallback.");
  }

  const project = cloneProject(sourceProject);
  const template = templateById.get(project.templateId);
  if (!template) throw new Error("The selected motion template is unavailable.");
  const estimate = estimateExport(project, options);
  if (estimate.width * estimate.height > 18_700_000) {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    if (memory < 8) throw new Error("8K export needs at least 8 GB of device memory. Choose 4K or lower on this device.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = estimate.width;
  canvas.height = estimate.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("The export canvas could not be created.");

  const mp4Target = options.format === "mp4" ? new Mp4Target() : null;
  const webmTarget = options.format === "webm" ? new WebMTarget() : null;
  const mp4Muxer = mp4Target ? new Mp4Muxer({
    target: mp4Target,
    video: { codec: "avc", width: estimate.width, height: estimate.height, frameRate: options.fps },
    fastStart: "in-memory",
  }) : null;
  const webmMuxer = webmTarget ? new WebMMuxer({
    target: webmTarget,
    video: { codec: "V_VP9", width: estimate.width, height: estimate.height, frameRate: options.fps },
  }) : null;

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      if (mp4Muxer) mp4Muxer.addVideoChunk(chunk, metadata);
      if (webmMuxer) webmMuxer.addVideoChunk(chunk, metadata);
    },
    error: (error) => { encoderError = error; },
  });

  const codec = options.format === "mp4" ? "avc1.42001f" : "vp09.00.10.08";
  const config: VideoEncoderConfig = {
    codec,
    width: estimate.width,
    height: estimate.height,
    bitrate: estimate.bitrate,
    framerate: options.fps,
    latencyMode: "quality",
    bitrateMode: "variable",
    ...(options.format === "mp4" ? { avc: { format: "avc" as const } } : {}),
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) {
    encoder.close();
    throw new Error(`${options.format.toUpperCase()} encoding is not supported by this browser or device.`);
  }
  encoder.configure(config);

  try {
    const frameDuration = Math.round(1_000_000 / options.fps);
    for (let frameIndex = 0; frameIndex < estimate.frames; frameIndex += 1) {
      if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
      const globalSeconds = frameIndex / options.fps;
      const loopSeconds = globalSeconds % project.duration;
      await seekVideos(assets, loopSeconds);
      template.render({ ctx, width: estimate.width, height: estimate.height, assets }, project, loopSeconds / project.duration);
      const frame = new VideoFrame(canvas, {
        timestamp: frameIndex * frameDuration,
        duration: frameDuration,
      });
      encoder.encode(frame, { keyFrame: frameIndex % Math.max(options.fps * 2, 1) === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 10) await encoder.flush();
      if (frameIndex % Math.max(1, Math.floor(options.fps / 2)) === 0) {
        onProgress(frameIndex / estimate.frames);
        await nextTask();
      }
      if (encoderError) throw encoderError;
    }
    await encoder.flush();
    if (encoderError) throw encoderError;
    if (mp4Muxer && mp4Target) {
      mp4Muxer.finalize();
      onProgress(1);
      return new Blob([mp4Target.buffer], { type: "video/mp4" });
    }
    if (webmMuxer && webmTarget) {
      webmMuxer.finalize();
      onProgress(1);
      return new Blob([webmTarget.buffer], { type: "video/webm" });
    }
    throw new Error("The export container could not be initialized.");
  } finally {
    if (encoder.state !== "closed") encoder.close();
    canvas.width = 1;
    canvas.height = 1;
  }
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};
