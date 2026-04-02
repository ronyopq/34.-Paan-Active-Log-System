const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const sanitize = (value) =>
  String(value || "file")
    .replace(/[^\w.\- ]+/g, "")
    .trim() || "file";

export async function onRequestPost(context) {
  try {
    if (!context.env?.CACHE) {
      return json({ ok: false, message: "KV binding not found (CACHE)." }, 500);
    }

    const formData = await context.request.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return json({ ok: false, message: "Invalid request. Send multipart file field: file." }, 400);
    }

    const fileId = `f_${Date.now()}_${crypto.randomUUID().replaceAll("-", "")}`;
    const fileName = sanitize(upload.name);
    const mimeType = upload.type || "application/octet-stream";
    const size = upload.size || 0;
    const arrayBuffer = await upload.arrayBuffer();

    const metaKey = `file:meta:${fileId}`;
    const binKey = `file:bin:${fileId}`;

    await context.env.CACHE.put(binKey, arrayBuffer);
    await context.env.CACHE.put(
      metaKey,
      JSON.stringify({
        id: fileId,
        name: fileName,
        type: mimeType,
        size,
        uploadedAt: new Date().toISOString()
      })
    );

    const url = `/api/file?id=${encodeURIComponent(fileId)}`;
    return json({
      ok: true,
      fileId,
      name: fileName,
      type: mimeType.startsWith("image/") ? "image" : "document",
      mimeType,
      sizeKb: Math.max(1, Math.round(size / 1024)),
      url
    });
  } catch (error) {
    return json({ ok: false, message: "Upload failed", detail: String(error) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST,OPTIONS"
    }
  });
}

