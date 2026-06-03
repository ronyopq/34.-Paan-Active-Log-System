"use client";

import { useEffect, useMemo, useState } from "react";
import { printTemplatePreview } from "@/lib/print-report";
import { useAppContext } from "@/components/providers/app-context";
import { AppUser, LocationMap, ProjectActivityMap, ThemeMode } from "@/lib/types";
import { exportEntriesToExcel, exportStateAsJson, exportSettingsAsJson, readJsonFile, readExcelFile, exportFullBackup, parseBackupFile, restoreFromBackup } from "@/lib/data-io";
import { ActivityEntry, BackupManifest } from "@/lib/types";
import { PersistedState } from "@/lib/store";

type Tab = "org" | "projects" | "locations" | "participants" | "reports" | "users" | "themes" | "danger" | "data";
type UserForm = {
  fullName: string;
  username: string;
  email: string;
  title: string;
  password: string;
  role: AppUser["role"];
  active: boolean;
  projects: string[];
};

const cloneProjects = (items: ProjectActivityMap[]) =>
  items.map((p) => ({
    project: p.project,
    locked: Boolean(p.locked),
    activities: p.activities.map((a) => ({ ...a, locked: Boolean(a.locked) })),
    participantCategories: p.participantCategories.map((c) => ({ ...c }))
  }));

const cloneLocations = (items: LocationMap[]) =>
  items.map((d) => ({
    district: d.district,
    upazilas: d.upazilas.map((u) => ({ name: u.name, unions: [...u.unions] }))
  }));

const slugify = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const parseUnionsText = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\n,]+/g)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: "corporate-light", label: "Corporate Light" },
  { value: "corporate-dark", label: "Corporate Dark" },
  { value: "emerald", label: "Emerald" },
  { value: "violet", label: "Violet" },
  { value: "sunset", label: "Sunset" },
  { value: "mono", label: "Monochrome" }
];

const emptyUser: UserForm = {
  fullName: "",
  username: "",
  email: "",
  title: "",
  password: "123456",
  role: "User",
  active: true,
  projects: []
};

const normalizeLocations = (items: LocationMap[]): LocationMap[] =>
  items
    .map((d) => ({
      district: d.district.trim(),
      upazilas: d.upazilas
        .map((u) => ({
          name: u.name.trim(),
          unions: u.unions.map((n) => n.trim()).filter(Boolean)
        }))
        .filter((u) => u.name)
    }))
    .filter((d) => d.district)
    .map((d) => ({
      district: d.district,
      upazilas: d.upazilas.length ? d.upazilas : [{ name: "General Upazila", unions: ["General Union"] }]
    }));

