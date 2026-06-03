"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ActivityEntry, ParticipantLine } from "@/lib/types";
import { getEntryAttachmentsWithDisplayNames } from "@/lib/attachments";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/common/status-badge";
import { 
  exportEntryDocxReport, 
  exportStandardPdf, 
  exportExecutivePdf, 
  exportPhotoPdf, 
  printEntryTextReport 
} from "@/lib/print-report";
import { downloadAttachment, getAttachmentPreviewSrc, openAttachment } from "@/lib/file-actions";
import { getFileIconClass } from "@/lib/file-icons";
import { LightboxViewer, LightboxFile } from "@/components/activities/lightbox-viewer";

type Props = {
  entry: ActivityEntry;
  onClose: () => void;
  canManage?: boolean;
  initialEditMode?: boolean;
  onUpdateEntry?: (id: string, updates: Partial<ActivityEntry>) => void;
  onDeleteEntry?: (id: string) => void;
  onRemoveAttachment?: (entryId: string, attachmentId: string) => void;
};

const toNumber = (value: string) => {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return Number(digits);
};

export const EntryDetailsModal = ({
  entry,
  onClose,
  canManage = false,
  initialEditMode = false,
  onUpdateEntry,
  onDeleteEntry,
  onRemoveAttachment
}: Props) => {
  const [draft, setDraft] = useState<ActivityEntry>(entry);
  const [editMode, setEditMode] = useState(initialEditMode);
  const [deletePanelOpen, setDeletePanelOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [lightboxFile, setLightboxFile] = useState<LightboxFile | null>(null);

  useEffect(() => {
    setDraft(entry);
    setEditMode(initialEditMode);
    setDeletePanelOpen(false);
    setDeleteConfirmText("");
  }, [entry, initialEditMode]);

  useEffect(() => {
    document.body.classList.add("entry-modal-open");
    return () => {
      document.body.classList.remove("entry-modal-open");
    };
  }, []);

  const participantRows = useMemo(
    () => (editMode ? draft.participants : draft.participants.filter((line) => line.male + line.female > 0)),
    [draft.participants, editMode]
  );

  const groupedFiles = useMemo(
    () =>
      getEntryAttachmentsWithDisplayNames(draft).reduce<Record<string, ActivityEntry["attachments"]>>((acc, file) => {
        if (!acc[file.category]) acc[file.category] = [];
        acc[file.category].push(file);
        return acc;
      }, {}),
    [draft]
  );

  const totals = useMemo(() => {
    const totalMale = draft.participants.reduce((sum, line) => sum + line.male, 0);
    const totalFemale = draft.participants.reduce((sum, line) => sum + line.female, 0);
    const grandTotal = totalMale + totalFemale;
    const variance = draft.totalBudget
      ? ((draft.totalBudget - draft.totalExpenses) / draft.totalBudget) * 100
      : 0;
    const utilization = draft.totalBudget ? (draft.totalExpenses / draft.totalBudget) * 100 : 0;
    return { totalMale, totalFemale, grandTotal, variance, utilization };
  }, [draft.participants, draft.totalBudget, draft.totalExpenses]);

  const updateParticipantValue = (row: ParticipantLine, field: "male" | "female", value: number) => {
    setDraft((prev) => ({
      ...prev,
      participants: prev.participants.map((line) =>
        line.categoryKey === row.categoryKey ? { ...line, [field]: Math.max(0, value) } : line
      )
    }));
  };

  const saveChanges = () => {
    if (!onUpdateEntry) return;

    onUpdateEntry(draft.uniqueId, {
      date: draft.date,
      project: draft.project,
      activityName: draft.activityName,
      activityType: draft.activityType,
      activityCode: draft.activityCode,
      venue: draft.venue,
      district: draft.district,
      upazila: draft.upazila,
      union: draft.union,
      implementedBy: draft.implementedBy,
      referenceLink: draft.referenceLink,
      notes: draft.notes,
      aiReport: draft.aiReport,
      participants: draft.participants,
      totalMale: totals.totalMale,
      totalFemale: totals.totalFemale,
      grandTotal: totals.grandTotal,
      totalBudget: draft.totalBudget,
      totalExpenses: draft.totalExpenses,
      variance: totals.variance
    });
    setEditMode(false);
  };

  const submitDelete = () => {
    if (!onDeleteEntry || deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
    onDeleteEntry(draft.uniqueId);
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="entry-modal-card">
        <header className="entry-modal-head">
          <div className="entry-head-main">
            <div className="d-flex gap-3 align-items-center mb-1">
              <span className="entry-id">{draft.uniqueId}</span>
              <StatusBadge status={draft.status} />
            </div>
            <h3 className="modal-title mb-1 entry-modal-title" title={draft.activityName}>
              {draft.activityName}
            </h3>
            <p className="text-muted mb-0">
              {draft.project} - {draft.activityType}
            </p>
          </div>

          <div className="entry-head-actions">
            <div className="dropdown">
              <button 
                className="outline-btn dropdown-toggle" 
                type="button" 
                id="exportPdfDropdown"
                data-bs-toggle="dropdown" 
                aria-expanded="false"
              >
                <i className="bi bi-file-earmark-pdf" /> Export PDF
              </button>
              <ul className="dropdown-menu shadow-sm" aria-labelledby="exportPdfDropdown">
                <li>
                  <button className="dropdown-item" onClick={() => exportStandardPdf(draft)}>
                    <i className="bi bi-file-earmark-pdf text-primary me-2" /> Standard Formal
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => exportExecutivePdf(draft)}>
                    <i className="bi bi-file-earmark-pdf text-success me-2" /> Executive Detail
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => exportPhotoPdf(draft)}>
                    <i className="bi bi-images text-danger me-2" /> Photo Highlight (4 Photos)
                  </button>
                </li>
              </ul>
            </div>

            <button className="outline-btn" onClick={() => exportEntryDocxReport(draft)}>
              <i className="bi bi-file-earmark-word" /> Export DOCX
            </button>
            <button className="outline-btn" onClick={() => printEntryTextReport(draft)}>
              <i className="bi bi-printer" /> Print Text
            </button>
            {canManage && onUpdateEntry && (
              <button
                className={clsx("outline-btn", editMode && "active")}
                onClick={() => {
                  if (editMode) {
                    setDraft(entry);
                  }
                  setEditMode((prev) => !prev);
                }}
              >
                <i className={`bi ${editMode ? "bi-x-circle" : "bi-pencil-square"}`} />
                {editMode ? "Cancel Edit" : "Edit"}
              </button>
            )}
            {canManage && onUpdateEntry && editMode && (
              <button className="primary-btn" onClick={saveChanges}>
                <i className="bi bi-save" /> Save Changes
              </button>
            )}
            {canManage && onDeleteEntry && (
              <button
                className="danger-outline"
                onClick={() => {
                  setDeletePanelOpen((prev) => !prev);
                  setDeleteConfirmText("");
                }}
              >
                <i className="bi bi-trash" /> Delete
              </button>
            )}
          </div>
          <button className="icon-btn entry-head-close" onClick={onClose} aria-label="Close details">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        {deletePanelOpen && (
          <section className="entry-delete-panel">
            <p className="mb-2 fw-semibold text-danger">
              Warning: this entry will be permanently deleted.
            </p>
            <p className="small text-muted mb-2">
              To confirm, type <strong>DELETE</strong> in the textbox below.
            </p>
            <div className="entry-delete-actions">
              <input
                className="form-control premium-input"
                value={deleteConfirmText}
                onChange={(event) => setDeleteConfirmText(event.target.value)}
                placeholder="Type DELETE"
              />
              <button className="danger-outline" onClick={submitDelete} disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE"}>
                <i className="bi bi-trash3" /> Confirm Delete
              </button>
            </div>
          </section>
        )}

        <section className="entry-modal-body">
          <article className="entry-report-sheet">
            <section className="entry-report-section">
              <h4 className="entry-report-title">1. Activity Overview</h4>
              <div className="entry-report-grid">
                <article className="entry-kv-card">
                  <p>Date</p>
                  {editMode ? (
                    <input
                      type="date"
                      className="form-control premium-input"
                      value={draft.date}
                      onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
                    />
                  ) : (
                    <strong>{formatDate(draft.date)}</strong>
                  )}
                </article>
                <article className="entry-kv-card">
                  <p>Activity Type</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={draft.activityType}
                      onChange={(event) => setDraft((prev) => ({ ...prev, activityType: event.target.value }))}
                    />
                  ) : (
                    <strong>{draft.activityType}</strong>
                  )}
                </article>
                <article className="entry-kv-card">
                  <p>Activity Code</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={draft.activityCode}
                      onChange={(event) => setDraft((prev) => ({ ...prev, activityCode: event.target.value }))}
                    />
                  ) : (
                    <strong>{draft.activityCode}</strong>
                  )}
                </article>
                <article className="entry-kv-card">
                  <p>Venue</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={draft.venue}
                      onChange={(event) => setDraft((prev) => ({ ...prev, venue: event.target.value }))}
                    />
                  ) : (
                    <strong>{draft.venue}</strong>
                  )}
                </article>
                <article className="entry-kv-card">
                  <p>Implemented By</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={draft.implementedBy}
                      onChange={(event) => setDraft((prev) => ({ ...prev, implementedBy: event.target.value }))}
                    />
                  ) : (
                    <strong>{draft.implementedBy}</strong>
                  )}
                </article>
                <article className="entry-kv-card">
                  <p>Submitted By</p>
                  <strong>{draft.createdBy}</strong>
                </article>
                <article className="entry-kv-card entry-kv-full">
                  <p>Location</p>
                  {editMode ? (
                    <div className="entry-location-edit-grid">
                      <input
                        className="form-control premium-input"
                        value={draft.district}
                        onChange={(event) => setDraft((prev) => ({ ...prev, district: event.target.value }))}
                        placeholder="District"
                      />
                      <input
                        className="form-control premium-input"
                        value={draft.upazila}
                        onChange={(event) => setDraft((prev) => ({ ...prev, upazila: event.target.value }))}
                        placeholder="Upazila"
                      />
                      <input
                        className="form-control premium-input"
                        value={draft.union}
                        onChange={(event) => setDraft((prev) => ({ ...prev, union: event.target.value }))}
                        placeholder="Union"
                      />
                    </div>
                  ) : (
                    <strong>
                      {draft.district} {" -> "} {draft.upazila} {" -> "} {draft.union}
                    </strong>
                  )}
                </article>
                <article className="entry-kv-card entry-kv-full">
                  <p>Reference Link</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={draft.referenceLink}
                      onChange={(event) => setDraft((prev) => ({ ...prev, referenceLink: event.target.value }))}
                    />
                  ) : (
                    <strong>{draft.referenceLink || "-"}</strong>
                  )}
                </article>
              </div>
              <div className="entry-text-grid mt-3">
                <div>
                  <p className="entry-report-label">Notes</p>
                  <textarea
                    className="form-control premium-input notes-preview-textarea"
                    value={draft.notes || "-"}
                    rows={4}
                    readOnly={!editMode}
                    onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>
                <div>
                  <p className="entry-report-label">AI Narrative</p>
                  <textarea
                    className="form-control premium-input notes-preview-textarea"
                    value={draft.aiReport || "-"}
                    rows={4}
                    readOnly={!editMode}
                    onChange={(event) => setDraft((prev) => ({ ...prev, aiReport: event.target.value }))}
                  />
                </div>
              </div>
            </section>

            <section className="entry-report-section">
              <h4 className="entry-report-title">2. Participants</h4>
              <div className="entry-stats-grid">
                <article className="entry-stat">
                  <p>Total</p>
                  <strong>{totals.grandTotal}</strong>
                </article>
                <article className="entry-stat">
                  <p>Male</p>
                  <strong>{totals.totalMale}</strong>
                </article>
                <article className="entry-stat">
                  <p>Female</p>
                  <strong>{totals.totalFemale}</strong>
                </article>
              </div>
              <div className="table-responsive mt-3">
                <table className="table align-middle mb-0 premium-table small">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Male</th>
                      <th>Female</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-muted">
                          No participant rows with value greater than zero.
                        </td>
                      </tr>
                    )}
                    {participantRows.map((line) => (
                      <tr key={line.categoryKey}>
                        <td>{line.categoryLabel}</td>
                        <td>
                          {editMode ? (
                            <input
                              type="number"
                              min={0}
                              className="form-control premium-input"
                              value={line.male}
                              onChange={(event) => updateParticipantValue(line, "male", Number(event.target.value || 0))}
                            />
                          ) : (
                            line.male
                          )}
                        </td>
                        <td>
                          {editMode ? (
                            <input
                              type="number"
                              min={0}
                              className="form-control premium-input"
                              value={line.female}
                              onChange={(event) =>
                                updateParticipantValue(line, "female", Number(event.target.value || 0))
                              }
                            />
                          ) : (
                            line.female
                          )}
                        </td>
                        <td>{line.male + line.female}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="entry-report-section">
              <h4 className="entry-report-title">3. Financial</h4>
              <div className="entry-stats-grid">
                <article className="entry-stat">
                  <p>Budget</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={String(draft.totalBudget)}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, totalBudget: toNumber(event.target.value) }))
                      }
                    />
                  ) : (
                    <strong>{formatCurrency(draft.totalBudget)}</strong>
                  )}
                </article>
                <article className="entry-stat">
                  <p>Expenses</p>
                  {editMode ? (
                    <input
                      className="form-control premium-input"
                      value={String(draft.totalExpenses)}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, totalExpenses: toNumber(event.target.value) }))
                      }
                    />
                  ) : (
                    <strong>{formatCurrency(draft.totalExpenses)}</strong>
                  )}
                </article>
                <article className="entry-stat">
                  <p>Variance</p>
                  <strong className={clsx(totals.variance < 0 ? "text-danger" : "text-success")}>
                    {totals.variance.toFixed(1)}%
                  </strong>
                </article>
              </div>
              <div className="entry-utilization mt-3">
                <div className="d-flex justify-content-between small mb-2">
                  <span>Budget Utilization</span>
                  <strong>{totals.utilization.toFixed(1)}%</strong>
                </div>
                <div className="progress premium-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={clsx("progress-bar", totals.utilization > 100 ? "bg-danger" : "bg-success")}
                    style={{ width: `${Math.min(100, totals.utilization)}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="entry-report-section">
              <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <h4 className="entry-report-title mb-0">4. Files & Attachments</h4>
              </div>
              {draft.attachments.length === 0 && <p className="text-muted mb-0">No attachments uploaded.</p>}
              <div className="d-grid gap-3">
                {Object.entries(groupedFiles).map(([category, files]) => (
                  <article key={category} className="entry-file-group">
                    <div className="entry-file-group-head">
                      <strong>{category}</strong>
                      <span className="soft-badge">{files.length} file(s)</span>
                    </div>
                    <div className="entry-file-list entry-file-list-compact">
                      {files.map((file) => (
                        <article key={file.id} className="attachment-item entry-attachment-card">
                          <div className="entry-file-preview-box" style={{ cursor: file.type === "image" ? "pointer" : undefined }} onClick={file.type === "image" ? () => setLightboxFile({
                            id: file.id,
                            name: file.name,
                            type: file.type,
                            url: file.url,
                            previewSrc: getAttachmentPreviewSrc(file),
                            sizeKb: file.sizeKb,
                            category: file.category,
                            entryId: draft.uniqueId,
                          }) : undefined}>
                            {file.type === "image" ? (
                              <Image src={getAttachmentPreviewSrc(file)} alt={file.name} fill className="object-contain" />
                            ) : (
                              <i className={`bi ${getFileIconClass(file.name)} file-type-icon-xl`} />
                            )}
                          </div>
                          <div className="entry-file-meta">
                            <p className="mb-1 fw-semibold entry-file-name" title={file.name}>
                              {file.name}
                            </p>
                            <small className="text-muted d-block">{file.sizeKb} KB</small>
                            <small className="text-muted">{file.category}</small>
                          </div>
                          <div className="entry-file-actions">
                            <button
                              className="outline-btn"
                              onClick={() => openAttachment(file)}
                              aria-label="Preview file"
                            >
                              <i className="bi bi-eye" /> Preview
                            </button>
                            <button
                              className="outline-btn"
                              onClick={() => openAttachment(file)}
                              aria-label="Open file"
                            >
                              <i className="bi bi-box-arrow-up-right" /> Open
                            </button>
                            <button
                              className="primary-btn"
                              onClick={() => downloadAttachment(file)}
                              aria-label="Download file"
                            >
                              <i className="bi bi-download" /> Download
                            </button>
                            {canManage && editMode && onRemoveAttachment && (
                              <button
                                className="danger-outline"
                                onClick={() => onRemoveAttachment(draft.uniqueId, file.id)}
                                aria-label="Remove file"
                              >
                                <i className="bi bi-trash" /> Delete
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </article>
        </section>

        <footer className="entry-modal-footer">
          <small className="text-muted">
            Submitted: {draft.submittedAt ? formatDateTime(draft.submittedAt) : "Not submitted"} | Print mode: text report
          </small>
          <button className="outline-btn" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>

      {lightboxFile && (
        <LightboxViewer
          file={lightboxFile}
          files={getEntryAttachmentsWithDisplayNames(draft).map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            url: f.url,
            previewSrc: getAttachmentPreviewSrc(f),
            sizeKb: f.sizeKb,
            category: f.category,
            entryId: draft.uniqueId,
          }))}
          onClose={() => setLightboxFile(null)}
        />
      )}
    </div>
  );
};
