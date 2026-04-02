"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EntryDetailsModal } from "@/components/activities/entry-details-modal";
import { KpiCard } from "@/components/common/kpi-card";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { useAppContext } from "@/components/providers/app-context";
import { formatCurrency, formatDate, normalizeText } from "@/lib/format";
import { ActivityEntry } from "@/lib/types";

const PAGE_SIZE = 9;

export default function ActivitiesPage() {
  const router = useRouter();
  const {
    visibleEntries,
    user,
    deleteEntry,
    removeAttachmentFromEntry,
    notify,
    addAuditLog
  } = useAppContext();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("All Projects");
  const [activityType, setActivityType] = useState("All Types");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityEntry | null>(null);
  const [deleteText, setDeleteText] = useState("");

  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    const openId = searchParams.get("entry");
    if (openId) {
      setSelectedId(openId);
    }
  }, [searchParams]);

  const projects = useMemo(
    () => ["All Projects", ...Array.from(new Set(visibleEntries.map((entry) => entry.project)))],
    [visibleEntries]
  );

  const activityTypes = useMemo(
    () => ["All Types", ...Array.from(new Set(visibleEntries.map((entry) => entry.activityType)))],
    [visibleEntries]
  );

  const filtered = useMemo(() => {
    const needle = normalizeText(query);

    return visibleEntries.filter((entry) => {
      const matchProject = project === "All Projects" || entry.project === project;
      const matchType = activityType === "All Types" || entry.activityType === activityType;
      const text = normalizeText(
        `${entry.uniqueId} ${entry.activityName} ${entry.project} ${entry.district} ${entry.upazila} ${entry.createdBy}`
      );
      const matchText = !needle || text.includes(needle);

      return matchProject && matchType && matchText;
    });
  }, [visibleEntries, project, activityType, query]);

  const totalParticipants = filtered.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const totalBudget = filtered.reduce((sum, entry) => sum + entry.totalBudget, 0);
  const selectedEntry = visibleEntries.find((entry) => entry.uniqueId === selectedId) || null;

  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedRows = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const exportCsv = () => {
    const header = [
      "ID",
      "Activity",
      "Project",
      "Date",
      "Location",
      "Participants",
      "Budget",
      "Status",
      "Submitted By"
    ];

    const rows = filtered.map((entry) => [
      entry.uniqueId,
      entry.activityName,
      entry.project,
      formatDate(entry.date),
      `${entry.district}, ${entry.upazila}`,
      String(entry.grandTotal),
      String(entry.totalBudget),
      entry.status,
      entry.createdBy
    ]);

    const csv = [header, ...rows].map((line) => line.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "activities.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const requestDelete = (entry: ActivityEntry) => {
    setDeleteTarget(entry);
    setDeleteText("");
  };

  const confirmDelete = () => {
    if (!deleteTarget || deleteText.trim().toUpperCase() !== "DELETE") return;
    deleteEntry(deleteTarget.uniqueId);
    addAuditLog("Deleted Entry", "My Activity", deleteTarget.uniqueId, "Deleted by admin confirmation");
    notify(`Entry deleted: ${deleteTarget.uniqueId}`, "success");
    setDeleteTarget(null);
    setDeleteText("");
    if (selectedId === deleteTarget.uniqueId) {
      setSelectedId(null);
    }
  };

  return (
    <div className="d-grid gap-3">
      <section className="page-heading d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1 className="page-title">My Activity</h1>
          <p className="page-subtitle">
            {user?.role === "User"
              ? "Review and manage your submitted activities"
              : "Review and manage all logged field activities"}
          </p>
        </div>
        <div className="d-flex gap-2 align-items-center page-actions">
          <button className="primary-btn" onClick={exportCsv}>
            <i className="bi bi-download" /> Export CSV
          </button>
        </div>
      </section>

      <section className="grid-kpi">
        <KpiCard label="Total Entries" value={filtered.length} icon="bi-clipboard" accent="green" />
        <KpiCard label="Total Participants" value={totalParticipants} icon="bi-people" accent="blue" />
        <KpiCard label="Total Budget (BDT)" value={formatCurrency(totalBudget)} icon="bi-coin" accent="amber" />
        <KpiCard
          label="Projects"
          value={new Set(filtered.map((entry) => entry.project)).size}
          icon="bi-folder"
          accent="rose"
        />
      </section>

      <section className="panel-card">
        <div className="row g-2 align-items-center">
          <div className="col-lg-8">
            <div className="input-icon">
              <i className="bi bi-search" />
              <input
                className="form-control premium-input"
                placeholder="Search by ID, activity, district..."
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="col-lg-2">
            <select
              className="form-select premium-input"
              value={project}
              onChange={(event) => {
                setProject(event.target.value);
                setPage(1);
              }}
            >
              {projects.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="col-lg-2">
            <select
              className="form-select premium-input"
              value={activityType}
              onChange={(event) => {
                setActivityType(event.target.value);
                setPage(1);
              }}
            >
              {activityTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="small text-muted mt-3 mb-0">{filtered.length} results found</p>
      </section>

      <section className="table-responsive panel-card p-0 entries-table-wrap entries-desktop-table">
        <table className="table align-middle premium-table entries-table mb-0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Activity</th>
              <th>Project</th>
              <th>Date</th>
              <th>Location</th>
              <th>Participants</th>
              <th>Budget</th>
              <th>Status</th>
              <th>Submitted By</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((entry) => (
              <tr
                key={entry.uniqueId}
                className="entry-row-clickable"
                onClick={() => {
                  setSelectedId(entry.uniqueId);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(entry.uniqueId);
                  }
                }}
                tabIndex={0}
              >
                <td className="mono text-success fw-semibold">{entry.uniqueId}</td>
                <td>
                  <p className="mb-0 fw-semibold text-truncate maxw-220">{entry.activityName}</p>
                  <small className="text-muted">{entry.activityType}</small>
                </td>
                <td className="text-truncate maxw-220">{entry.project}</td>
                <td>{formatDate(entry.date)}</td>
                <td>
                  <p className="mb-0 fw-semibold">{entry.district}</p>
                  <small className="text-muted">{entry.upazila}</small>
                </td>
                <td>
                  <p className="mb-0 fw-semibold">{entry.grandTotal}</p>
                  <small className="text-muted">
                    ({entry.totalMale}M/{entry.totalFemale}F)
                  </small>
                </td>
                <td>
                  <p className="mb-0 fw-semibold">{formatCurrency(entry.totalBudget)}</p>
                  <small className="text-muted">Exp: {formatCurrency(entry.totalExpenses)}</small>
                </td>
                <td>
                  <StatusBadge status={entry.status} />
                </td>
                <td>{entry.createdBy}</td>
                <td className="text-end">
                  <div className="d-flex gap-2 justify-content-end">
                    <button
                      className="icon-btn"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedId(entry.uniqueId);
                      }}
                      aria-label="Open details"
                    >
                      <i className="bi bi-eye" />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          className="icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/activities/new?edit=${encodeURIComponent(entry.uniqueId)}`);
                          }}
                          aria-label="Edit entry"
                        >
                          <i className="bi bi-pencil-square" />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            requestDelete(entry);
                          }}
                          aria-label="Delete entry"
                        >
                          <i className="bi bi-trash" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="entries-mobile-list">
        {pagedRows.map((entry) => (
          <article
            key={entry.uniqueId}
            className="entry-mobile-card"
            onClick={() => {
              setSelectedId(entry.uniqueId);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedId(entry.uniqueId);
              }
            }}
            tabIndex={0}
          >
            <div className="d-flex justify-content-between align-items-start gap-2">
              <div>
                <p className="mono text-success fw-semibold mb-1">{entry.uniqueId}</p>
                <p className="fw-semibold mb-1">{entry.activityName}</p>
                <p className="text-muted mb-0">{entry.activityType}</p>
              </div>
              <StatusBadge status={entry.status} />
            </div>
            <div className="entry-mobile-meta">
              <span>Project: {entry.project}</span>
              <span>Date: {formatDate(entry.date)}</span>
              <span>
                Location: {entry.district}, {entry.upazila}
              </span>
              <span>
                Participants: {entry.grandTotal} ({entry.totalMale}M/{entry.totalFemale}F)
              </span>
              <span>
                Budget: {formatCurrency(entry.totalBudget)} | Exp: {formatCurrency(entry.totalExpenses)}
              </span>
              <span>Submitted By: {entry.createdBy}</span>
            </div>
            <div className="d-flex gap-2 mt-2">
              <button
                className="outline-btn flex-fill"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(entry.uniqueId);
                }}
              >
                <i className="bi bi-eye" /> View
              </button>
              {isAdmin && (
                <>
                  <button
                    className="outline-btn flex-fill"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/activities/new?edit=${encodeURIComponent(entry.uniqueId)}`);
                    }}
                  >
                    <i className="bi bi-pencil-square" /> Edit
                  </button>
                  <button
                    className="danger-outline flex-fill"
                    onClick={(event) => {
                      event.stopPropagation();
                      requestDelete(entry);
                    }}
                  >
                    <i className="bi bi-trash" /> Delete
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </section>

      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {selectedEntry && (
        <EntryDetailsModal
          entry={selectedEntry}
          onClose={() => {
            setSelectedId(null);
          }}
          canManage={isAdmin}
          onDeleteEntry={(id) => {
            deleteEntry(id);
            addAuditLog("Deleted Entry", "My Activity", id, "Entry deleted from preview dialog");
            notify(`Entry deleted: ${id}`, "success");
          }}
          onRemoveAttachment={(entryId, attachmentId) => {
            removeAttachmentFromEntry(entryId, attachmentId);
            addAuditLog("Deleted Attachment", "My Activity", entryId, `Attachment removed: ${attachmentId}`);
            notify("Attachment removed.", "success");
          }}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="panel-card delete-confirm-card">
            <h3 className="h5 mb-2">Delete Entry</h3>
            <p className="mb-2 text-danger fw-semibold">
              Warning: {deleteTarget.uniqueId} will be permanently deleted.
            </p>
            <p className="small text-muted mb-2">
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              className="form-control premium-input mb-3"
              placeholder="Type DELETE"
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
            />
            <div className="d-flex gap-2 justify-content-end">
              <button className="outline-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="danger-outline" onClick={confirmDelete} disabled={deleteText.trim().toUpperCase() !== "DELETE"}>
                <i className="bi bi-trash3" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
