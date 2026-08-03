// Seeds demo activators mirroring src/lib/data.js ACTIVATORS in the
// frontend, so the DB has something to log into. All use PIN 1234 — the
// same demo PIN already advertised on the frontend's ActivatorLoginScreen.
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve .env relative to this file (backend/.env), not the CWD — see the
// comment in ../config.js for why that matters.
dotenv.config({ path: join(__dirname, "../../.env") });

const { createActivator } = await import("../services/activators.js");
const { pool } = await import("./pool.js");

const DEMO_ACTIVATORS = [
  { code: "ACT-001", name: "James Mwangi", phone: "254701000001", territory: "Nairobi CBD" },
  { code: "ACT-002", name: "Aisha Odhiambo", phone: "254701000002", territory: "Westlands" },
  { code: "ACT-003", name: "Peter Kamau", phone: "254701000003", territory: "Kibera" },
  { code: "ACT-004", name: "Grace Wanjiku", phone: "254701000004", territory: "Thika Road" },
  { code: "ACT-005", name: "Samuel Otieno", phone: "254701000005", territory: "Mombasa" },
  { code: "ACT-006", name: "Faith Njeri", phone: "254701000006", territory: "Nakuru" },
  { code: "ACT-007", name: "David Kipchoge", phone: "254701000007", territory: "Eldoret" },
  { code: "ACT-008", name: "Mary Achieng", phone: "254701000008", territory: "Kisumu" },
];

async function seed() {
  for (const a of DEMO_ACTIVATORS) {
    try {
      await createActivator({ ...a, pin: "1234", mpesaNumber: a.phone });
      console.log(`✅ Seeded ${a.code} — ${a.name}`);
    } catch (err) {
      if (err.code === "23505") console.log(`↷ ${a.code} already exists, skipping`);
      else throw err;
    }
  }
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
