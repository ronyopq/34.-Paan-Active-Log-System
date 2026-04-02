import { NextRequest } from "next/server";
import { getBlobFile, hasBlobStorageConfig } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sanitize = (value: string) =>
  String(value || "file")
    .replace(/[^\w.\- ]+/g, "")
    .trim() || "file";

export async function GET(req: NextRequest) {
  try {
    if (!hasBlobStorageConfig) {
      return new Response("Missing Azure Blob storage env", { status: 500 });
    }

    const id = String(req.nextUrl.searchParams.get("id") || "").trim();
    const forceDownload = req.nextUrl.searchParams.get("download") === "1";
    const overrideName = req.nextUrl.searchParams.get("name");

    if (!id) {
      return new Response("Missing file id", { status: 400 });
    }

    const file = await getBlobFile(id);
    if (!file) {
      return new Response("File not found", { status: 404 });
    }

    const filename = sanitize(overrideName || file.fileName || "file");
    const headers = new Headers();
    headers.set("content-type", file.contentType);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set(
      "content-disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${filename}"`
    );

    return new Response(file.body, { status: 200, headers });
  } catch (error) {
    return new Response(`Read file failed: ${String(error)}`, { status: 500 });
  }
}
