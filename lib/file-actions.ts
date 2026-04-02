import { ActivityAttachment } from "@/lib/types";

const isUsableUrl = (url: string | undefined | null) =>
  Boolean(url && url.trim() && url.trim() !== "#");

const createImagePlaceholder = (file: ActivityAttachment) => {
  const title = `${file.category}`;
  const name = file.name.length > 28 ? `${file.name.slice(0, 28)}...` : file.name;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f4fa8"/>
        <stop offset="100%" stop-color="#1d9c6f"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="720" fill="url(#g)"/>
    <rect x="60" y="60" width="1080" height="600" rx="26" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.45)"/>
    <text x="120" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="52" fill="#ffffff">${title}</text>
    <text x="120" y="388" font-family="Segoe UI, Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.92)">${name}</text>
    <text x="120" y="460" font-family="Consolas, monospace" font-size="24" fill="rgba(255,255,255,0.85)">PRAAN placeholder preview</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const createDocumentBlob = (file: ActivityAttachment) => {
  const text = [
    "PRAAN FILE PREVIEW",
    "Generated placeholder (source file unavailable in demo data).",
    "",
    `File Name: ${file.name}`,
    `Category: ${file.category}`,
    `Type: ${file.type}`,
    `Size: ${file.sizeKb} KB`,
    "",
    "Upload a real file to replace this placeholder."
  ].join("\n");
  return new Blob([text], { type: "text/plain;charset=utf-8" });
};

const triggerDownload = (href: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  anchor.click();
};

const ext = (name: string) => {
  const value = name.split(".").pop()?.toLowerCase();
  return value || "txt";
};

export const getAttachmentPreviewSrc = (file: ActivityAttachment) => {
  if (isUsableUrl(file.url)) return file.url;
  if (file.type === "image") return createImagePlaceholder(file);
  return "";
};

export const openAttachment = (file: ActivityAttachment) => {
  if (isUsableUrl(file.url)) {
    window.open(file.url, "_blank", "noopener,noreferrer");
    return;
  }

  if (file.type === "image") {
    window.open(getAttachmentPreviewSrc(file), "_blank", "noopener,noreferrer");
    return;
  }

  const blob = createDocumentBlob(file);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 45_000);
};

export const downloadAttachment = (file: ActivityAttachment) => {
  if (isUsableUrl(file.url)) {
    if (file.url.startsWith("/api/file")) {
      const separator = file.url.includes("?") ? "&" : "?";
      const encodedName = encodeURIComponent(file.name || "attachment");
      triggerDownload(`${file.url}${separator}download=1&name=${encodedName}`, file.name);
      return;
    }
    triggerDownload(file.url, file.name);
    return;
  }

  if (file.type === "image") {
    triggerDownload(getAttachmentPreviewSrc(file), file.name || `photo.${ext(file.name)}`);
    return;
  }

  const blob = createDocumentBlob(file);
  const url = URL.createObjectURL(blob);
  triggerDownload(url, file.name || `file.${ext(file.name)}`);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
};
