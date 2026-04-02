import { ActivityAttachment, ActivityEntry } from "@/lib/types";

const mimeExtensionMap: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "text/csv": "csv"
};

const sanitizeSegment = (value: string, fallback: string) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

  return cleaned.slice(0, 64) || fallback;
};

const sanitizeIdSegment = (value: string) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-]+/g, "")
    .replace(/-+/g, "-");

  return cleaned || "PR";
};

export const getMimeExtension = (mimeType?: string) => {
  const key = String(mimeType || "").trim().toLowerCase();
  return mimeExtensionMap[key] || "";
};

export const getFileExtension = (name: string, fallbackMimeType?: string) => {
  const cleanName = String(name || "").trim();
  const rawExt = cleanName.includes(".") ? cleanName.split(".").pop() || "" : "";
  const sanitizedExt = rawExt.replace(/[^\w]+/g, "").toLowerCase();

  if (sanitizedExt) return sanitizedExt;
  return getMimeExtension(fallbackMimeType) || "bin";
};

export const replaceFileExtension = (name: string, nextExtension: string) => {
  const cleanExt = nextExtension.replace(/[^\w]+/g, "").toLowerCase() || "bin";
  const base = String(name || "file").replace(/\.[^.]+$/, "");
  return `${base}.${cleanExt}`;
};

export const buildAttachmentFileName = (
  uniqueId: string,
  activityName: string,
  sequence: number,
  sourceName: string,
  fallbackMimeType?: string
) => {
  const safeId = sanitizeIdSegment(uniqueId);
  const safeActivity = sanitizeSegment(activityName, "Activity");
  const safeSequence = String(Math.max(1, sequence)).padStart(2, "0");
  const extension = getFileExtension(sourceName, fallbackMimeType);

  return `${safeId}_${safeActivity}_${safeSequence}.${extension}`;
};

export const getEntryAttachmentDisplay = (
  entry: Pick<ActivityEntry, "uniqueId" | "activityName">,
  attachment: ActivityAttachment,
  sequence: number
): ActivityAttachment => ({
  ...attachment,
  name: buildAttachmentFileName(entry.uniqueId, entry.activityName, sequence, attachment.name)
});

export const getEntryAttachmentsWithDisplayNames = (
  entry: Pick<ActivityEntry, "uniqueId" | "activityName" | "attachments">
) => entry.attachments.map((attachment, index) => getEntryAttachmentDisplay(entry, attachment, index + 1));
