const STATE_KEY = "latest";
const CACHE_KEY = "state:latest";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const getStateFromD1 = async (env) => {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    "SELECT state_json FROM app_state WHERE state_key = ?1 LIMIT 1"
  )
    .bind(STATE_KEY)
    .first();

  if (!row?.state_json) return null;

  try {
    return JSON.parse(row.state_json);
  } catch {
    return null;
  }
};

const saveStateToD1 = async (env, state) => {
  if (!env?.DB) return;
  const payload = JSON.stringify(state);
  await env.DB.prepare(
    `INSERT INTO app_state (state_key, state_json, created_at, updated_at)
     VALUES (?1, ?2, datetime('now'), datetime('now'))
     ON CONFLICT(state_key) DO UPDATE SET
       state_json = excluded.state_json,
       updated_at = datetime('now')`
  )
    .bind(STATE_KEY, payload)
    .run();
};

const getStateFromKV = async (env) => {
  if (!env?.CACHE) return null;
  const text = await env.CACHE.get(CACHE_KEY);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const saveStateToKV = async (env, state) => {
  if (!env?.CACHE) return;
  await env.CACHE.put(CACHE_KEY, JSON.stringify(state));
};

const parseBody = async (request) => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

export async function onRequestGet(context) {
  try {
    const kvState = await getStateFromKV(context.env);
    if (kvState) {
      return json({ ok: true, source: "kv", state: kvState });
    }

    const dbState = await getStateFromD1(context.env);
    if (dbState) {
      await saveStateToKV(context.env, dbState);
      return json({ ok: true, source: "d1", state: dbState });
    }

    return json({ ok: true, source: "empty", state: null });
  } catch (error) {
    return json({ ok: false, message: "Failed to read state", detail: String(error) }, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const body = await parseBody(context.request);
    if (!body || typeof body !== "object" || typeof body.state !== "object" || body.state === null) {
      return json({ ok: false, message: "Invalid payload. Use { state: {...} }" }, 400);
    }

    await saveStateToD1(context.env, body.state);
    await saveStateToKV(context.env, body.state);

    return json({
      ok: true,
      savedAt: new Date().toISOString(),
      bindings: {
        DB: Boolean(context.env?.DB),
        CACHE: Boolean(context.env?.CACHE)
      }
    });
  } catch (error) {
    return json({ ok: false, message: "Failed to save state", detail: String(error) }, 500);
  }
}
