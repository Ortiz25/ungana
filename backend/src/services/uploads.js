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
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
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
