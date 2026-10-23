import { getMigrations } from "better-auth/db/migration";
import type { createAuth } from "./auth.js";

export async function migrate({ auth, pool }: ReturnType<typeof createAuth>) {
  await pool.query("create schema if not exists auth");
  const connection = await pool.connect();
  try {
    // Serialize schema updates if two instances start together.
    await connection.query("select pg_advisory_lock(71302733)");
    const migration = await getMigrations(auth.options);
    await migration.runMigrations();
  } finally {
    await connection.query("select pg_advisory_unlock(71302733)");
    connection.release();
  }
}
