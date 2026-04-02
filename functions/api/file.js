const sanitize = (value) =>
  String(value || "file")
    .replace(/[^\w.\- ]+/g, "")
    .trim() || "file";

const parseMeta = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export async function onRequestGet(context) {
  try {
    if (!context.env?.CACHE) {
      return new Response("KV binding not found", { status: 500 });
    }

    const { searchParams } = new URL(context.request.url);
    const id = String(searchParams.get("id") || "").trim();
    const forceDownload = searchParams.get("download") === "1";
    const overrideName = searchParams.get("name");

    if (!id) {
      return new Response("Missing file id", { status: 400 });
    }

    const metaKey = `file:meta:${id}`;
    const binKey = `file:bin:${id}`;

    const [metaRaw, binary] = await Promise.all([
      context.env.CACHE.get(metaKey),
      context.env.CACHE.get(binKey, "arrayBuffer")
    ]);

    const meta = parseMeta(metaRaw);
    if (!meta || !binary) {
      return new Response("File not found", { status: 404 });
    }

    const filename = sanitize(overrideName || meta.name || "file");
    const contentType = meta.type || "application/octet-stream";

    const headers = new Headers();
    headers.set("content-type", contentType);
    headers.set("cache-control", "public, max-age=31536000, immutable");
    headers.set(
      "content-disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${filename}"`
    );

    return new Response(binary, { status: 200, headers });
  } catch (error) {
    return new Response(`Read file failed: ${String(error)}`, { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "GET,OPTIONS"
    }
  });
}

