import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

import { readDbConfig, type DbConfig } from "./config";

const { Pool } = pg;

// Cache the promise (not the resolved pool) so concurrent cold-start
// requests share a single Pool/Connector instead of each creating one.
let poolPromise: Promise<pg.Pool> | null = null;

async function createPool(config: DbConfig): Promise<pg.Pool> {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: config.instanceConnectionName,
    ipType: IpAddressTypes.PRIVATE,
  });

  return new Pool({
    ...clientOpts,
    user: config.user,
    password: config.password,
    database: config.database,
    max: 5,
  });
}

function getPool(): Promise<pg.Pool> {
  const config = readDbConfig();
  if (!config) {
    return Promise.reject(
      new Error("Database environment variables are not set"),
    );
  }

  if (!poolPromise) {
    poolPromise = createPool(config).catch((error) => {
      // Allow a retry on the next request instead of caching the failure.
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

export type DbHealthResult =
  | { ok: true; serverTime: string }
  | { ok: false; error: string; configured: boolean };

export async function checkDbConnection(): Promise<DbHealthResult> {
  const config = readDbConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      error: "Database environment variables are not set",
    };
  }

  try {
    const activePool = await getPool();
    const result = await activePool.query<{ server_time: string }>(
      "SELECT NOW()::text AS server_time",
    );

    return {
      ok: true,
      serverTime: result.rows[0]?.server_time ?? "unknown",
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
