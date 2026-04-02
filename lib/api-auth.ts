const API_WRITE_TOKEN = (process.env.API_WRITE_TOKEN || "").trim();
const APP_BASE_URL = (process.env.APP_BASE_URL || "").trim();

const normalizeOrigin = (value: string) => {
  if (!value) return null;

  try {
    const candidate = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
    return new URL(candidate).origin.toLowerCase();
  } catch {
    return null;
  }
};

const isLocalhost = (req: Request): boolean => {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  return host.includes("localhost") || host.includes("127.0.0.1") || host.includes(":3000");
};

const getAllowedOrigins = (req: Request) => {
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").toLowerCase();
  const vercelUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "").trim();
  const originValues = new Set<string>();

  const appBaseOrigin = normalizeOrigin(APP_BASE_URL);
  if (appBaseOrigin) originValues.add(appBaseOrigin);

  const vercelOrigin = normalizeOrigin(vercelUrl);
  if (vercelOrigin) originValues.add(vercelOrigin);

  if (host) {
    originValues.add(`https://${host}`);
    originValues.add(`http://${host}`);
  }

  return originValues;
};

const isTrustedBrowserWrite = (req: Request): boolean => {
  const fetchSite = (req.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  const candidateOrigin =
    normalizeOrigin(req.headers.get("origin") || "") ||
    normalizeOrigin(req.headers.get("referer") || "");

  if (!candidateOrigin) {
    return false;
  }

  return getAllowedOrigins(req).has(candidateOrigin);
};

export const getWriteTokenError = (req: Request): string | null => {
  if (isLocalhost(req)) {
    return null;
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (API_WRITE_TOKEN && token === API_WRITE_TOKEN) {
    return null;
  }

  if (isTrustedBrowserWrite(req)) {
    return null;
  }

  if (!API_WRITE_TOKEN) {
    return "Unauthorized write request. Configure APP_BASE_URL or API_WRITE_TOKEN for production writes.";
  }

  return "Unauthorized write request";
};
