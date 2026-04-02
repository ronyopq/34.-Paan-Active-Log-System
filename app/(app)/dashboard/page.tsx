"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/common/kpi-card";
import { EntryDetailsModal } from "@/components/activities/entry-details-modal";
import { ActivityCalendar } from "@/components/dashboard/activity-calendar";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { useAppContext } from "@/components/providers/app-context";
import { formatCurrency } from "@/lib/format";
import { filterEntriesByReportFilters, ReportFilters } from "@/lib/reporting";

const createDashboardFilters = (): ReportFilters => ({
  project: "",
  activityName: "",
  district: "",
  upazila: "",
  union: "",
  dateFrom: "",
  dateTo: "",
  status: ""
});

export default function DashboardPage() {
  const { visibleEntries, user, updateEntry, deleteEntry, removeAttachmentFromEntry, addAuditLog, notify } =
    useAppContext();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>(createDashboardFilters);

  const projectOptions = useMemo(
    () => Array.from(new Set(visibleEntries.map((entry) => entry.project))).sort(),
    [visibleEntries]
  );
  const districtOptions = useMemo(
    () => Array.from(new Set(visibleEntries.map((entry) => entry.district))).sort(),
    [visibleEntries]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(visibleEntries.map((entry) => entry.status))).sort(),
    [visibleEntries]
  );

  const filteredEntries = useMemo(
    () => filterEntriesByReportFilters(visibleEntries, filters),
    [filters, visibleEntries]
  );

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.uniqueId === selectedEntryId) || visibleEntries.find((entry) => entry.uniqueId === selectedEntryId),
    [filteredEntries, selectedEntryId, visibleEntries]
  );

  const totalParticipants = filteredEntries.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const totalBudget = filteredEntries.reduce((sum, entry) => sum + entry.totalBudget, 0);
  const totalExpenses = filteredEntries.reduce((sum, entry) => sum + entry.totalExpenses, 0);
  const attachmentCount = filteredEntries.reduce((sum, entry) => sum + entry.attachments.length, 0);
  const projects = new Set(filteredEntries.map((entry) => entry.project)).size;
  const districts = new Set(filteredEntries.map((entry) => entry.district)).size;
  const topProject = useMemo(() => {
    const counts = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      counts.set(entry.project, (counts.get(entry.project) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  }, [filteredEntries]);
  const busiestDistrict = useMemo(() => {
    const counts = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      counts.set(entry.district, (counts.get(entry.district) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  }, [filteredEntries]);

  return (
    <div className="d-grid gap-4">
      <section className="page-heading d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Role: {user?.role} | Monitor activities, analytics, and field coverage from one place.
          </p>
        </div>
        <button className="outline-btn" type="button" onClick={() => setFilters(createDashboardFilters())}>
          <i className="bi bi-arrow-counterclockwise" /> Reset Filters
        </button>
      </section>

      <section className="panel-card">
        <div className="row g-2">
          <div className="col-lg-3 col-md-6">
            <label className="form-label">Project</label>
            <select
              className="form-select premium-input"
              value={filters.project}
              onChange={(event) => setFilters((prev) => ({ ...prev, project: event.target.value }))}
            >
              <option value="">All Projects</option>
              {projectOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-3 col-md-6">
            <label className="form-label">District</label>
            <select
              className="form-select premium-input"
              value={filters.district}
              onChange={(event) => setFilters((prev) => ({ ...prev, district: event.target.value }))}
            >
              <option value="">All Districts</option>
              {districtOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="form-label">Status</label>
            <select
              className="form-select premium-input"
              value={filters.status || ""}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All Status</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-control premium-input"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-control premium-input"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </div>
        </div>
        <p className="small text-muted mt-3 mb-0">{filteredEntries.length} activity record(s) shown in the dashboard.</p>
      </section>

      <section className="grid-kpi">
        <KpiCard label="Total Activities" value={filteredEntries.length} icon="bi-clipboard-check" accent="green" />
        <KpiCard label="Total Participants" value={totalParticipants} icon="bi-people" accent="blue" />
        <KpiCard label="Total Budget" value={formatCurrency(totalBudget)} icon="bi-cash-stack" accent="amber" />
        <KpiCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon="bi-wallet2" accent="rose" />
        <KpiCard label="Projects Covered" value={projects} icon="bi-folder2-open" accent="green" />
        <KpiCard label="District Coverage" value={districts} icon="bi-geo-alt" accent="blue" />
      </section>

      <section className="report-summary-grid">
        <article className="panel-card report-summary-card">
          <p className="text-muted mb-2">Top Project</p>
          <h3 className="report-summary-value">{topProject}</h3>
          <small className="text-muted">Most active project in the current dashboard filter.</small>
        </article>
        <article className="panel-card report-summary-card">
          <p className="text-muted mb-2">Busiest District</p>
          <h3 className="report-summary-value">{busiestDistrict}</h3>
          <small className="text-muted">District with the highest number of matching activities.</small>
        </article>
        <article className="panel-card report-summary-card">
          <p className="text-muted mb-2">Attachments</p>
          <h3 className="report-summary-value">{attachmentCount}</h3>
          <small className="text-muted">Total linked files across the visible dashboard records.</small>
        </article>
      </section>

      <DashboardCharts entries={filteredEntries} />

      <ActivityCalendar entries={filteredEntries} onEventSelect={setSelectedEntryId} />

      {selectedEntry && (
        <EntryDetailsModal
          entry={selectedEntry}
          onClose={() => setSelectedEntryId(null)}
          canManage={user?.role === "Admin"}
          onUpdateEntry={(id, updates) => {
            updateEntry(id, updates);
            addAuditLog("Updated Entry", "Dashboard", id, "Entry edited from dashboard");
            notify(`Entry updated: ${id}`, "success");
          }}
          onDeleteEntry={(id) => {
            deleteEntry(id);
            addAuditLog("Deleted Entry", "Dashboard", id, "Entry deleted from dashboard");
            notify(`Entry deleted: ${id}`, "success");
          }}
          onRemoveAttachment={(entryId, attachmentId) => {
            removeAttachmentFromEntry(entryId, attachmentId);
            addAuditLog("Deleted Attachment", "Dashboard", entryId, `Attachment removed: ${attachmentId}`);
            notify("Attachment removed.", "success");
          }}
        />
      )}
    </div>
  );
}
