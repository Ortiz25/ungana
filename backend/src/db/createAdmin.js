// Creates (or resets the password of) an admin_users account. There's no
// public signup for admin accounts by design — this CLI is the only way to
// provision the first one.
//
// Usage: npm run admin:create -- <username> <password>
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import bcrypt from "bcryptjs";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../.env") });

const [, , username, password] = process.argv;
if (!username || !password) {
  console.error("Usage: npm run admin:create -- <username> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("❌ Password must be at least 8 characters.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  const passwordHash = await bcrypt.hash(password, 10);
  await client.connect();
  try {
    await client.query(
      `INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [username, passwordHash]
    );
    console.log(`✅ Admin user '${username}' is ready.`);
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("❌ Failed to create admin user:", err.message);
  process.exit(1);
});
