import { Pool } from "pg";

const connectionString = (process.env.DATABASE_URL || "").trim();
const poolSize = Number(process.env.DATABASE_POOL_MAX || 5);
const useSsl =
  process.env.DATABASE_SSL === "0"
    ? false
    : connectionString.includes("sslmode=require") || process.env.NODE_ENV === "production";

declare global {
  var __pamsPgPool: Pool | undefined;
  var __pamsEnsureAppStateTablePromise: Promise<void> | undefined;
}

const createPool = () => {
  if (!connectionString) return null;

  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: Number.isFinite(poolSize) && poolSize > 0 ? poolSize : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
};

const pool = globalThis.__pamsPgPool ?? createPool();
if (pool && !globalThis.__pamsPgPool) {
  globalThis.__pamsPgPool = pool;
}

export const hasDatabaseConfig = Boolean(pool);

const getPool = () => {
  if (!pool) {
    throw new Error("Missing DATABASE_URL env");
  }

  return pool;
};

const ensureAppStateTable = async () => {
  if (!globalThis.__pamsEnsureAppStateTablePromise) {
    globalThis.__pamsEnsureAppStateTablePromise = getPool()
      .query(`
        CREATE TABLE IF NOT EXISTS app_state (
          state_key TEXT PRIMARY KEY,
          state_json JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined);
  }

  try {
    await globalThis.__pamsEnsureAppStateTablePromise;
  } catch (error) {
    globalThis.__pamsEnsureAppStateTablePromise = undefined;
    throw error;
  }
};

export const readAppState = async (stateKey: string) => {
  await ensureAppStateTable();

  const { rows } = await getPool().query<{ state_json: unknown }>(
    "SELECT state_json FROM app_state WHERE state_key = $1 LIMIT 1",
    [stateKey]
  );

  return rows[0]?.state_json ?? null;
};

export const writeAppState = async (stateKey: string, state: Record<string, unknown>) => {
  await ensureAppStateTable();

  const { rows } = await getPool().query<{ updated_at: Date }>(
    `
      INSERT INTO app_state (state_key, state_json)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (state_key)
      DO UPDATE SET
        state_json = EXCLUDED.state_json,
        updated_at = NOW()
      RETURNING updated_at
    `,
    [stateKey, JSON.stringify(state)]
  );

  return {
    updatedAt: rows[0]?.updated_at ? rows[0].updated_at.toISOString() : new Date().toISOString()
  };
};
