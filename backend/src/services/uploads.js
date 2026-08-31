import { existsSync, mkdirSync, unlink, statSync } from "fs";
import { randomUUID } from "crypto";
import { extname, dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import multer from "multer";

const __dirname = dirname(fileURLToPath(import.meta.url));
// backend/uploads — sibling of src/, served statically by server.js at /uploads.
// nginx's `location /backend/ { proxy_pass http://localhost:5000/; }` already
// forwards /backend/uploads/* to this for free (see example-nginx-config.txt).
export const UPLOADS_DIR = join(__dirname, "../../uploads");
if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });

// uploads/ is gitignored (by design — uploaded files aren't source), which
// means a deploy step that resets untracked files (`git clean`, a fresh
// checkout/rsync, etc.) silently deletes it without restarting the process.
// The mkdirSync above only runs once at startup, so every upload after that
// point fails with ENOENT on the write. Re-checking per upload — not just
// once at import — makes writes recover on their own instead of needing a
// restart. This does NOT recover files already lost that way; existing
// content still pointing at a deleted upload will keep 404ing until
// re-uploaded (see the deploy note in .env.example about excluding
// uploads/ from whatever step is clearing it, if this keeps happening).
function ensureUploadsDir(cb) {
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true });
  cb(null, UPLOADS_DIR);
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf", // campus post attachments — exam results/circulars are usually a PDF, not an image or video
]);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB — generous enough for a short clip, not for a full movie

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => ensureUploadsDir(cb),
  // Random filename, not the client-supplied one — avoids path traversal
  // and collisions; the original extension is kept purely for content-type
  // sniffing convenience (browsers/players, not security-relevant here).
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

export const uploadContentFile = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(new Error("Unsupported file type"));
    cb(null, true);
  },
}).single("file");

/**
 * Re-encodes an uploaded video down to something a client on slow
 * captive-portal WiFi can actually load quickly: capped at 1280x720
 * (never upscaled — the `min(1280,iw)` / `min(720,ih)` guards that),
 * moderate H.264 quality (CRF 26, a fast preset since this runs inline on
 * the upload request, not as a background job), AAC audio at 128k, and
 * `+faststart` so the player can begin playback after the first chunk
 * instead of needing the whole file downloaded first (the moov atom ends
 * up at the front of the file rather than wherever the source export tool
 * happened to leave it). Always outputs .mp4 regardless of the source
 * container (including a video/webm upload) for one consistent, universally
 * playable format.
 *
 * Requires the `ffmpeg` binary on PATH. This is a real deploy requirement,
 * not optional — see README/deploy notes. If it's missing (ENOENT) or the
 * encode otherwise fails, the caller falls back to serving the original
 * upload untouched rather than failing the whole upload over what's meant
 * to be a size/speed optimization, not a hard requirement for content to work.
 */
function transcodeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      [
        "-y",
        "-i", inputPath,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "26",
        // Caps the ceiling regardless of what CRF's per-scene adaptive
        // choice would otherwise pick — without this, a high-complexity
        // (busy/high-motion) source can end up with CRF choosing a bitrate
        // as high as or higher than a source that was already reasonably
        // encoded, defeating the point. bufsize = 2x maxrate is the usual
        // rule of thumb for how bursty the rate control is allowed to be.
        "-maxrate", "1200k",
        "-bufsize", "2400k",
        "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        outputPath,
      ],
      { timeout: 4 * 60 * 1000 }, // generous, but bounded — never hang the request forever on a bad input
      (err) => (err ? reject(err) : resolve())
    );
  });
}

/**
 * Runs transcodeVideo for a just-uploaded video file and, on success,
 * deletes the original raw upload — the transcoded .mp4 becomes the only
 * copy, so nothing is left behind for cleanup to worry about. Returns the
 * filename to actually serve (the transcoded one, or the original if
 * transcoding wasn't attempted/failed/didn't actually help). Never throws
 * — a transcode failure is logged and the original upload is kept as-is.
 *
 * Also never REGRESSES size: a source that was already well-compressed
 * (e.g. exported by another tool at a similar or lower bitrate than our
 * own target) can end up larger after re-encoding at a fast preset than it
 * started — in that case the original is kept instead of "optimizing" it
 * into something bigger.
 */
export async function optimizeUploadedVideo(file) {
  if (!file.mimetype.startsWith("video/")) return file.filename;

  const inputPath = join(UPLOADS_DIR, file.filename);
  const outputFilename = `${randomUUID()}.mp4`;
  const outputPath = join(UPLOADS_DIR, outputFilename);

  try {
    await transcodeVideo(inputPath, outputPath);

    if (statSync(outputPath).size >= statSync(inputPath).size) {
      unlink(outputPath, () => {});
      return file.filename;
    }

    unlink(inputPath, () => {}); // best-effort — an orphaned raw upload is harmless clutter, not worth failing over
    return outputFilename;
  } catch (err) {
    console.error("⚠️ Video transcode failed, serving original upload as-is:", err.message);
    unlink(outputPath, () => {}); // clean up any partial output ffmpeg left behind
    return file.filename;
  }
}
