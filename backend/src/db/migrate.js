// Applies schema.sql against DATABASE_URL. Safe to re-run — every
// statement in schema.sql uses IF NOT EXISTS / ON CONFLICT DO NOTHING.
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve .env relative to this file (backend/.env), not the CWD — see the
// comment in ../config.js for why that matters.
dotenv.config({ path: join(__dirname, "../../.env") });

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    await client.query(sql);
    console.log("✅ Schema applied successfully.");
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
