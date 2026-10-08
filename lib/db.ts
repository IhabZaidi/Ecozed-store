import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Singleton pool: avoids exhausting local Postgres connections on HMR reloads.
const globalForPg = globalThis as unknown as { __pgPool?: Pool };

const pool =
  globalForPg.__pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // local dev default is fine; keep it small
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForPg.__pgPool = pool;

export const db = drizzle(pool, { schema });
export { pool };
