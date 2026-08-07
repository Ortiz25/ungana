import { existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { extname, dirname, join } from "path";
import { fileURLToPath } from "url";
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
