import { NextResponse } from "next/server";
import { getWriteTokenError } from "@/lib/api-auth";
import { createBlobFileId, hasBlobStorageConfig, uploadBlobFile } from "@/lib/blob-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sanitize = (value: string) => String(value || "file").replace(/[^\w.\- ]+/g, "").trim() || "file";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv"
]);
const noStoreHeaders = { "cache-control": "no-store" };

export async function POST(req: Request) {
  try {
    const authError = getWriteTokenError(req);
    if (authError) {
      const status = authError.includes("Configure APP_BASE_URL") ? 500 : 401;
      return NextResponse.json({ ok: false, message: authError }, { status, headers: noStoreHeaders });
    }

    if (!hasBlobStorageConfig) {
      return NextResponse.json(
        { ok: false, message: "Missing Azure Blob storage env" },
        { status: 500, headers: noStoreHeaders }
      );
    }

    const formData = await req.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "Invalid request. Send multipart file field: file." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const fileName = sanitize(upload.name);
    const mimeType = upload.type || "application/octet-stream";
    const size = upload.size || 0;

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json({ ok: false, message: "File type is not allowed." }, { status: 400, headers: noStoreHeaders });
    }

    if (size <= 0 || size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { ok: false, message: "File size must be between 1 byte and 10 MB." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const fileId = createBlobFileId(fileName);
    const buffer = Buffer.from(await upload.arrayBuffer());
    const uploaded = await uploadBlobFile({
      fileId,
      fileName,
      mimeType,
      data: buffer
    });

    return NextResponse.json(
      {
        ok: true,
        fileId,
        name: fileName,
        type: mimeType.startsWith("image/") ? "image" : "document",
        mimeType,
        sizeKb: Math.max(1, Math.round(size / 1024)),
        directUrl: uploaded.directUrl,
        url: `/api/file?id=${encodeURIComponent(fileId)}`
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, detail: String(error) }, { status: 500, headers: noStoreHeaders });
  }
}
