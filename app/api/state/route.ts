import { NextResponse } from "next/server";
import { getWriteTokenError } from "@/lib/api-auth";
import { hasDatabaseConfig, readAppState, writeAppState } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_KEY = "latest";
const noStoreHeaders = { "cache-control": "no-store" };

export async function GET() {
  try {
    if (!hasDatabaseConfig) {
      return NextResponse.json({ ok: false, message: "Missing DATABASE_URL env" }, { status: 500, headers: noStoreHeaders });
    }

    const state = await readAppState(STATE_KEY);
    return NextResponse.json(
      {
        ok: true,
        source: state ? "azure-postgres" : "empty",
        state
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, detail: String(error) }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: Request) {
  try {
    const authError = getWriteTokenError(req);
    if (authError) {
      const status = authError.includes("Configure APP_BASE_URL") ? 500 : 401;
      return NextResponse.json({ ok: false, message: authError }, { status, headers: noStoreHeaders });
    }

    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.state !== "object" || body.state === null) {
      return NextResponse.json(
        { ok: false, message: "Invalid payload. Use { state: {...} }" },
        { status: 400, headers: noStoreHeaders }
      );
    }

    if (!hasDatabaseConfig) {
      return NextResponse.json({ ok: false, message: "Missing DATABASE_URL env" }, { status: 500, headers: noStoreHeaders });
    }

    const { updatedAt } = await writeAppState(STATE_KEY, body.state as Record<string, unknown>);

    return NextResponse.json(
      {
        ok: true,
        savedAt: updatedAt,
        source: "azure-postgres"
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, detail: String(error) }, { status: 500, headers: noStoreHeaders });
  }
}
