"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { calcVariance } from "@/lib/format";
import {
  getPersistedState,
  normalizePersistedState,
  savePersistedState,
  visibleEntries,
  PersistedState
} from "@/lib/store";
import {
  ActivityEntry,
  AuditLog,
  AppNotification,
  AppUser,
  LoginLog,
  EntryStatus,
  LocationMap,
  OrgSettings,
  ProjectActivityMap,
  ReportSettings,
  Role,
  ThemeMode
} from "@/lib/types";

type RegisterInput = {
  fullName: string;
  username: string;
  email: string;
  project: string;
  password: string;
};

type PopupTone = "success" | "error" | "info";

type Toast = { id: string; message: string; tone: PopupTone };

type AppContextValue = {
  hydrated: boolean;
  user: AppUser | null;
  users: AppUser[];
  loginLogs: LoginLog[];
  auditLogs: AuditLog[];
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  language: "en" | "bn";
  entries: ActivityEntry[];
  notifications: AppNotification[];
  setNotifications: (notes: AppNotification[]) => void;
  projectMap: ProjectActivityMap[];
  locationMap: LocationMap[];
  implementedByOptions: string[];
  venueOptions: string[];
  orgSettings: OrgSettings;
  reportSettings: ReportSettings;
  login: (username: string, password: string, remember?: boolean) => { ok: boolean; message?: string };
  register: (input: RegisterInput) => { ok: boolean; message?: string };
  logout: () => void;
  toggleTheme: () => void;
  toggleLanguage: () => void;
  setUsers: (users: AppUser[]) => void;
  setProjectMap: (map: ProjectActivityMap[]) => void;
  setLocationMap: (map: LocationMap[]) => void;
  setImplementedByOptions: (list: string[]) => void;
  setVenueOptions: (list: string[]) => void;
  setOrgSettings: (settings: OrgSettings) => void;
  setReportSettings: (settings: ReportSettings) => void;
  notify: (message: string, tone?: PopupTone) => void;
  addEntry: (entry: ActivityEntry) => void;
  setEntries: (entries: ActivityEntry[]) => void;
  updateEntry: (id: string, updates: Partial<ActivityEntry>) => void;
  deleteEntry: (id: string) => void;
  removeAttachmentFromEntry: (entryId: string, attachmentId: string) => void;
  addAuditLog: (action: string, module: string, targetId: string, notes: string) => void;
  updateEntryStatus: (id: string, status: EntryStatus) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  wipeSystemData: (password: string) => { ok: boolean; message?: string };
  restoreState: (state: PersistedState) => void;
  getFullState: () => PersistedState;
  unreadCount: number;
  visibleEntries: ActivityEntry[];
};

