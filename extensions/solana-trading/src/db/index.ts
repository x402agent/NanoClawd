import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

let db: Database | null = null;
let client: ReturnType<typeof postgres> | null = null;

export interface DatabaseConfig {
  url: string;
  ssl?: boolean;
}

export function createDatabase(config: DatabaseConfig): Database {
  if (db) {
    return db;
  }

  client = postgres(config.url, {
    prepare: false,
    ssl: config.ssl !== false ? "require" : undefined,
  });

  db = drizzle(client, { schema });
  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error("Database not initialized. Call createDatabase first.");
  }
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}

// Re-export schema for convenience
export * from "./schema.js";
