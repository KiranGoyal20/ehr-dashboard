import { Pool } from "pg";

const globalForDb = globalThis as unknown as {
  db: Pool | undefined;
};

export const db =
  globalForDb.db ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}