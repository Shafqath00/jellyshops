import "dotenv/config";
import pg from "pg";
import { readFileSync } from "fs";

const connectionString = process.env.SUPABASE_DATABASE_URL;

if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString });

const sql = readFileSync("sql/migrations/20260920110000_add_product_configuration_metadata.sql", "utf-8");

pool
  .query(sql)
  .then(() => console.log("Migration successful!"))
  .catch(console.error)
  .finally(() => pool.end());
