import * as XLSX from 'xlsx';
import { ActivityEntry } from './types';
import { PersistedState } from './store';

/**
 * Exports activity entries to Excel (.xlsx)
 * includes file links as strings.
 */
export const exportEntriesToExcel = (entries: ActivityEntry[], fileName = 'pams_activities.xlsx') => {
  const data = entries.map(entry => ({
    'ID': entry.uniqueId,
    'Status': entry.status,
    'Project': entry.project,
    'Activity Name': entry.activityName,
    'Activity Code': entry.activityCode,
    'Activity Type': entry.activityType,
    'Date': entry.date,
    'Implementing By': entry.implementedBy,
    'Venue': entry.venue,
    'District': entry.district,
    'Upazila': entry.upazila,
    'Union': entry.union,
    'Male': entry.totalMale,
    'Female': entry.totalFemale,
    'Grand Total': entry.grandTotal,
    'Total Budget': entry.totalBudget,
    'Total Expenses': entry.totalExpenses,
    'Variance': entry.variance,
    'Reference Links': (entry.referenceLink as unknown as string[] || []).join(', '),
    'Notes': entry.notes,
    'Created By': entry.createdBy,
    'Created At': entry.createdAt,
    'Photo/File Links': entry.attachments.map(a => a.url).join(', ')
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Activities');
  XLSX.writeFile(workbook, fileName);
};

/**
 * Downloads a JSON file of the entire app state (backup)
 */
export const exportStateAsJson = (state: PersistedState, fileName = 'pams_full_backup.json') => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Downloads only settings as JSON
 */
export const exportSettingsAsJson = (state: Partial<PersistedState>, fileName = 'pams_settings_backup.json') => {
    const settingsOnly = {
        projectMap: state.projectMap,
        locationMap: state.locationMap,
        orgSettings: state.orgSettings,
        reportSettings: state.reportSettings,
        implementedByOptions: state.implementedByOptions,
        venueOptions: state.venueOptions
    };
    const blob = new Blob([JSON.stringify(settingsOnly, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
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
        reject(new Error('Invalid JSON file format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
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
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        resolve(json);
      } catch (err) {
        reject(new Error('Failed to parse Excel file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
};
