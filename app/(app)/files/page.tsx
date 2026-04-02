"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/components/providers/app-context";
import { formatDate, normalizeText } from "@/lib/format";
import { downloadAttachment, getAttachmentPreviewSrc, openAttachment } from "@/lib/file-actions";
import { getFileIconClass } from "@/lib/file-icons";
import { ActivityAttachment } from "@/lib/types";

type FileWithContext = ActivityAttachment & {
  entryId: string;
  date: string;
  project: string;
  activity: string;
};

export default function FilesPage() {
  const { visibleEntries, user, removeAttachmentFromEntry, addAuditLog, notify } = useAppContext();
  const [query, setQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<FileWithContext | null>(null);

  const isAdmin = user?.role === "Admin";

  const files = useMemo(() => {
    const list = visibleEntries.flatMap((entry) =>
      entry.attachments.map((file) => ({
        ...file,
        entryId: entry.uniqueId,
        date: entry.date,
        project: entry.project,
        activity: entry.activityName
      }))
    );

    const needle = normalizeText(query);
    return list.filter((file) =>
      !needle
        ? true
        : normalizeText(`${file.name} ${file.category} ${file.entryId} ${file.project} - ${file.activity}`).includes(
            needle
          )
    );
  }, [visibleEntries, query]);

  return (
    <div className="d-grid gap-3">
      <section className="page-heading">
        <h1 className="page-title">Files</h1>
        <p className="page-subtitle">Search and access all activity files based on your role permissions.</p>
      </section>

      <section className="panel-card">
        <div className="input-icon">
          <i className="bi bi-search" />
          <input
            className="form-control premium-input"
            placeholder="Search by date, project, activity, category, entry ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <section className="file-library-grid file-library-grid-wide">
        {files.map((file) => (
          <article key={file.id + file.entryId} className="panel-card file-library-card">
            <div className="file-library-thumb">
              {file.type === "image" ? (
                <Image src={getAttachmentPreviewSrc(file)} alt={file.name} fill className="object-contain" />
              ) : (
                <i className={`bi ${getFileIconClass(file.name)} file-type-icon-xxl`} />
              )}
            </div>

            <div className="file-library-body">
              <div className="file-library-head">
                <div className="min-w-0">
                  <p className="mb-1 fw-semibold file-library-title" title={file.name}>
                    {file.name}
                  </p>
                  <small className="text-muted d-block">{file.category}</small>
                  <small className="text-muted d-block">
                    {file.entryId} - {formatDate(file.date)}
                  </small>
                  <small className="text-muted d-block text-truncate">
                    {file.project} - {file.activity}
                  </small>
                </div>
                <span className="soft-badge">{Math.max(1, file.sizeKb)} KB</span>
              </div>

              <div className="file-library-actions">
                <button className="outline-btn" onClick={() => setPreviewFile(file)}>
                  <i className="bi bi-eye" /> Preview
                </button>
                <button className="outline-btn" onClick={() => openAttachment(file)}>
                  <i className="bi bi-box-arrow-up-right" /> Open
                </button>
                <button className="primary-btn" onClick={() => downloadAttachment(file)}>
                  <i className="bi bi-download" /> Download
                </button>
                {isAdmin && (
                  <button
                    className="danger-outline"
                    onClick={() => {
                      removeAttachmentFromEntry(file.entryId, file.id);
                      addAuditLog("Deleted File", "Files", file.entryId, `Removed attachment: ${file.name}`);
                      notify(`Attachment deleted: ${file.name}`, "success");
                      if (previewFile?.id === file.id && previewFile.entryId === file.entryId) {
                        setPreviewFile(null);
                      }
                    }}
                  >
                    <i className="bi bi-trash" /> Delete
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      {previewFile && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="panel-card file-preview-modal">
            <div className="file-preview-head mb-3">
              <div className="min-w-0">
                <h3 className="h5 mb-1 file-preview-title" title={previewFile.name}>
                  {previewFile.name}
                </h3>
                <p className="text-muted mb-0">
                  {previewFile.category} - {previewFile.entryId}
                </p>
              </div>
              <button className="icon-btn" onClick={() => setPreviewFile(null)} aria-label="Close preview">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="file-preview-stage">
              {previewFile.type === "image" ? (
                <Image src={getAttachmentPreviewSrc(previewFile)} alt={previewFile.name} fill className="object-contain" />
              ) : (
                <div className="file-preview-doc">
                  <i className={`bi ${getFileIconClass(previewFile.name)} file-type-icon-xxl`} />
                  <p className="mb-0 mt-2">Preview is not available for this file type in-browser.</p>
                </div>
              )}
            </div>

            <div className="d-flex gap-2 justify-content-end mt-3">
              <button className="outline-btn" onClick={() => openAttachment(previewFile)}>
                <i className="bi bi-box-arrow-up-right" /> Open
              </button>
              <button className="primary-btn" onClick={() => downloadAttachment(previewFile)}>
                <i className="bi bi-download" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