const exportDemoDocx = () => {
  const text = "PRAAN Demo DOCX Template\\n\\nTitle:\\nProject:\\nActivity:\\nParticipants:\\nFinancial:\\nNotes:";
  const blob = new Blob([text], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "praan-demo-template.docx";
  a.click();
  URL.revokeObjectURL(url);
};

const move = <T,>(list: T[], i: number, dir: "up" | "down") => {
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export default function AdminPage() {
  const {
    user,
    theme,
    setTheme,
    language,
    entries,
    setEntries,
    notifications,
    setNotifications,
    users: appUsers,
    setUsers: setAppUsers,
    projectMap: appProjectMap,
    setProjectMap: setAppProjectMap,
    locationMap: appLocationMap,
    setLocationMap: setAppLocationMap,
    implementedByOptions,
    setImplementedByOptions,
    venueOptions,
    setVenueOptions,
    orgSettings,
    setOrgSettings,
    reportSettings,
    setReportSettings,
    addAuditLog,
    notify,
    wipeSystemData,
    restoreState,
    getFullState
  } = useAppContext();

  // Helper for applying imported state
  const applyImportedState = (imported: Partial<PersistedState>) => {
    if (imported.orgSettings) setOrgSettings(imported.orgSettings);
    if (imported.reportSettings) setReportSettings(imported.reportSettings);
    if (imported.projectMap) setAppProjectMap(imported.projectMap);
    if (imported.locationMap) setAppLocationMap(imported.locationMap);
    if (imported.users) setAppUsers(imported.users);
    if (imported.entries) setEntries(imported.entries);
    if (imported.implementedByOptions) setImplementedByOptions(imported.implementedByOptions);
    if (imported.venueOptions) setVenueOptions(imported.venueOptions);
    notify("Imported state applied successfully.", "success");
  };

  const [tab, setTab] = useState<Tab>("org");
  const [orgName, setOrgName] = useState(orgSettings.orgName);
  const [orgAddress, setOrgAddress] = useState(orgSettings.orgAddress || "");
  const [orgPhone, setOrgPhone] = useState(orgSettings.orgPhone || "");
  const [orgEmail, setOrgEmail] = useState(orgSettings.orgEmail || "");
  const [logoUrl, setLogoUrl] = useState(orgSettings.logoUrl);
  const [projects, setProjects] = useState<ProjectActivityMap[]>(cloneProjects(appProjectMap));
  const [projectIdx, setProjectIdx] = useState(0);
  const [locationEditor, setLocationEditor] = useState<LocationMap[]>(cloneLocations(appLocationMap));
  const [selectedDistrictIdx, setSelectedDistrictIdx] = useState(0);
  const [selectedUpazilaIdx, setSelectedUpazilaIdx] = useState(0);
  const [newDistrictName, setNewDistrictName] = useState("");
  const [newUpazilaName, setNewUpazilaName] = useState("");
  const [unionEditor, setUnionEditor] = useState("");
  const [users, setUsers] = useState<AppUser[]>(appUsers.map((u) => ({ ...u, projects: [...u.projects] })));
  const [editUser, setEditUser] = useState<string | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser);
  const [wipePassword, setWipePassword] = useState("");
  const [backupPreview, setBackupPreview] = useState<BackupManifest | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  const [newProject, setNewProject] = useState("");
  const [newActivity, setNewActivity] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newType, setNewType] = useState("Training");
  const [newCategory, setNewCategory] = useState("");

  const [tpl, setTpl] = useState(reportSettings.templateName);
  const [reportTheme, setReportTheme] = useState(reportSettings.defaultTheme);
  const [printPreset, setPrintPreset] = useState(reportSettings.printSetup.preset);
  const [printSize, setPrintSize] = useState(reportSettings.printSetup.pageSize);
  const [printOrientation, setPrintOrientation] = useState(reportSettings.printSetup.orientation);
  const [header, setHeader] = useState(reportSettings.printSetup.header);
  const [footer, setFooter] = useState(reportSettings.printSetup.footer);
  const [docx, setDocx] = useState(reportSettings.enableDocx);
  const [pdf, setPdf] = useState(reportSettings.enablePdf);
  const [csv, setCsv] = useState(reportSettings.enableCsv);
  const [zip, setZip] = useState(reportSettings.enableZip);

  const projectNames = useMemo(() => projects.map((p) => p.project), [projects]);
  const currentProject = projects[projectIdx] ?? projects[0];
  const selectedDistrict = locationEditor[selectedDistrictIdx];
  const selectedUpazila = selectedDistrict?.upazilas[selectedUpazilaIdx];

  useEffect(() => { setOrgName(orgSettings.orgName); setOrgAddress(orgSettings.orgAddress || ""); setOrgPhone(orgSettings.orgPhone || ""); setOrgEmail(orgSettings.orgEmail || ""); }, [orgSettings.orgName, orgSettings.orgAddress, orgSettings.orgPhone, orgSettings.orgEmail]);
  useEffect(() => setLogoUrl(orgSettings.logoUrl), [orgSettings.logoUrl]);
  useEffect(() => setProjects(cloneProjects(appProjectMap)), [appProjectMap]);
  useEffect(() => setLocationEditor(cloneLocations(appLocationMap)), [appLocationMap]);
  useEffect(() => setUsers(appUsers.map((u) => ({ ...u, projects: [...u.projects] }))), [appUsers]);
  useEffect(() => {
    if (selectedDistrictIdx >= locationEditor.length) {
      setSelectedDistrictIdx(0);
    }
  }, [locationEditor.length, selectedDistrictIdx]);
  useEffect(() => {
    const upazilaLength = locationEditor[selectedDistrictIdx]?.upazilas.length ?? 0;
    if (selectedUpazilaIdx >= upazilaLength) {
      setSelectedUpazilaIdx(0);
    }
  }, [locationEditor, selectedDistrictIdx, selectedUpazilaIdx]);
  useEffect(() => {
    if (!selectedUpazila) {
      setUnionEditor("");
      return;
    }
    setUnionEditor(selectedUpazila.unions.join(", "));
  }, [selectedUpazila]);
  useEffect(() => {
    if (projectIdx >= projects.length) setProjectIdx(0);
  }, [projectIdx, projects.length]);
  useEffect(() => {
    setTpl(reportSettings.templateName);
    setReportTheme(reportSettings.defaultTheme);
    setPrintPreset(reportSettings.printSetup.preset);
    setPrintSize(reportSettings.printSetup.pageSize);
    setPrintOrientation(reportSettings.printSetup.orientation);
    setHeader(reportSettings.printSetup.header);
    setFooter(reportSettings.printSetup.footer);
    setDocx(reportSettings.enableDocx);
    setPdf(reportSettings.enablePdf);
    setCsv(reportSettings.enableCsv);
    setZip(reportSettings.enableZip);
  }, [reportSettings]);

  if (user?.role !== "Admin") {
    return (
      <section className="panel-card">
        <h1 className="page-title h3 mb-2">Settings</h1>
        <p className="mb-0 text-muted">Only Admin users can access this workspace.</p>
      </section>
    );
  }

  const persistOrganization = (silent = false) => {
    setOrgSettings({
      orgName: orgName.trim() || "PRAAN",
      orgAddress: orgAddress.trim(),
      orgPhone: orgPhone.trim(),
      orgEmail: orgEmail.trim(),
      logoUrl: logoUrl.trim() || "/logo.svg"
    });
    addAuditLog("Updated Organization", "Settings", "org", "Updated organization details");
    if (!silent) notify("Organization settings saved successfully.", "success");
  };
  const persistProjects = (silent = false) => {
    setAppProjectMap(cloneProjects(projects));
    addAuditLog("Updated Project Settings", "Settings", "projects", "Updated projects and participant mapping");
    if (!silent) notify("Project settings saved successfully.", "success");
  };
  const persistLocations = (silent = false) => {
    const normalized = normalizeLocations(locationEditor);
    if (!normalized.length) return;
    setAppLocationMap(normalized);
    addAuditLog("Updated Location Mapping", "Settings", "locations", "Updated district/upazila/union mapping");
    if (!silent) notify("Location mapping saved successfully.", "success");
  };
  const persistReports = (silent = false) => {
    setReportSettings({
      defaultTheme: reportTheme,
      templateName: tpl || "praan-demo-template.docx",
      enableDocx: docx,
      enablePdf: pdf,
      enableCsv: csv,
      enableZip: zip,
      printSetup: {
        preset: printPreset,
        pageSize: printSize,
        orientation: printOrientation === "Landscape" ? "Landscape" : "Portrait",
        header,
        footer
      }
    });
    addAuditLog("Updated Report Settings", "Settings", "reports", "Updated template, export and print setup");
    if (!silent) notify("Report settings saved successfully.", "success");
  };
  const persistUsers = (silent = false) => {
    const nextUsers = users.map((u) => ({ ...u, projects: u.role === "Admin" ? projectNames : u.projects }));
    setAppUsers(nextUsers);
    addAuditLog("Updated User Management", "Settings", "users", "Updated user access");
    if (!silent) notify("User settings saved successfully.", "success");
  };
  const saveAll = () => {
    persistOrganization(true);
    persistProjects(true);
    persistLocations(true);
    persistReports(true);
    persistUsers(true);
    notify("All settings saved successfully.", "success");
  };

  const addProject = () => {
    const name = newProject.trim();
    if (!name || projects.some((p) => p.project.toLowerCase() === name.toLowerCase())) return;
    setProjects((prev) => [...prev, { project: name, locked: false, activities: [], participantCategories: [] }]);
    setNewProject("");
  };
  const addActivity = () => {
    if (!currentProject || !newActivity.trim() || !newCode.trim()) return;
    setProjects((prev) =>
      prev.map((p, i) =>
        i === projectIdx
          ? {
              ...p,
              activities: [...p.activities, { name: newActivity.trim(), code: newCode.trim(), type: newType, locked: false }]
            }
          : p
      )
    );
    setNewActivity("");
    setNewCode("");
  };
  const updateProjectName = (value: string) => {
    if (!currentProject) return;
    const nextName = value.trimStart();
    setProjects((prev) => prev.map((project, index) => (index === projectIdx ? { ...project, project: nextName } : project)));
  };
  const toggleProjectLock = () => {
    if (!currentProject) return;
    setProjects((prev) =>
      prev.map((project, index) => (index === projectIdx ? { ...project, locked: !project.locked } : project))
    );
  };
  const deleteProject = () => {
    if (!currentProject) return;
    if (projects.length <= 1) {
      notify("At least one project is required.", "error");
      return;
    }
    setProjects((prev) => prev.filter((_, index) => index !== projectIdx));
    setProjectIdx((prev) => Math.max(0, prev - 1));
  };
  const updateActivityField = (
    activityIndex: number,
    field: "name" | "code" | "type",
    value: string
  ) => {
    if (!currentProject) return;
    setProjects((prev) =>
      prev.map((project, index) =>
        index === projectIdx
          ? {
              ...project,
              activities: project.activities.map((activity, itemIndex) =>
                itemIndex === activityIndex ? { ...activity, [field]: value } : activity
              )
            }
          : project
      )
    );
  };
  const toggleActivityLock = (activityIndex: number) => {
    if (!currentProject) return;
    setProjects((prev) =>
      prev.map((project, index) =>
        index === projectIdx
          ? {
              ...project,
              activities: project.activities.map((activity, itemIndex) =>
                itemIndex === activityIndex ? { ...activity, locked: !activity.locked } : activity
              )
            }
          : project
      )
    );
  };
  const deleteActivity = (activityIndex: number) => {
    if (!currentProject) return;
    setProjects((prev) =>
      prev.map((project, index) =>
        index === projectIdx
          ? { ...project, activities: project.activities.filter((_, itemIndex) => itemIndex !== activityIndex) }
          : project
      )
    );
  };
  const addCategory = () => {
    const label = newCategory.trim();
    if (!label || !currentProject) return;
    setProjects((prev) =>
      prev.map((p, i) =>
        i === projectIdx ? { ...p, participantCategories: [...p.participantCategories, { key: slugify(label), label }] } : p
      )
    );
    setNewCategory("");
  };
  const addDistrict = () => {
    const name = newDistrictName.trim();
    if (!name) return;
    if (locationEditor.some((item) => item.district.toLowerCase() === name.toLowerCase())) {
      notify("District name already exists.", "error");
      return;
    }

    setLocationEditor((prev) => [...prev, { district: name, upazilas: [] }]);
    setSelectedDistrictIdx(locationEditor.length);
    setSelectedUpazilaIdx(0);
    setNewDistrictName("");
  };
  const updateDistrictName = (value: string) => {
    if (!selectedDistrict) return;
    setLocationEditor((prev) =>
      prev.map((district, index) => (index === selectedDistrictIdx ? { ...district, district: value } : district))
    );
  };
  const deleteDistrict = () => {
    if (!selectedDistrict) return;
    setLocationEditor((prev) => prev.filter((_, index) => index !== selectedDistrictIdx));
    setSelectedDistrictIdx((prev) => Math.max(0, prev - 1));
    setSelectedUpazilaIdx(0);
  };
  const moveDistrict = (dir: "up" | "down") => {
    if (!selectedDistrict) return;
    const target = dir === "up" ? selectedDistrictIdx - 1 : selectedDistrictIdx + 1;
    if (target < 0 || target >= locationEditor.length) return;
    setLocationEditor((prev) => move(prev, selectedDistrictIdx, dir));
    setSelectedDistrictIdx(target);
  };
  const addUpazila = () => {
    const name = newUpazilaName.trim();
    if (!selectedDistrict || !name) return;
    if (selectedDistrict.upazilas.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      notify("Upazila name already exists in this district.", "error");
      return;
    }
    setLocationEditor((prev) =>
      prev.map((district, index) =>
        index === selectedDistrictIdx ? { ...district, upazilas: [...district.upazilas, { name, unions: [] }] } : district
      )
    );
    setSelectedUpazilaIdx(selectedDistrict.upazilas.length);
    setNewUpazilaName("");
  };
  const updateUpazilaName = (value: string) => {
    if (!selectedDistrict || !selectedUpazila) return;
    setLocationEditor((prev) =>
      prev.map((district, districtIndex) =>
        districtIndex === selectedDistrictIdx
          ? {
              ...district,
              upazilas: district.upazilas.map((upazila, upazilaIndex) =>
                upazilaIndex === selectedUpazilaIdx ? { ...upazila, name: value } : upazila
              )
            }
          : district
      )
    );
  };
  const deleteUpazila = () => {
    if (!selectedDistrict || !selectedUpazila) return;
    setLocationEditor((prev) =>
      prev.map((district, districtIndex) =>
        districtIndex === selectedDistrictIdx
          ? { ...district, upazilas: district.upazilas.filter((_, upazilaIndex) => upazilaIndex !== selectedUpazilaIdx) }
          : district
      )
    );
    setSelectedUpazilaIdx((prev) => Math.max(0, prev - 1));
  };
  const moveUpazila = (dir: "up" | "down") => {
    if (!selectedDistrict || !selectedUpazila) return;
    const target = dir === "up" ? selectedUpazilaIdx - 1 : selectedUpazilaIdx + 1;
    if (target < 0 || target >= selectedDistrict.upazilas.length) return;
    setLocationEditor((prev) =>
      prev.map((district, districtIndex) =>
        districtIndex === selectedDistrictIdx ? { ...district, upazilas: move(district.upazilas, selectedUpazilaIdx, dir) } : district
      )
    );
    setSelectedUpazilaIdx(target);
  };
  const saveUnions = () => {
    if (!selectedDistrict || !selectedUpazila) return;
    const unions = parseUnionsText(unionEditor);
    setLocationEditor((prev) =>
      prev.map((district, districtIndex) =>
        districtIndex === selectedDistrictIdx
          ? {
              ...district,
              upazilas: district.upazilas.map((upazila, upazilaIndex) =>
                upazilaIndex === selectedUpazilaIdx ? { ...upazila, unions } : upazila
              )
            }
          : district
      )
    );
    notify("Union list updated for selected upazila.", "success");
  };
  const removeUnion = (name: string) => {
    if (!selectedDistrict || !selectedUpazila) return;
    const nextUnions = selectedUpazila.unions.filter((item) => item !== name);
    setUnionEditor(nextUnions.join(", "));
    setLocationEditor((prev) =>
      prev.map((district, districtIndex) =>
        districtIndex === selectedDistrictIdx
          ? {
              ...district,
              upazilas: district.upazilas.map((upazila, upazilaIndex) =>
                upazilaIndex === selectedUpazilaIdx ? { ...upazila, unions: nextUnions } : upazila
              )
            }
          : district
      )
    );
  };
  const upsertUser = () => {
    if (!userForm.fullName.trim() || !userForm.username.trim() || !userForm.email.trim()) return;
    const payload: AppUser = {
      fullName: userForm.fullName.trim(),
      username: userForm.username.trim(),
      email: userForm.email.trim(),
      title: userForm.title.trim() || "Field Officer",
      password: userForm.password.trim() || "123456",
      role: userForm.role,
      active: userForm.active,
      projects: userForm.role === "Admin" ? projectNames : userForm.projects
    };
    setUsers((prev) => {
      if (editUser) return prev.map((u) => (u.username === editUser ? payload : u));
      if (prev.some((u) => u.username === payload.username)) return prev;
      return [...prev, payload];
    });
    setEditUser(null);
    setUserForm(emptyUser);
  };

  return (
    <div className="d-grid gap-3">
      <section className="page-heading d-flex justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage projects, locations, users, reports, and system data.</p>
        </div>
        <button className="primary-btn" onClick={saveAll}>
          <i className="bi bi-save" /> Save All Changes
        </button>
      </section>

      <section className="admin-layout-grid">
        <article className="admin-nav-card">
          <div className="admin-nav-header">
            <h2>Settings</h2>
          </div>
          <nav className="settings-nav">
            <button className={`settings-nav-btn ${tab === "org" ? "active" : ""}`} onClick={() => setTab("org")}><i className="bi bi-building" />Organization</button>
            <button className={`settings-nav-btn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}><i className="bi bi-diagram-3" />Projects</button>
            <button className={`settings-nav-btn ${tab === "locations" ? "active" : ""}`} onClick={() => setTab("locations")}><i className="bi bi-geo-alt" />Locations</button>
            <button className={`settings-nav-btn ${tab === "participants" ? "active" : ""}`} onClick={() => setTab("participants")}><i className="bi bi-people" />Participants</button>
            <button className={`settings-nav-btn ${tab === "reports" ? "active" : ""}`} onClick={() => setTab("reports")}><i className="bi bi-file-text" />Reports</button>
            <button className={`settings-nav-btn ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}><i className="bi bi-person-badge" />Users</button>
            <button className={`settings-nav-btn ${tab === "themes" ? "active" : ""}`} onClick={() => setTab("themes")}><i className="bi bi-palette" />Themes</button>
            <button className={`settings-nav-btn ${tab === "data" ? "active" : ""}`} onClick={() => setTab("data")}><i className="bi bi-database" />Data</button>
            <button className={`settings-nav-btn text-danger ${tab === "danger" ? "active" : ""}`} onClick={() => setTab("danger")}><i className="bi bi-exclamation-triangle" />Danger Zone</button>
          </nav>
        </article>
        <div className="d-grid gap-3">
          {tab === "data" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-database" /> Data Management</h3>
              </div>
              <div className="admin-export-grid">
                <div className="admin-export-card">
                  <h4 className="text-primary"><i className="bi bi-download" /> Export</h4>
                  <div className="d-grid gap-2">
                    <button className="outline-btn" onClick={() => exportEntriesToExcel(entries, orgSettings)}>
                      <i className="bi bi-file-earmark-excel" /> Activities to Excel
                    </button>
                    <button className="outline-btn" onClick={async () => {
                      try {
                        await exportFullBackup(getFullState(), orgSettings.orgName);
                        notify("Full backup with images downloaded.", "success");
                      } catch (err: any) {
                        notify(err.message || "Backup failed", "error");
                      }
                    }}>
                      <i className="bi bi-cloud-arrow-down" /> Full Backup (with Images)
                    </button>
                    <button className="outline-btn" onClick={() => exportStateAsJson(getFullState())}>
                      <i className="bi bi-file-earmark-code" /> Database Only (JSON)
                    </button>
                    <button className="outline-btn" onClick={() => exportSettingsAsJson(getFullState())}>
                      <i className="bi bi-gear" /> Settings Only
                    </button>
                  </div>
                </div>
                <div className="admin-export-card">
                  <h4 className="text-success"><i className="bi bi-upload" /> Import &amp; Restore</h4>
                  <div className="d-grid gap-3">
                    <div className="admin-field">
                      <label className="form-label">Restore Full Backup (.json)</label>
                      <input type="file" accept=".json" className="form-control premium-input form-control-sm" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const data = await readJsonFile(file);
                            const manifest = parseBackupFile(data);
                            setBackupPreview(manifest);
                          } catch (err: any) { notify(err.message, "error"); }
                        }
                        e.target.value = "";
                      }} />
                    </div>
                    <button className="outline-btn" onClick={() => {
                      const fileInput = document.createElement("input");
                      fileInput.type = "file";
                      fileInput.accept = ".json";
                      fileInput.onchange = async () => {
                        const file = fileInput.files?.[0];
                        if (file) {
                          try {
                            const data = await readJsonFile(file);
                            const parsed = parseBackupFile(data);
                            applyImportedState(parsed.state);
                          } catch (err: any) { notify(err.message, "error"); }
                        }
                      };
                      fileInput.click();
                    }}>
                      <i className="bi bi-arrow-left-circle" /> Restore Database (no images)
                    </button>
                    <div className="admin-field">
                      <label className="form-label">Import Excel (.xlsx)</label>
                      <input type="file" accept=".xlsx, .xls" className="form-control premium-input form-control-sm" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const data = await readExcelFile(file);
                            notify(`Read ${data.length} rows from Excel.`, "info");
                          } catch (err: any) { notify(err.message, "error"); }
                        }
                        e.target.value = "";
                      }} />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )}
          {backupPreview && (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="panel-card" style={{ maxWidth: 480, padding: "1.25rem", borderRadius: 16 }}>
                <div className="mb-3">
                  <h4 className="mb-1">
                    <i className="bi bi-cloud-arrow-up text-success" /> Restore Backup
                  </h4>
                  <p className="text-muted small mb-0">
                    This will replace all current data with the backup contents.
                    Current data will be lost. This action <strong>cannot</strong> be undone.
                  </p>
                </div>
                <div className="d-grid gap-2 mb-3">
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Exported</span>
                    <span>{new Date(backupPreview.exportedAt).toLocaleString("en-GB")}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Organization</span>
                    <span>{backupPreview.orgName}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Entries</span>
                    <span>{backupPreview.entryCount}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Images</span>
                    <span>{backupPreview.imageCount}</span>
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button className="outline-btn flex-fill" onClick={() => setBackupPreview(null)}>
                    Cancel
                  </button>
                  <button className="danger-btn flex-fill" disabled={restoreLoading} onClick={async () => {
                    setRestoreLoading(true);
                    try {
                      const restored = restoreFromBackup(backupPreview);
                      restoreState(restored);
                      addAuditLog("Restored Backup", "Settings", "backup", `Restored ${backupPreview.entryCount} entries, ${backupPreview.imageCount} images`);
                      notify(`Backup restored successfully (${backupPreview.entryCount} entries, ${backupPreview.imageCount} images).`, "success");
                      setBackupPreview(null);
                    } catch (err: any) {
                      notify(err.message || "Restore failed", "error");
                    }
                    setRestoreLoading(false);
                  }}>
                    {restoreLoading ? "Restoring..." : "Restore Backup"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab === "danger" && (
            <article className="admin-danger-card">
              <div className="settings-section-head" style={{borderBottomColor:"color-mix(in srgb, var(--danger) 30%, transparent)"}}>
                <h3 style={{color:"var(--danger)"}}><i className="bi bi-exclamation-triangle-fill" /> Danger Zone</h3>
              </div>
              <p className="fw-medium mb-3" style={{color:"var(--danger)"}}>
                <i className="bi bi-info-circle" /> Wiping system data permanently deletes ALL activities, notifications, and logs. Admin accounts and settings remain safe. This action <strong>cannot</strong> be undone.
              </p>
              <div className="row g-3 align-items-end">
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label" style={{color:"var(--danger)"}}>Confirm with Admin Password</label>
                    <input type="password" className="form-control premium-input" style={{borderColor:"var(--danger)"}} placeholder="Enter your admin password" value={wipePassword} onChange={(e) => setWipePassword(e.target.value)} />
                  </div>
                </div>
                <div className="col-md-6 d-flex align-items-end">
                  <button className="danger-btn w-100" onClick={() => { const res = wipeSystemData(wipePassword); if (!res.ok) notify(res.message || "Wipe failed", "error"); else setWipePassword(""); }} disabled={!wipePassword}>
                    <i className="bi bi-trash3" /> Wipe System Data
                  </button>
                </div>
              </div>
            </article>
          )}
          {tab === "org" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-building" /> Organization</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => persistOrganization()}>Save</button>
                </div>
              </div>
              <div className="admin-kv-grid">
                <div className="admin-field">
                  <label className="form-label"><i className="bi bi-tag" /> Organization Name</label>
                  <input className="form-control premium-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. PRAAN" />
                </div>
                <div className="admin-field">
                  <label className="form-label"><i className="bi bi-geo-alt" /> Address</label>
                  <input className="form-control premium-input" value={orgAddress} onChange={(e) => setOrgAddress(e.target.value)} placeholder="e.g. Dhaka, Bangladesh" />
                </div>
                <div className="admin-field">
                  <label className="form-label"><i className="bi bi-telephone" /> Phone</label>
                  <input className="form-control premium-input" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} placeholder="e.g. +880 1700-000000" />
                </div>
                <div className="admin-field">
                  <label className="form-label"><i className="bi bi-envelope" /> Email</label>
                  <input className="form-control premium-input" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="e.g. info@praan.org" />
                </div>
                <div className="admin-field">
                  <label className="form-label"><i className="bi bi-image" /> Logo URL</label>
                  <input className="form-control premium-input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="e.g. /logo.svg" />
                </div>
              </div>
            </article>
          )}
          {tab === "projects" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-diagram-3" /> Projects &amp; Activities</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => persistProjects()}>Save</button>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <div className="admin-field">
                    <label className="form-label">Select Project</label>
                    <div className="admin-option-group">
                      {projectNames.map((n) => (
                        <button key={n} className={`admin-chip ${currentProject?.project === n ? "active" : ""}`} onClick={() => setProjectIdx(projectNames.indexOf(n))}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="admin-field">
                    <label className="form-label">Project Name</label>
                    <input className="form-control premium-input" value={currentProject?.project || ""} onChange={(e) => updateProjectName(e.target.value)} />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="admin-field">
                    <label className="form-label">Status</label>
                    <div className="admin-action-bar pt-1">
                      <button className={`admin-chip ${currentProject?.locked ? "active" : ""}`} onClick={toggleProjectLock} disabled={!currentProject}>
                        <i className={`bi ${currentProject?.locked ? "bi-lock" : "bi-unlock"}`} /> {currentProject?.locked ? "Locked" : "Active"}
                      </button>
                      <button className="admin-chip text-danger" onClick={deleteProject} disabled={!currentProject}>
                        <i className="bi bi-trash" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Add New Project</label>
                    <div className="d-flex gap-2">
                      <input className="form-control premium-input" value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="Project name" />
                      <button className="outline-btn" onClick={addProject}>Add</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-12"><hr className="my-2" /><label className="form-label fw-bold">Add Activity</label></div>
                <div className="col-md-4">
                  <input className="form-control premium-input" value={newActivity} onChange={(e) => setNewActivity(e.target.value)} placeholder="Activity name" />
                </div>
                <div className="col-md-3">
                  <input className="form-control premium-input mono" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Activity code" />
                </div>
                <div className="col-md-2">
                  <select className="form-select premium-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
                    <option>Training</option><option>Workshop</option><option>Meeting</option><option>Distribution</option><option>Campaign</option>
                  </select>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button className="outline-btn w-100" onClick={addActivity}><i className="bi bi-plus-lg" /> Add Activity</button>
                </div>
              </div>

              {(!currentProject?.activities.length) ? (
                <div className="admin-empty-state">
                  <i className="bi bi-inbox" />
                  <p className="mb-0">No activities added for this project.</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="table premium-table mb-0">
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Code</th>
                        <th>Type</th>
                        <th style={{width:100}}>Lock</th>
                        <th style={{width:80}} />
                      </tr>
                    </thead>
                    <tbody>
                      {currentProject?.activities.map((activity, idx) => (
                        <tr key={`${activity.code}-${idx}`}>
                          <td><input className="form-control premium-input form-control-sm" value={activity.name} onChange={(e) => updateActivityField(idx, "name", e.target.value)} /></td>
                          <td><input className="form-control premium-input form-control-sm mono" value={activity.code} onChange={(e) => updateActivityField(idx, "code", e.target.value)} /></td>
                          <td><input className="form-control premium-input form-control-sm" value={activity.type} onChange={(e) => updateActivityField(idx, "type", e.target.value)} /></td>
                          <td>
                            <button className={`admin-chip ${activity.locked ? "active" : ""}`} style={{fontSize:"0.75rem"}} onClick={() => toggleActivityLock(idx)}>
                              <i className={`bi ${activity.locked ? "bi-lock" : "bi-unlock"}`} /> {activity.locked ? "Lock" : "Active"}
                            </button>
                          </td>
                          <td className="text-end">
                            <button className="icon-btn" onClick={() => deleteActivity(idx)}><i className="bi bi-trash" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}
          {tab === "locations" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-geo-alt" /> Location Mapping</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => persistLocations()}>Save</button>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Districts</label>
                    <div className="admin-option-group">
                      {locationEditor.map((d, idx) => (
                        <button key={d.district} className={`admin-chip ${selectedDistrictIdx === idx ? "active" : ""}`} onClick={() => { setSelectedDistrictIdx(idx); setSelectedUpazilaIdx(0); }}>
                          {d.district}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Name</label>
                    <input className="form-control premium-input" value={selectedDistrict?.district || ""} onChange={(e) => updateDistrictName(e.target.value)} disabled={!selectedDistrict} />
                  </div>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <div className="admin-action-bar">
                    <button className="icon-btn" onClick={() => moveDistrict("up")} disabled={!selectedDistrict || selectedDistrictIdx === 0}><i className="bi bi-chevron-up" /></button>
                    <button className="icon-btn" onClick={() => moveDistrict("down")} disabled={!selectedDistrict || selectedDistrictIdx === locationEditor.length - 1}><i className="bi bi-chevron-down" /></button>
                    <button className="admin-chip text-danger" onClick={deleteDistrict} disabled={!selectedDistrict}><i className="bi bi-trash" /> Delete</button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Add District</label>
                    <div className="d-flex gap-2">
                      <input className="form-control premium-input" value={newDistrictName} onChange={(e) => setNewDistrictName(e.target.value)} placeholder="District name" />
                      <button className="outline-btn" onClick={addDistrict}>Add</button>
                    </div>
                  </div>
                </div>
              </div>

              {selectedDistrict && (
                <>
                  <hr className="my-3" />
                  <div className="row g-3 mb-3">
                    <div className="col-12"><label className="form-label fw-bold">Upazilas in {selectedDistrict.district}</label></div>
                    <div className="col-md-6">
                      <div className="admin-option-group">
                        {selectedDistrict.upazilas.map((u, idx) => (
                          <button key={u.name} className={`admin-chip ${selectedUpazilaIdx === idx ? "active" : ""}`} onClick={() => setSelectedUpazilaIdx(idx)}>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-md-3">
                      <input className="form-control premium-input" value={selectedUpazila?.name || ""} onChange={(e) => updateUpazilaName(e.target.value)} disabled={!selectedUpazila} placeholder="Upazila name" />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                      <div className="admin-action-bar">
                        <button className="icon-btn" onClick={() => moveUpazila("up")} disabled={!selectedUpazila || selectedUpazilaIdx === 0}><i className="bi bi-chevron-up" /></button>
                        <button className="icon-btn" onClick={() => moveUpazila("down")} disabled={!selectedUpazila || selectedUpazilaIdx === selectedDistrict.upazilas.length - 1}><i className="bi bi-chevron-down" /></button>
                        <button className="admin-chip text-danger" onClick={deleteUpazila} disabled={!selectedUpazila}><i className="bi bi-trash" /></button>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="d-flex gap-2">
                        <input className="form-control premium-input" value={newUpazilaName} onChange={(e) => setNewUpazilaName(e.target.value)} placeholder="Upazila name" />
                        <button className="outline-btn" onClick={addUpazila}>Add</button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedUpazila && (
                <>
                  <hr className="my-3" />
                  <div className="row g-3">
                    <div className="col-12"><label className="form-label fw-bold">Unions in {selectedUpazila.name}</label></div>
                    <div className="col-12">
                      <div className="d-flex gap-2">
                        <textarea className="form-control premium-input" rows={3} value={unionEditor} onChange={(e) => setUnionEditor(e.target.value)} placeholder="Comma or new line separated union names" />
                      </div>
                    </div>
                    <div className="col-12 d-flex justify-content-between align-items-center">
                      <span className="small text-muted">{parseUnionsText(unionEditor).length} union(s)</span>
                      <button className="outline-btn" onClick={saveUnions}><i className="bi bi-check2-circle" /> Update Unions</button>
                    </div>
                    {selectedUpazila.unions.length > 0 && (
                      <div className="col-12 d-flex flex-wrap gap-2">
                        {selectedUpazila.unions.map((name) => (
                          <button key={name} className="union-chip" onClick={() => removeUnion(name)}>
                            {name} <i className="bi bi-x-lg" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </article>
          )}
          {tab === "participants" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-people" /> Participant Categories</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => persistProjects()}>Save</button>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Project</label>
                    <div className="admin-option-group">
                      {projectNames.map((n) => (
                        <button key={n} className={`admin-chip ${currentProject?.project === n ? "active" : ""}`} onClick={() => setProjectIdx(projectNames.indexOf(n))}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Add Category</label>
                    <div className="d-flex gap-2">
                      <input className="form-control premium-input" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Male, Female, Youth" />
                      <button className="outline-btn" onClick={addCategory}>Add</button>
                    </div>
                  </div>
                </div>
              </div>

              {(!currentProject?.participantCategories.length) ? (
                <div className="admin-empty-state">
                  <i className="bi bi-people" />
                  <p className="mb-0">No categories defined for this project.</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="table premium-table mb-0">
                    <thead>
                      <tr>
                        <th>Label</th>
                        <th>Key</th>
                        <th style={{width:120}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProject?.participantCategories.map((c, idx) => (
                        <tr key={`${c.key}-${idx}`}>
                          <td><input className="form-control premium-input form-control-sm" value={c.label} onChange={(e) => setProjects((prev) => prev.map((p, i) => i === projectIdx ? { ...p, participantCategories: p.participantCategories.map((r, j) => (j === idx ? { ...r, label: e.target.value } : r)) } : p))} /></td>
                          <td><input className="form-control premium-input form-control-sm mono" value={c.key} onChange={(e) => setProjects((prev) => prev.map((p, i) => i === projectIdx ? { ...p, participantCategories: p.participantCategories.map((r, j) => (j === idx ? { ...r, key: slugify(e.target.value) } : r)) } : p))} /></td>
                          <td>
                            <div className="admin-action-bar">
                              <button className="icon-btn" onClick={() => setProjects((prev) => prev.map((p, i) => i === projectIdx ? { ...p, participantCategories: move(p.participantCategories, idx, "up") } : p))}><i className="bi bi-chevron-up" /></button>
                              <button className="icon-btn" onClick={() => setProjects((prev) => prev.map((p, i) => i === projectIdx ? { ...p, participantCategories: move(p.participantCategories, idx, "down") } : p))}><i className="bi bi-chevron-down" /></button>
                              <button className="icon-btn" onClick={() => setProjects((prev) => prev.map((p, i) => i === projectIdx ? { ...p, participantCategories: p.participantCategories.filter((_, j) => j !== idx) } : p))}><i className="bi bi-trash" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}
          {tab === "reports" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-file-text" /> Report &amp; Print Setup</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => persistReports()}>Save</button>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Default Theme</label>
                    <select className="form-select premium-input" value={reportTheme} onChange={(e) => setReportTheme(e.target.value)}>
                      <option>Corporate Blue</option><option>Clean Neutral</option><option>Executive Dark</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">DOCX Template</label>
                    <input className="form-control premium-input" value={tpl} readOnly />
                  </div>
                </div>
                <div className="col-12">
                  <div className="admin-action-bar">
                    <button className="outline-btn" onClick={exportDemoDocx}><i className="bi bi-download" /> Export Demo DOCX</button>
                    <label className="outline-btn m-0"><i className="bi bi-upload" /> Import DOCX<input type="file" accept=".doc,.docx" className="d-none" onChange={(e) => setTpl(e.target.files?.[0]?.name || tpl)} /></label>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-12"><label className="form-label fw-bold">Export Formats</label></div>
                <div className="col-12">
                  <div className="admin-option-group">
                    <label className={`admin-chip ${docx ? "active" : ""}`} style={{cursor:"pointer"}} onClick={() => setDocx(!docx)}>
                      <i className={`bi ${docx ? "bi-check2-square" : "bi-square"}`} /> DOCX
                    </label>
                    <label className={`admin-chip ${pdf ? "active" : ""}`} style={{cursor:"pointer"}} onClick={() => setPdf(!pdf)}>
                      <i className={`bi ${pdf ? "bi-check2-square" : "bi-square"}`} /> PDF
                    </label>
                    <label className={`admin-chip ${csv ? "active" : ""}`} style={{cursor:"pointer"}} onClick={() => setCsv(!csv)}>
                      <i className={`bi ${csv ? "bi-check2-square" : "bi-square"}`} /> CSV
                    </label>
                    <label className={`admin-chip ${zip ? "active" : ""}`} style={{cursor:"pointer"}} onClick={() => setZip(!zip)}>
                      <i className={`bi ${zip ? "bi-check2-square" : "bi-square"}`} /> ZIP
                    </label>
                  </div>
                </div>
              </div>

              <hr />
              <div className="row g-3">
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Preset</label>
                    <select className="form-select premium-input" value={printPreset} onChange={(e) => setPrintPreset(e.target.value)}>
                      <option>Standard A4</option><option>Compact</option><option>Detailed</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Page Size</label>
                    <select className="form-select premium-input" value={printSize} onChange={(e) => setPrintSize(e.target.value)}>
                      <option>A4</option><option>Letter</option><option>Legal</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Orientation</label>
                    <select className="form-select premium-input" value={printOrientation} onChange={(e) => setPrintOrientation(e.target.value as "Portrait" | "Landscape")}>
                      <option>Portrait</option><option>Landscape</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button className="outline-btn w-100" onClick={() => printTemplatePreview({ preset: printPreset, pageSize: printSize, orientation: printOrientation === "Landscape" ? "Landscape" : "Portrait", header, footer }, tpl)}>
                    <i className="bi bi-printer" /> Preview
                  </button>
                </div>
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Header</label>
                    <input className="form-control premium-input" value={header} onChange={(e) => setHeader(e.target.value)} />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="admin-field">
                    <label className="form-label">Footer</label>
                    <input className="form-control premium-input" value={footer} onChange={(e) => setFooter(e.target.value)} />
                  </div>
                </div>
              </div>
            </article>
          )}
          {tab === "users" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-person-badge" /> User Management</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => persistUsers()}>Save</button>
                </div>
              </div>

              <div className="row g-3 mb-3 p-3" style={{background:"color-mix(in srgb, var(--surface-soft) 60%, var(--surface))", borderRadius:"14px", border:"1px solid var(--line)"}}>
                <div className="col-12"><label className="form-label fw-bold">{editUser ? "Edit User" : "Create New User"}</label></div>
                <div className="col-md-4">
                  <div className="admin-field">
                    <label className="form-label">Full Name</label>
                    <input className="form-control premium-input" value={userForm.fullName} onChange={(e) => setUserForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" />
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Username</label>
                    <input className="form-control premium-input" value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} disabled={Boolean(editUser)} placeholder="johndoe" />
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="admin-field">
                    <label className="form-label">Email</label>
                    <input className="form-control premium-input" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="admin-field">
                    <label className="form-label">Designation</label>
                    <input className="form-control premium-input" value={userForm.title} onChange={(e) => setUserForm((p) => ({ ...p, title: e.target.value }))} placeholder="Field Officer / Manager" />
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Password</label>
                    <input type="text" className="form-control premium-input mono" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} placeholder="123456" />
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="admin-field">
                    <label className="form-label">Role</label>
                    <select className="form-select premium-input" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as AppUser["role"] }))}>
                      <option>User</option><option>Manager</option><option>Admin</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <label className={`admin-chip ${userForm.active ? "active" : ""}`} style={{cursor:"pointer"}} onClick={() => setUserForm((p) => ({ ...p, active: !p.active }))}>
                    <i className={`bi ${userForm.active ? "bi-toggle-on" : "bi-toggle-off"}`} /> {userForm.active ? "Active" : "Inactive"}
                  </label>
                </div>
                <div className="col-12">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div className="admin-option-group">
                      <span className="small text-muted">Projects:</span>
                      {projectNames.map((p) => (
                        <label key={p} className={`admin-chip ${userForm.role === "Admin" || userForm.projects.includes(p) ? "active" : ""}`} style={{cursor: userForm.role === "Admin" ? "default" : "pointer"}} onClick={() => {
                          if (userForm.role === "Admin") return;
                          setUserForm((prev) => ({
                            ...prev,
                            projects: prev.projects.includes(p) ? prev.projects.filter((x) => x !== p) : [...prev.projects, p]
                          }));
                        }}>
                          {p}
                        </label>
                      ))}
                    </div>
                    <button className="primary-btn" onClick={upsertUser}>
                      <i className={`bi ${editUser ? "bi-pencil" : "bi-person-plus"}`} /> {editUser ? "Update" : "Create"}
                    </button>
                  </div>
                </div>
              </div>

              {!users.length ? (
                <div className="admin-empty-state">
                  <i className="bi bi-people" />
                  <p className="mb-0">No users yet.</p>
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="table premium-table mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Projects</th>
                        <th style={{width:100}} />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.username}>
                          <td><strong>{u.fullName}</strong><br /><small className="text-muted">{u.title || "-"}</small></td>
                          <td className="mono">{u.username}</td>
                          <td className="small">{u.email}</td>
                          <td><span className={`user-role ${u.role.toLowerCase()}`}>{u.role}</span></td>
                          <td><span className={`admin-chip ${u.active ? "active" : ""}`} style={{fontSize:"0.72rem",cursor:"default"}}>{u.active ? "Active" : "Inactive"}</span></td>
                          <td className="small">{u.role === "Admin" ? "All" : u.projects.join(", ") || "-"}</td>
                          <td>
                            <div className="admin-action-bar justify-content-end">
                              <button className="icon-btn" onClick={() => {
                                setEditUser(u.username);
                                setUserForm({
                                  fullName: u.fullName, username: u.username, email: u.email, title: u.title || "",
                                  password: u.password || "123456", role: u.role, active: u.active,
                                  projects: u.role === "Admin" ? projectNames : u.projects
                                });
                              }}><i className="bi bi-pencil" /></button>
                              <button className="icon-btn" onClick={() => setUsers((prev) => prev.map((x) => (x.username === u.username ? { ...x, active: !x.active } : x)))}>
                                <i className={`bi ${u.active ? "bi-toggle-on" : "bi-toggle-off"}`} />
                              </button>
                              <button className="icon-btn" onClick={() => setUsers((prev) => prev.filter((x) => x.username !== u.username))}><i className="bi bi-trash" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          )}
          {tab === "themes" && (
            <article className="settings-section">
              <div className="settings-section-head">
                <h3><i className="bi bi-palette" /> Theme Panel</h3>
                <div className="admin-action-bar">
                  <button className="primary-btn" onClick={() => { addAuditLog("Updated Theme", "Settings", "theme", `Theme set to ${theme}`); notify("Theme saved.", "success"); }}>Save</button>
                </div>
              </div>
              <div className="admin-theme-grid">
                {themeOptions.map((t) => {
                  const swatches: Record<string, string> = {
                    "corporate-light": "#0f4fa8",
                    "corporate-dark": "#5ea1ff",
                    "emerald": "#1f8f6b",
                    "violet": "#5e50aa",
                    "sunset": "#d4824a",
                    "mono": "#4a4a4a"
                  };
                  return (
                    <div key={t.value} className={`admin-theme-card ${theme === t.value ? "active" : ""}`} onClick={() => setTheme(t.value)}>
                      <div className="theme-swatch" style={{background: swatches[t.value] || "var(--brand)"}} />
                      <div className="theme-label">{t.label}</div>
                      <div className="theme-desc">{theme === t.value ? "Active" : "Click to apply"}</div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
