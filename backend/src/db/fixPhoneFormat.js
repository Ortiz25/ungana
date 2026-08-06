// One-time (but safe to re-run) backfill: normalises every existing
// activator/coordinator phone number to the canonical "+254XXXXXXXXX"
// format used by normalizeKEPhone() (see ../utils/phone.js).
//
// Why this is needed: phone normalization was added to
// createActivator()/createCoordinator() after some rows already existed.
// Those older rows were stored exactly as typed (e.g. "254701000001", no
// leading +), which then silently stopped matching login lookups once the
// normalizer started requiring the canonical form — correct phone, correct
// PIN, login still rejected. Run this once against any database that had
// activators/coordinators created before that fix (including the demo
// ACT-001..008 seeded by db:seed).
//
// Usage:  npm run db:fix-phones
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";
import { normalizeKEPhone } from "../utils/phone.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve .env relative to this file (backend/.env), not the CWD — see the
// comment in ../config.js for why that matters.
dotenv.config({ path: join(__dirname, "../../.env") });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function fixTable(table) {
  const { rows } = await client.query(`SELECT id, phone FROM ${table}`);
  let changed = 0;
  for (const row of rows) {
    const normalized = normalizeKEPhone(row.phone);
    if (normalized !== row.phone) {
      await client.query(`UPDATE ${table} SET phone = $1 WHERE id = $2`, [normalized, row.id]);
      console.log(`  ${table} #${row.id}: ${row.phone} -> ${normalized}`);
      changed++;
    }
  }
  return changed;
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  await client.connect();
  try {
    console.log("Checking activators...");
    const activatorsChanged = await fixTable("activators");
    console.log("Checking coordinators...");
    const coordinatorsChanged = await fixTable("coordinators");

    const total = activatorsChanged + coordinatorsChanged;
    if (total === 0) {
      console.log("✅ Nothing to fix — all phone numbers already normalized.");
    } else {
      console.log(`✅ Normalized ${total} phone number(s).`);
    }
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("❌ Phone backfill failed:", err.message);
  process.exit(1);
});
