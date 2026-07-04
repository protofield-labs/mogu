import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import pg from "pg";

import { readDbConfig, type DbConfig } from "./config";

const { Pool } = pg;

let pool: pg.Pool | null = null;

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

async function getPool(): Promise<pg.Pool> {
  const config = readDbConfig();
  if (!config) {
    throw new Error("Database environment variables are not set");
  }

  if (!pool) {
    pool = await createPool(config);
  }

  return pool;
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
