import "dotenv/config";
import pg from "pg";

const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });

pool
  .query('SELECT * FROM "StorefrontWorkspace"')
  .then((result) => console.log(result.rows))
  .catch(console.error)
  .finally(() => pool.end());
