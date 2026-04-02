import * as XLSX from "xlsx";
import { buildAttachmentExportRows, buildEntryExportRows } from "@/lib/reporting";
import { ActivityEntry } from "./types";
import { PersistedState } from "./store";

/**
 * Exports activity entries to Excel (.xlsx)
 * includes file links as strings.
 */
export const exportEntriesToExcel = (entries: ActivityEntry[], fileName = "pams_activities.xlsx") => {
  const worksheet = XLSX.utils.json_to_sheet(buildEntryExportRows(entries));
  const attachmentWorksheet = XLSX.utils.json_to_sheet(buildAttachmentExportRows(entries));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Activities");
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
