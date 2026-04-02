import {
  auditLogs as defaultAuditLogs,
  entries as defaultEntries,
  implementedByOptions as defaultImplementedByOptions,
  loginLogs as defaultLoginLogs,
  locations as defaultLocations,
  notifications as defaultNotifications,
  orgSettings as defaultOrgSettings,
  projectActivityMap as defaultProjectMap,
  reportSettings as defaultReportSettings,
  users as defaultUsers,
  venueOptions as defaultVenueOptions
} from "@/lib/mockData";
import {
  ActivityEntry,
  AuditLog,
  AppNotification,
  AppUser,
  LoginLog,
  LocationMap,
  OrgSettings,
  ProjectActivityMap,
  ReportSettings,
  Role
} from "@/lib/types";

const STORAGE_KEY = "praan_app_state_v2";
const LEGACY_STORAGE_KEY = "praan_app_state_v1";

export type PersistedState = {
  entries: ActivityEntry[];
  notifications: AppNotification[];
  loginLogs: LoginLog[];
  auditLogs: AuditLog[];
  users: AppUser[];
  projectMap: ProjectActivityMap[];
  locationMap: LocationMap[];
  implementedByOptions: string[];
  venueOptions: string[];
  orgSettings: OrgSettings;
  reportSettings: ReportSettings;
};

const hasWindow = typeof window !== "undefined";

const cloneProjectMap = (map: ProjectActivityMap[]): ProjectActivityMap[] =>
  map.map((item) => ({
    project: item.project,
    locked: Boolean(item.locked),
    activities: item.activities.map((activity) => ({ ...activity, locked: Boolean(activity.locked) })),
    participantCategories: item.participantCategories.map((category) => ({ ...category }))
  }));

const cloneLocationMap = (map: LocationMap[]): LocationMap[] =>
  map.map((item) => ({
    district: item.district,
    upazilas: item.upazilas.map((upazila) => ({
      name: upazila.name,
      unions: [...upazila.unions]
    }))
  }));

const cloneUsers = (list: AppUser[]): AppUser[] =>
  list.map((item) => ({
    ...item,
    title:
      typeof item.title === "string" && item.title.trim()
        ? item.title
        : item.role === "Admin"
          ? "System Administrator"
          : item.role === "Manager"
            ? "Program Manager"
            : "Field Officer",
    password: typeof item.password === "string" && item.password ? item.password : "123456",
    projects: [...item.projects]
  }));

const cloneLoginLogs = (list: LoginLog[]): LoginLog[] =>
  list.map((item) => {
    const legacy = item as LoginLog & { deviceInfo?: string };
    const [legacyBrowser = "", legacyDevice = ""] = (legacy.deviceInfo || "").split("/");
    return {
      username: item.username,
      loginTime: item.loginTime,
      logoutTime: item.logoutTime,
      ipAddress: item.ipAddress,
      device: (item.device || legacyDevice || "Unknown Device").trim(),
      browser: (item.browser || legacyBrowser || "Unknown Browser").trim(),
      status: item.status
    };
  });

const cloneAuditLogs = (list: AuditLog[]): AuditLog[] =>
  list.map((item) => ({
    actor: item.actor,
    role: item.role,
    action: item.action,
    module: item.module,
    targetId: item.targetId,
    timestamp: item.timestamp,
    device: item.device || "Unknown Device",
    browser: item.browser || "Unknown Browser",
    notes: item.notes
  }));

const cloneOrgSettings = (settings: OrgSettings): OrgSettings => ({
  orgName: settings.orgName,
  logoUrl: settings.logoUrl
});

const cloneReportSettings = (settings: ReportSettings): ReportSettings => ({
  defaultTheme: settings.defaultTheme,
  templateName: settings.templateName,
  enableDocx: settings.enableDocx,
  enablePdf: settings.enablePdf,
  enableCsv: settings.enableCsv,
  enableZip: settings.enableZip,
  printSetup: {
    preset: settings.printSetup.preset,
    pageSize: settings.printSetup.pageSize,
    orientation: settings.printSetup.orientation,
    header: settings.printSetup.header,
    footer: settings.printSetup.footer
  }
});