const SESSION_KEY = "praan_session_user";
const REMEMBER_KEY = "praan_remember_me";
const THEME_KEY = "praan_theme";
const LANGUAGE_KEY = "praan_lang";
const AVAILABLE_THEMES: ThemeMode[] = [
  "corporate-light",
  "corporate-dark",
  "emerald",
  "violet",
  "sunset",
  "mono"
];
const getRemoteDataMode = () => {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE;
  // Default to remote sync for production; can be disabled with NEXT_PUBLIC_DATA_MODE=local
  return mode === "local" ? false : true;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

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

const cloneOrgSettings = (settings: OrgSettings): OrgSettings => ({
  orgName: settings.orgName,
  orgAddress: settings.orgAddress || "",
  orgPhone: settings.orgPhone || "",
  orgEmail: settings.orgEmail || "",
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

const isSameUser = (a: AppUser, b: AppUser) =>
  a.fullName === b.fullName &&
  a.email === b.email &&
  a.title === b.title &&
  a.password === b.password &&
  a.role === b.role &&
  a.active === b.active &&
  a.projects.length === b.projects.length &&
  a.projects.every((project, index) => project === b.projects[index]);

const getClientMeta = () => {
  if (typeof navigator === "undefined") {
    return { device: "Unknown Device", browser: "Unknown Browser" };
  }

  const ua = navigator.userAgent.toLowerCase();
  let browser = "Other";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";

  let device = "Desktop";
  if (ua.includes("android")) device = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) device = "iOS";
  else if (ua.includes("windows")) device = "Windows";
  else if (ua.includes("mac os")) device = "macOS";
  else if (ua.includes("linux")) device = "Linux";

  return { device, browser };
};

export const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
  const REMOTE_DATA_MODE = getRemoteDataMode();
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsersState] = useState<AppUser[]>(cloneUsers(defaultUsers));
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>(defaultLoginLogs.map((item) => ({ ...item })));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(defaultAuditLogs.map((item) => ({ ...item })));
  const [theme, setThemeState] = useState<ThemeMode>("corporate-light");
  const [language, setLanguage] = useState<"en" | "bn">("en");
  const [entries, setEntries] = useState<ActivityEntry[]>(defaultEntries);
  const [notifications, setNotifications] = useState<AppNotification[]>(defaultNotifications);
  const [projectMap, setProjectMapState] = useState<ProjectActivityMap[]>(cloneProjectMap(defaultProjectMap));
  const [locationMap, setLocationMapState] = useState<LocationMap[]>(cloneLocationMap(defaultLocations));
  const [implementedByOptions, setImplementedByOptionsState] = useState<string[]>([...defaultImplementedByOptions]);
  const [venueOptions, setVenueOptionsState] = useState<string[]>([...defaultVenueOptions]);
  const [orgSettings, setOrgSettingsState] = useState<OrgSettings>(cloneOrgSettings(defaultOrgSettings));
  const [reportSettings, setReportSettingsState] = useState<ReportSettings>(cloneReportSettings(defaultReportSettings));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remoteSyncTimer = useRef<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let disposed = false;

    const loadInitialState = async () => {
      let state = getPersistedState();

      if (REMOTE_DATA_MODE) {
        try {
          const response = await fetch("/api/state", { cache: "no-store" });
          if (response.ok) {
            const payload = await response.json();
            if (payload?.ok && payload?.state && typeof payload.state === "object") {
              state = normalizePersistedState(payload.state as Partial<PersistedState>, state);
              savePersistedState(state);
            }
          }
        } catch (error) {
          console.warn("Remote state bootstrap failed, falling back to local cache.", error);
        }
      }

      if (disposed) return;

      setEntries(state.entries);
      setNotifications(state.notifications);
      setLoginLogs(state.loginLogs);
      setAuditLogs(state.auditLogs);
      setUsersState(cloneUsers(state.users));
      setProjectMapState(cloneProjectMap(state.projectMap));
      setLocationMapState(cloneLocationMap(state.locationMap));
      setImplementedByOptionsState([...state.implementedByOptions]);
      setVenueOptionsState([...state.venueOptions]);
      setOrgSettingsState(cloneOrgSettings(state.orgSettings));
      setReportSettingsState(cloneReportSettings(state.reportSettings));

      const storedUsername =
        window.localStorage.getItem(REMEMBER_KEY) === "0"
          ? window.sessionStorage.getItem(SESSION_KEY)
          : window.localStorage.getItem(SESSION_KEY) || window.sessionStorage.getItem(SESSION_KEY);
      if (storedUsername) {
        const found = state.users.find((item) => item.username === storedUsername);
        if (found && found.active) setUser(found);
      }

      const storedTheme = window.localStorage.getItem(THEME_KEY) as ThemeMode | "dark" | "light" | null;
      if (storedTheme === "dark") setThemeState("corporate-dark");
      else if (storedTheme === "light") setThemeState("corporate-light");
      else if (storedTheme && AVAILABLE_THEMES.includes(storedTheme as ThemeMode)) {
        setThemeState(storedTheme as ThemeMode);
      }

      const storedLang = window.localStorage.getItem(LANGUAGE_KEY);
      if (storedLang === "bn") setLanguage("bn");
      setHydrated(true);
    };

    loadInitialState();

    return () => {
      disposed = true;
    };
  }, [REMOTE_DATA_MODE]);

  useEffect(() => {
    if (!hydrated) return;

    const snapshot: PersistedState = {
      entries,
      notifications,
      loginLogs,
      auditLogs,
      users,
      projectMap,
      locationMap,
      implementedByOptions,
      venueOptions,
      orgSettings,
      reportSettings
    };

    savePersistedState(snapshot);

    if (!REMOTE_DATA_MODE) return;

    if (remoteSyncTimer.current) window.clearTimeout(remoteSyncTimer.current);
    remoteSyncTimer.current = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/state", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state: snapshot })
        });
        if (!response.ok) {
          throw new Error(`State sync failed with status ${response.status}`);
        }
      } catch (error) {
        console.warn("Remote state sync failed", error);
      }
    }, 650);
  }, [
    hydrated,
    entries,
    notifications,
    loginLogs,
    auditLogs,
    users,
    projectMap,
    locationMap,
    implementedByOptions,
    venueOptions,
    orgSettings,
    reportSettings,
    REMOTE_DATA_MODE
  ]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("lang", language);
    window.localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (!user) return;
    const latest = users.find((item) => item.username === user.username);
    if (!latest || !latest.active) {
      setUser(null);
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    if (!isSameUser(latest, user)) {
      setUser(latest);
    }
  }, [users, user]);

  useEffect(
    () => () => {
      if (remoteSyncTimer.current) window.clearTimeout(remoteSyncTimer.current);
    },
    []
  );

  const login = (username: string, password: string, remember = true) => {
    const found = users.find((item) => item.username.toLowerCase() === username.trim().toLowerCase());
    if (!found) return { ok: false, message: "User not found" };
    if (!found.active) return { ok: false, message: "Account is inactive" };
    const currentPassword = found.password || "123456";
    if (password !== currentPassword) return { ok: false, message: "Invalid password" };

    const meta = getClientMeta();
    setLoginLogs((prev) => [
      {
        username: found.username,
        loginTime: new Date().toISOString(),
        logoutTime: "-",
        ipAddress: "127.0.0.1",
        device: meta.device,
        browser: meta.browser,
        status: "Success"
      },
      ...prev
    ]);

    setUser(found);
    window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    if (remember) {
      window.localStorage.setItem(SESSION_KEY, found.username);
    } else {
      window.sessionStorage.setItem(SESSION_KEY, found.username);
    }
    return { ok: true };
  };

  const register = (input: RegisterInput) => {
    const exists = users.some((item) => item.username.toLowerCase() === input.username.toLowerCase());
    if (exists) return { ok: false, message: "Username already exists" };

    const selectedProject = input.project || projectMap[0]?.project || "";
    const newUser: AppUser = {
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      title: "Field Officer",
      password: input.password || "123456",
      role: "User",
      active: true,
      projects: selectedProject ? [selectedProject] : []
    };

    setUsersState((prev) => [...prev, newUser]);
    setUser(newUser);
    window.localStorage.setItem(REMEMBER_KEY, "1");
    window.localStorage.setItem(SESSION_KEY, newUser.username);
    return { ok: true };
  };

  const logout = () => {
    const activeUser = user;
    if (activeUser) {
      setLoginLogs((prev) => {
        const index = prev.findIndex(
          (item) => item.username === activeUser.username && (item.logoutTime === "-" || !item.logoutTime)
        );
        if (index < 0) return prev;
        return prev.map((item, currentIndex) =>
          currentIndex === index ? { ...item, logoutTime: new Date().toISOString() } : item
        );
      });
    }
    setUser(null);
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "corporate-dark" ? "corporate-light" : "corporate-dark"));
  };

  const setTheme = (nextTheme: ThemeMode) => {
    if (!AVAILABLE_THEMES.includes(nextTheme)) return;
    setThemeState(nextTheme);
  };

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "bn" : "en"));
  };

  const setUsers = (nextUsers: AppUser[]) => {
    setUsersState(cloneUsers(nextUsers));
  };

  const setProjectMap = (nextMap: ProjectActivityMap[]) => {
    setProjectMapState(cloneProjectMap(nextMap));
  };

  const setLocationMap = (nextMap: LocationMap[]) => {
    setLocationMapState(cloneLocationMap(nextMap));
  };

  const setImplementedByOptions = (list: string[]) => {
    setImplementedByOptionsState(list.filter((item, index) => item.trim() && list.indexOf(item) === index));
  };

  const setVenueOptions = (list: string[]) => {
    setVenueOptionsState(list.filter((item, index) => item.trim() && list.indexOf(item) === index));
  };

  const setOrgSettings = (settings: OrgSettings) => {
    setOrgSettingsState(cloneOrgSettings(settings));
  };

  const setReportSettings = (settings: ReportSettings) => {
    setReportSettingsState(cloneReportSettings(settings));
  };

  const addEntry = (entry: ActivityEntry) => {
    setEntries((prev) => [entry, ...prev]);
    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        title: "New Submission",
        summary: `${entry.uniqueId} submitted by ${entry.createdBy}`,
        at: new Date().toISOString(),
        unread: true,
        entryId: entry.uniqueId
      },
      ...prev
    ]);
  };

  const updateEntry = (id: string, updates: Partial<ActivityEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.uniqueId !== id) return entry;
        const totalBudget = updates.totalBudget ?? entry.totalBudget;
        const totalExpenses = updates.totalExpenses ?? entry.totalExpenses;
        return {
          ...entry,
          ...updates,
          totalBudget,
          totalExpenses,
          variance: calcVariance(totalBudget, totalExpenses),
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  const deleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((entry) => entry.uniqueId !== id));
    setNotifications((prev) => prev.filter((note) => note.entryId !== id));
  };

  const removeAttachmentFromEntry = (entryId: string, attachmentId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.uniqueId === entryId
          ? {
              ...entry,
              attachments: entry.attachments.filter((item) => item.id !== attachmentId),
              updatedAt: new Date().toISOString()
            }
          : entry
      )
    );
  };

  const notify = (message: string, tone: PopupTone = "success") => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const addAuditLog = (action: string, module: string, targetId: string, notes: string) => {
    if (!user) return;
    const meta = getClientMeta();
    setAuditLogs((prev) => [
      {
        actor: user.username,
        role: user.role,
        action,
        module,
        targetId,
        timestamp: new Date().toISOString(),
        device: meta.device,
        browser: meta.browser,
        notes
      },
      ...prev
    ]);
  };

  const wipeSystemData = (password: string) => {
    if (user?.role !== "Admin") return { ok: false, message: "Unauthorized permission." };
    if (!password || user.password !== password) {
      return { ok: false, message: "Incorrect password." };
    }

    setEntries([]);
    setNotifications([]);
    setLoginLogs([]);
    setAuditLogs([{
      actor: user.username,
      role: user.role,
      action: "Wiped System Data",
      module: "Settings",
      targetId: "All",
      timestamp: new Date().toISOString(),
      device: getClientMeta().device,
      browser: getClientMeta().browser,
      notes: "Admin permanently wiped all activities, notifications, and logs."
    }]);

    notify("System data has been completely wiped.", "success");
    return { ok: true };
  };

  const restoreState = (state: PersistedState) => {
    setEntries(state.entries);
    setNotifications(state.notifications);
    setLoginLogs(state.loginLogs);
    setAuditLogs(state.auditLogs);
    setUsersState(cloneUsers(state.users));
    setProjectMapState(cloneProjectMap(state.projectMap));
    setLocationMapState(cloneLocationMap(state.locationMap));
    setImplementedByOptionsState([...state.implementedByOptions]);
    setVenueOptionsState([...state.venueOptions]);
    setOrgSettingsState(cloneOrgSettings(state.orgSettings));
    setReportSettingsState(cloneReportSettings(state.reportSettings));
  };

  const getFullState = (): PersistedState => ({
    entries,
    notifications,
    loginLogs,
    auditLogs,
    users,
    projectMap,
    locationMap,
    implementedByOptions,
    venueOptions,
    orgSettings,
    reportSettings
  });

  const updateEntryStatus = (id: string, status: EntryStatus) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.uniqueId !== id) return entry;
        const reviewedAt = status === "Reviewed" ? new Date().toISOString() : entry.reviewedAt;
        return {
          ...entry,
          status,
          reviewedAt,
          reviewedBy: status === "Reviewed" ? user?.username ?? "" : entry.reviewedBy,
          variance: calcVariance(entry.totalBudget, entry.totalExpenses)
        };
      })
    );
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const role: Role = user?.role ?? "User";
  const viewableEntries = useMemo(
    () => (user ? visibleEntries(entries, role, user.username) : []),
    [entries, role, user]
  );

  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
      <AppContext.Provider
        value={{
          hydrated,
          user,
          users,
        loginLogs,
        auditLogs,
        theme,
        setTheme,
        language,
        entries,
        setEntries,
        notifications,
        setNotifications: (notes: AppNotification[]) => setNotifications(notes),
        projectMap,
        locationMap,
        implementedByOptions,
        venueOptions,
        orgSettings,
        reportSettings,
        login,
        register,
        logout,
        toggleTheme,
        toggleLanguage,
        setUsers,
        setProjectMap,
        setLocationMap,
        setImplementedByOptions,
        setVenueOptions,
        setOrgSettings,
        setReportSettings,
        notify,
        addEntry,
        updateEntry,
        deleteEntry,
        removeAttachmentFromEntry,
        addAuditLog,
        updateEntryStatus,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,
        wipeSystemData,
        restoreState,
        getFullState,
        unreadCount,
        visibleEntries: viewableEntries
      }}
    >
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" aria-live="polite">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast-card toast-${toast.tone}`}
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              role="alert"
            >
              <div className="toast-icon">
                <i
                  className={`bi ${
                    toast.tone === "success"
                      ? "bi-check2-circle"
                      : toast.tone === "error"
                        ? "bi-exclamation-octagon"
                        : "bi-info-circle"
                  }`}
                />
              </div>
              <p className="toast-message">{toast.message}</p>
              <button
                className="toast-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                aria-label="Dismiss"
                type="button"
              >
                <i className="bi bi-x" />
              </button>
              <div className="toast-progress" />
            </div>
          ))}
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used inside AppContextProvider");
  return context;
};
