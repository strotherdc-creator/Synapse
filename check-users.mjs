import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const result = await pool.query("SELECT id, name, email, role, created_at, last_signed_in FROM users ORDER BY id");
  console.log(JSON.stringify(result.rows, null, 2));
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await pool.end();
}