const fallbackState = (): PersistedState => ({
  entries: defaultEntries.map((entry) => ({ ...entry })),
  notifications: defaultNotifications.map((note) => ({ ...note })),
  loginLogs: cloneLoginLogs(defaultLoginLogs),
  auditLogs: cloneAuditLogs(defaultAuditLogs),
  users: cloneUsers(defaultUsers),
  projectMap: cloneProjectMap(defaultProjectMap),
  locationMap: cloneLocationMap(defaultLocations),
  implementedByOptions: [...defaultImplementedByOptions],
  venueOptions: [...defaultVenueOptions],
  orgSettings: cloneOrgSettings(defaultOrgSettings),
  reportSettings: cloneReportSettings(defaultReportSettings)
});

const parseReportSettings = (input: unknown, base: ReportSettings): ReportSettings => {
  if (!input || typeof input !== "object") return base;
  const value = input as Partial<ReportSettings>;
  const printSetup = (value.printSetup ?? {}) as Partial<ReportSettings["printSetup"]>;
  return {
    defaultTheme: value.defaultTheme || base.defaultTheme,
    templateName: value.templateName || base.templateName,
    enableDocx: value.enableDocx ?? base.enableDocx,
    enablePdf: value.enablePdf ?? base.enablePdf,
    enableCsv: value.enableCsv ?? base.enableCsv,
    enableZip: value.enableZip ?? base.enableZip,
    printSetup: {
      preset: printSetup.preset || base.printSetup.preset,
      pageSize: printSetup.pageSize || base.printSetup.pageSize,
      orientation: printSetup.orientation === "Landscape" ? "Landscape" : "Portrait",
      header: printSetup.header || base.printSetup.header,
      footer: printSetup.footer || base.printSetup.footer
    }
  };
};

export const normalizePersistedState = (
  input: Partial<PersistedState> | null | undefined,
  fallback: PersistedState = fallbackState()
): PersistedState => {
  const parsed = input ?? {};
  return {
    entries: Array.isArray(parsed.entries) ? parsed.entries : fallback.entries,
    notifications: Array.isArray(parsed.notifications) ? parsed.notifications : fallback.notifications,
    loginLogs: Array.isArray(parsed.loginLogs) ? cloneLoginLogs(parsed.loginLogs) : fallback.loginLogs,
    auditLogs: Array.isArray(parsed.auditLogs) ? cloneAuditLogs(parsed.auditLogs) : fallback.auditLogs,
    users: Array.isArray(parsed.users) ? cloneUsers(parsed.users) : fallback.users,
    projectMap: Array.isArray(parsed.projectMap) ? cloneProjectMap(parsed.projectMap) : fallback.projectMap,
    locationMap: Array.isArray(parsed.locationMap) ? cloneLocationMap(parsed.locationMap) : fallback.locationMap,
    implementedByOptions: Array.isArray(parsed.implementedByOptions)
      ? [...parsed.implementedByOptions]
      : fallback.implementedByOptions,
    venueOptions: Array.isArray(parsed.venueOptions) ? [...parsed.venueOptions] : fallback.venueOptions,
    orgSettings:
      parsed.orgSettings && parsed.orgSettings.orgName && parsed.orgSettings.logoUrl
        ? cloneOrgSettings(parsed.orgSettings)
        : fallback.orgSettings,
    reportSettings: parseReportSettings(parsed.reportSettings, fallback.reportSettings)
  };
};

export const getPersistedState = (): PersistedState => {
  const fallback = fallbackState();
  if (!hasWindow) return fallback;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw && !legacyRaw) return fallback;

  try {
    const parsed = JSON.parse(raw || legacyRaw || "{}") as Partial<PersistedState>;
    return normalizePersistedState(parsed, fallback);
  } catch {
    return fallback;
  }
};

export const savePersistedState = (state: PersistedState) => {
  if (!hasWindow) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const canViewEntry = (role: Role, username: string, entry: ActivityEntry) => {
  if (role === "Admin" || role === "Manager") return true;
  return entry.createdBy.toLowerCase() === username.toLowerCase();
};

export const visibleEntries = (allEntries: ActivityEntry[], role: Role, username: string) =>
  allEntries.filter((entry) => canViewEntry(role, username, entry));

export const countUnread = (items: AppNotification[]) => items.filter((item) => item.unread).length;
