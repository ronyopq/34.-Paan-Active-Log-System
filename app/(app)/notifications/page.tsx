"use client";

import { useAppContext } from "@/components/providers/app-context";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const { notifications, markNotificationRead, user } = useAppContext();

  if (user?.role === "User") {
    return (
      <section className="panel-card">
        <h1 className="page-title h3 mb-2">Notifications</h1>
        <p className="mb-0 text-muted">Notifications are available for Manager and Admin roles.</p>
      </section>
    );
  }

  return (
    <div className="d-grid gap-3">
      <section className="page-heading">
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Recent submissions and review updates.</p>
      </section>

      <section className="d-grid gap-2">
        {notifications.map((note) => (
          <article key={note.id} className={`panel-card ${note.unread ? "unread-note" : ""}`}>
            <div className="d-flex justify-content-between gap-3">
              <div>
                <h3 className="h6 mb-1">{note.title}</h3>
                <p className="mb-1">{note.summary}</p>
                <small className="text-muted">{formatDateTime(note.at)}</small>
              </div>
              {note.unread && (
                <button className="outline-btn h-fit" onClick={() => markNotificationRead(note.id)}>
                  Mark read
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}