"use client";

import { useState } from "react";
import { useAppContext } from "@/components/providers/app-context";
import { formatDateTime } from "@/lib/format";

type FilterTab = "all" | "unread" | "read";

export default function NotificationsPage() {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    user
  } = useAppContext();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (user?.role === "User") {
    return (
      <section className="panel-card">
        <h1 className="page-title h3 mb-2">Notifications</h1>
        <p className="mb-0 text-muted">Notifications are available for Manager and Admin roles.</p>
      </section>
    );
  }

  const unreadCount = notifications.filter((n) => n.unread).length;

  const filtered = notifications.filter((n) => {
    if (filterTab === "unread") return n.unread;
    if (filterTab === "read") return !n.unread;
    return true;
  });

  const handleClearAll = () => {
    clearAllNotifications();
    setShowClearConfirm(false);
  };

  return (
    <div className="d-grid gap-3">
      <section className="page-heading d-flex justify-content-between align-items-start flex-wrap gap-3">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "No unread notifications"}
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button className="outline-btn" onClick={markAllNotificationsRead}>
              <i className="bi bi-check2-all" /> Mark All Read
            </button>
          )}
          {notifications.length > 0 && (
            <button className="danger-outline" onClick={() => setShowClearConfirm(true)}>
              <i className="bi bi-trash3" /> Clear All
            </button>
          )}
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="notif-filter-bar">
          {(["all", "unread", "read"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              className={`notif-filter-btn ${filterTab === tab ? "active" : ""}`}
              onClick={() => setFilterTab(tab)}
            >
              {tab === "all" && "All"}
              {tab === "unread" && `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
              {tab === "read" && `Read (${notifications.length - unreadCount})`}
            </button>
          ))}
        </section>
      )}

      <section className="d-grid gap-2">
        {filtered.length > 0 ? (
          filtered.map((note) => (
            <article
              key={note.id}
              className={`panel-card notif-card ${note.unread ? "unread-note" : ""}`}
            >
              <div className="notif-card-body">
                <div className="notif-card-content">
                  <div className="d-flex align-items-start gap-2 mb-1">
                    {note.unread && <span className="notif-unread-dot" />}
                    <h3 className="notif-card-title">{note.title}</h3>
                  </div>
                  <p className="notif-card-summary">{note.summary}</p>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <small className="text-muted">
                      <i className="bi bi-clock" /> {formatDateTime(note.at)}
                    </small>
                    {note.entryId && (
                      <small className="text-muted mono">
                        <i className="bi bi-box" /> {note.entryId}
                      </small>
                    )}
                  </div>
                </div>
                <div className="notif-card-actions">
                  {note.unread && (
                    <button
                      className="icon-btn notif-action-btn"
                      onClick={() => markNotificationRead(note.id)}
                      title="Mark as read"
                    >
                      <i className="bi bi-check2" />
                    </button>
                  )}
                  <button
                    className="icon-btn notif-action-btn notif-delete-btn"
                    onClick={() => deleteNotification(note.id)}
                    title="Delete notification"
                  >
                    <i className="bi bi-x" />
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="panel-card notif-empty">
            <i className="bi bi-bell-slash" />
            <p className="fw-semibold mb-1">
              {filterTab === "all"
                ? "No notifications yet"
                : filterTab === "unread"
                  ? "No unread notifications"
                  : "No read notifications"}
            </p>
            <small className="text-muted">
              {filterTab !== "all" && "Switch to All to see more."}
            </small>
          </div>
        )}
      </section>

      {showClearConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="panel-card notif-confirm-card">
            <h3 className="h5 mb-2">Clear All Notifications?</h3>
            <p className="text-muted mb-3">
              This will permanently remove all {notifications.length} notification{notifications.length > 1 ? "s" : ""}. This action cannot be undone.
            </p>
            <div className="d-flex gap-2 justify-content-end">
              <button className="outline-btn" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </button>
              <button className="danger-outline" onClick={handleClearAll}>
                <i className="bi bi-trash3" /> Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
