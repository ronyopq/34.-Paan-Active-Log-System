"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { EntryDetailsModal } from "@/components/activities/entry-details-modal";
import { KpiCard } from "@/components/common/kpi-card";
import { StatusBadge } from "@/components/common/status-badge";
import { useAppContext } from "@/components/providers/app-context";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  exportEntriesToCsv,
  exportEntriesReportToExcel,
  exportEntriesReportToPdf,
  filterEntriesByReportFilters,
  printEntriesReport,
  ReportFilters,
  summarizeEntries
} from "@/lib/reporting";
import { ActivityEntry } from "@/lib/types";

const PAGE_SIZE = 20;

const createFilters = (): ReportFilters => ({
  project: "",
  activityName: "",
  district: "",
  upazila: "",
  union: "",
  dateFrom: "",
  dateTo: ""
});

export default function ReportsPage() {
  const { visibleEntries, orgSettings } = useAppContext();
  const [filters, setFilters] = useState<ReportFilters>(createFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const projectOptions = useMemo(
    () => Array.from(new Set(visibleEntries.map((entry) => entry.project))).sort(),
    [visibleEntries]
  );
  const activityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          visibleEntries
            .filter((entry) => !filters.project || entry.project === filters.project)
            .map((entry) => entry.activityName)
        )
      ).sort(),
    [filters.project, visibleEntries]
  );
  const districtOptions = useMemo(
    () => Array.from(new Set(visibleEntries.map((entry) => entry.district))).sort(),
    [visibleEntries]
  );
  const upazilaOptions = useMemo(
    () =>
      Array.from(
        new Set(
          visibleEntries
            .filter((entry) => !filters.district || entry.district === filters.district)
            .map((entry) => entry.upazila)
        )
      ).sort(),
    [filters.district, visibleEntries]
  );
  const unionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          visibleEntries
            .filter(
              (entry) =>
                (!filters.district || entry.district === filters.district) &&
                (!filters.upazila || entry.upazila === filters.upazila)
            )
            .map((entry) => entry.union)
        )
      ).sort(),
    [filters.district, filters.upazila, visibleEntries]
  );

  const filteredEntries = useMemo(
    () => filterEntriesByReportFilters(visibleEntries, filters),
    [filters, visibleEntries]
  );
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [filteredEntries.length]);
  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, page]);
  const summary = useMemo(() => summarizeEntries(filteredEntries), [filteredEntries]);
  const selectedEntry = visibleEntries.find((entry) => entry.uniqueId === selectedId) || null;
  const topProject = useMemo(() => {
    const counts = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      counts.set(entry.project, (counts.get(entry.project) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  }, [filteredEntries]);
  const topLocation = useMemo(() => {
    const counts = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      const key = `${entry.district} / ${entry.upazila}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";
  }, [filteredEntries]);

  const updateFilter = <Key extends keyof ReportFilters>(key: Key, value: ReportFilters[Key]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const openEntry = (entry: ActivityEntry) => {
    setSelectedId(entry.uniqueId);
  };

  return (
    <div className="d-grid gap-4">
      <section className="page-heading d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1 className="page-title">Report</h1>
          <p className="page-subtitle">
            Generate filtered activity reports by project, activity, location, and date range.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap page-actions">
          <button
            className="outline-btn"
            type="button"
            disabled={!filteredEntries.length}
            onClick={() => exportEntriesToCsv(filteredEntries, "report-detailed.csv")}
          >
            <i className="bi bi-filetype-csv" /> Export CSV
          </button>
          <button
            className="outline-btn"
            type="button"
            disabled={!filteredEntries.length}
            onClick={() => exportEntriesReportToPdf(filteredEntries, filters, orgSettings)}
          >
            <i className="bi bi-file-earmark-pdf" /> Export PDF
          </button>
          <button
            className="outline-btn"
            type="button"
            disabled={!filteredEntries.length}
            onClick={() => printEntriesReport(filteredEntries, filters, orgSettings)}
          >
            <i className="bi bi-printer" /> Print
          </button>
          <button
            className="primary-btn"
            type="button"
            disabled={!filteredEntries.length}
            onClick={() => exportEntriesReportToExcel(filteredEntries, filters, orgSettings)}
          >
            <i className="bi bi-file-earmark-excel" /> Export Excel
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="row g-2">
          <div className="col-lg-4 col-md-6">
            <label className="form-label">Project</label>
            <select
              className="form-select premium-input"
              value={filters.project}
              onChange={(event) => {
                const nextProject = event.target.value;
                setFilters((prev) => ({
                  ...prev,
                  project: nextProject,
                  activityName: nextProject === prev.project ? prev.activityName : ""
                }));
              }}
            >
              <option value="">All Projects</option>
              {projectOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4 col-md-6">
            <label className="form-label">Activity</label>
            <select
              className="form-select premium-input"
              value={filters.activityName}
              onChange={(event) => updateFilter("activityName", event.target.value)}
            >
              <option value="">All Activities</option>
              {activityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4 col-md-6">
            <label className="form-label">District</label>
            <select
              className="form-select premium-input"
              value={filters.district}
              onChange={(event) => {
                const nextDistrict = event.target.value;
                setFilters((prev) => ({
                  ...prev,
                  district: nextDistrict,
                  upazila: nextDistrict === prev.district ? prev.upazila : "",
                  union: ""
                }));
              }}
            >
              <option value="">All Districts</option>
              {districtOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4 col-md-6">
            <label className="form-label">Upazila</label>
            <select
              className="form-select premium-input"
              value={filters.upazila}
              onChange={(event) => {
                const nextUpazila = event.target.value;
                setFilters((prev) => ({
                  ...prev,
                  upazila: nextUpazila,
                  union: nextUpazila === prev.upazila ? prev.union : ""
                }));
              }}
            >
              <option value="">All Upazilas</option>
              {upazilaOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-lg-4 col-md-6">
            <label className="form-label">Union</label>
            <select
              className="form-select premium-input"
              value={filters.union}
              onChange={(event) => updateFilter("union", event.target.value)}
            >
              <option value="">All Unions</option>
              {unionOptions.map((item) => (
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
              onChange={(event) => updateFilter("dateFrom", event.target.value)}
            />
          </div>
          <div className="col-lg-2 col-md-6">
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-control premium-input"
              value={filters.dateTo}
              onChange={(event) => updateFilter("dateTo", event.target.value)}
            />
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-3">
          <p className="small text-muted mb-0">{filteredEntries.length} report row(s) matched the current filters.</p>
          <button className="outline-btn" type="button" onClick={() => setFilters(createFilters())}>
            <i className="bi bi-arrow-counterclockwise" /> Reset Filters
          </button>
        </div>
      </section>

      <section className="grid-kpi">
        <KpiCard label="Matched Activities" value={summary.totalActivities} icon="bi-clipboard-check" accent="green" />
        <KpiCard label="Participants" value={summary.totalParticipants} icon="bi-people" accent="blue" />
        <KpiCard label="Budget" value={formatCurrency(summary.totalBudget)} icon="bi-cash-stack" accent="amber" />
        <KpiCard label="Expenses" value={formatCurrency(summary.totalExpenses)} icon="bi-wallet2" accent="rose" />
      </section>

      <section className="report-summary-grid">
        <article className="panel-card report-summary-card">
          <p className="text-muted mb-2">Top Project</p>
          <h3 className="report-summary-value">{topProject}</h3>
          <small className="text-muted">Most repeated project in the filtered report set.</small>
        </article>
        <article className="panel-card report-summary-card">
          <p className="text-muted mb-2">Top Coverage Area</p>
          <h3 className="report-summary-value">{topLocation}</h3>
          <small className="text-muted">Most repeated district and upazila combination.</small>
        </article>
        <article className="panel-card report-summary-card">
          <p className="text-muted mb-2">Attachments</p>
          <h3 className="report-summary-value">{summary.totalAttachments}</h3>
          <small className="text-muted">Total files linked with the filtered activities.</small>
        </article>
      </section>

      <section className="table-responsive panel-card p-0 entries-table-wrap entries-desktop-table">
        <table className="table align-middle premium-table entries-table mb-0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Project</th>
              <th>Activity</th>
              <th>Location</th>
              <th>Participants</th>
              <th>Budget</th>
              <th>Expenses</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paginatedEntries.length ? (
              paginatedEntries.map((entry) => (
                <tr
                  key={entry.uniqueId}
                  className="entry-row-clickable"
                  onClick={() => openEntry(entry)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openEntry(entry);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="mono text-success fw-semibold">{entry.uniqueId}</td>
                  <td>{formatDate(entry.date)}</td>
                  <td>{entry.project}</td>
                  <td>
                    <p className="mb-0 fw-semibold text-truncate maxw-220">{entry.activityName}</p>
                    <small className="text-muted">{entry.activityCode}</small>
                  </td>
                  <td>
                    <p className="mb-0 fw-semibold">{entry.district}</p>
                    <small className="text-muted">
                      {entry.upazila} / {entry.union}
                    </small>
                  </td>
                  <td>
                    <p className="mb-0 fw-semibold">{entry.grandTotal}</p>
                    <small className="text-muted">
                      {entry.totalMale}M / {entry.totalFemale}F
                    </small>
                  </td>
                  <td>{formatCurrency(entry.totalBudget)}</td>
                  <td>{formatCurrency(entry.totalExpenses)}</td>
                  <td>
                    <StatusBadge status={entry.status} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9}>
                  <div className="empty-state-inline">
                    <i className="bi bi-file-earmark-bar-graph" />
                    <p className="mb-1 fw-semibold">No report rows found</p>
                    <small className="text-muted">Adjust the filter values and try again.</small>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="entries-mobile-list report-mobile-list">
        {paginatedEntries.length ? (
          paginatedEntries.map((entry) => (
            <article
              key={entry.uniqueId}
              className={clsx("entry-mobile-card report-mobile-card", `status-${entry.status.toLowerCase()}`)}
              onClick={() => openEntry(entry)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openEntry(entry);
                }
              }}
              tabIndex={0}
            >
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="min-w-0">
                  <p className="mono text-success fw-semibold mb-1">{entry.uniqueId}</p>
                  <p className="fw-semibold mb-1">{entry.activityName}</p>
                  <p className="text-muted mb-0">{entry.project}</p>
                </div>
                <StatusBadge status={entry.status} />
              </div>
              <div className="entry-mobile-meta">
                <span>Date: {formatDate(entry.date)}</span>
                <span>
                  Location: {entry.district}, {entry.upazila}, {entry.union}
                </span>
                <span>
                  Participants: {entry.grandTotal} ({entry.totalMale}M/{entry.totalFemale}F)
                </span>
                <span>
                  Budget: {formatCurrency(entry.totalBudget)} | Exp: {formatCurrency(entry.totalExpenses)}
                </span>
              </div>
              <button
                className="outline-btn w-100"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  openEntry(entry);
                }}
              >
                <i className="bi bi-eye" /> View Details
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state-inline panel-card">
            <i className="bi bi-file-earmark-bar-graph" />
            <p className="mb-1 fw-semibold">No report rows found</p>
            <small className="text-muted">Adjust the filter values and try again.</small>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav className="d-flex justify-content-center align-items-center gap-3" aria-label="Report pagination">
          <button
            className="outline-btn"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            <i className="bi bi-chevron-left" /> Previous
          </button>
          <span className="text-muted small">
            Page {page} of {totalPages}
          </span>
          <button
            className="outline-btn"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next <i className="bi bi-chevron-right" />
          </button>
        </nav>
      )}

      {selectedEntry && (
        <EntryDetailsModal
          entry={selectedEntry}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
