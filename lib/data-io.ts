import * as XLSX from "xlsx";
import {
  attachmentExportHeaders,
  buildEntryExportHeaders,
  buildAttachmentExportRows,
  buildEntryExportRows,
} from "@/lib/reporting";
import { ActivityEntry, BackupManifest, OrgSettings } from "./types";
import { PersistedState } from "./store";

/**
 * Exports activity entries to Excel (.xlsx)
 * includes file links as strings.
 */
export const exportEntriesToExcel = (entries: ActivityEntry[], orgSettings?: OrgSettings, fileName = "pams_activities.xlsx") => {
  const workbook = XLSX.utils.book_new();

  if (orgSettings) {
    const infoRows = [
      { Field: "Organization", Value: orgSettings.orgName },
      ...(orgSettings.orgAddress ? [{ Field: "Address", Value: orgSettings.orgAddress }] : []),
      ...(orgSettings.orgPhone ? [{ Field: "Phone", Value: orgSettings.orgPhone }] : []),
      ...(orgSettings.orgEmail ? [{ Field: "Email", Value: orgSettings.orgEmail }] : []),
      { Field: "Exported", Value: new Date().toLocaleString("en-GB") },
      { Field: "Entries", Value: entries.length },
    ];
    const infoSheet = XLSX.utils.json_to_sheet(infoRows);
    XLSX.utils.book_append_sheet(workbook, infoSheet, "Info");
  }

  const worksheet = XLSX.utils.json_to_sheet(buildEntryExportRows(entries), {
    header: buildEntryExportHeaders(entries)
  });
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activities");
  const attachmentWorksheet = XLSX.utils.json_to_sheet(buildAttachmentExportRows(entries), {
    header: [...attachmentExportHeaders]
  });
  XLSX.utils.book_append_sheet(workbook, attachmentWorksheet, "Attachments");
  XLSX.writeFile(workbook, fileName);
};

/**
 * Downloads a JSON file of the entire app state (backup)
 */
export const exportStateAsJson = (state: PersistedState, fileName = "pams_full_backup.json") => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Downloads only settings as JSON
 */
export const exportSettingsAsJson = (state: Partial<PersistedState>, fileName = "pams_settings_backup.json") => {
  const settingsOnly = {
    projectMap: state.projectMap,
    locationMap: state.locationMap,
    orgSettings: state.orgSettings,
    reportSettings: state.reportSettings,
    implementedByOptions: state.implementedByOptions,
    venueOptions: state.venueOptions
  };
  const blob = new Blob([JSON.stringify(settingsOnly, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Helper to read JSON from a file input
 */
export const readJsonFile = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch (err) {
        reject(new Error("Invalid JSON file format."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsText(file);
  });
};

/**
 * Helper to read Excel from a file input and return JSON array
 */
export const readExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(new Error("Failed to parse Excel file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
};

const isUsableUrl = (url: string | undefined | null) =>
  Boolean(url && url.trim() && url.trim() !== "#");

const fetchAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

/**
 * Full backup with images as base64.
 * Scans all attachments and fetches image data.
 */
export const exportFullBackup = async (state: PersistedState, orgName = "PRAAN"): Promise<void> => {
  const images: Record<string, string> = {};

  for (const entry of state.entries) {
    for (const attachment of entry.attachments) {
      const url = attachment.directUrl || attachment.url;
      if (isUsableUrl(url) && attachment.type === "image") {
        const base64 = await fetchAsBase64(url!);
        if (base64) {
          images[attachment.id] = base64;
        }
      }
    }
  }

  const manifest: BackupManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    orgName,
    entryCount: state.entries.length,
    imageCount: Object.keys(images).length,
    state,
    images
  };

  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const timestamp = new Date().toISOString().slice(0, 10);
  a.download = `praan-full-backup-${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Validate and parse a backup file.
 */
export const parseBackupFile = (data: unknown): BackupManifest => {
  if (!data || typeof data !== "object") throw new Error("Invalid backup: not an object");
  const m = data as Record<string, unknown>;

  if (typeof m.version !== "number") throw new Error("Invalid backup: missing version");
  if (!m.state || typeof m.state !== "object") throw new Error("Invalid backup: missing state");
  if (!m.images || typeof m.images !== "object") throw new Error("Invalid backup: missing images");

  return data as BackupManifest;
};

/**
 * Restore state from a backup manifest.
 * Re-creates blob URLs for images and patches attachment URLs.
 */
export const restoreFromBackup = (manifest: BackupManifest): PersistedState => {
  const images = manifest.images;
  const state = manifest.state;

  for (const entry of state.entries) {
    for (const attachment of entry.attachments) {
      const base64 = images[attachment.id];
      if (base64) {
        try {
          const blob = dataUriToBlob(base64);
          const blobUrl = URL.createObjectURL(blob);
          attachment.url = blobUrl;
          attachment.directUrl = blobUrl;
        } catch {
          // skip failed images
        }
      }
    }
  }

  return state;
};

const dataUriToBlob = (dataUri: string): Blob => {
  const parts = dataUri.split(",");
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const raw = atob(parts[1]);
  const u8 = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    u8[i] = raw.charCodeAt(i);
  }
  return new Blob([u8], { type: mime });
};
