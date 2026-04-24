import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';

let db: ReturnType<typeof drizzle>;

if (process.env.DATABASE_URL) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  db = drizzle(pool, { schema });
} else {
  db = {} as ReturnType<typeof drizzle>;
}

export { db };
