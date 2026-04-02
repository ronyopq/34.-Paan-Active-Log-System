"use client";

import { useAppContext } from "@/components/providers/app-context";
import { formatDateTime } from "@/lib/format";

export default function UserLogPage() {
  const { user, auditLogs } = useAppContext();

  if (user?.role === "User") {
    return (
      <section className="panel-card">
        <h1 className="page-title h3 mb-2">User Log</h1>
        <p className="mb-0 text-muted">This page is available for Manager and Admin roles.</p>
      </section>
    );
  }

  return (
    <div className="d-grid gap-3">
      <section className="page-heading">
        <h1 className="page-title">User Log</h1>
        <p className="page-subtitle">Audit trail of admin and manager actions.</p>
      </section>

      <section className="panel-card table-responsive p-0">
        <table className="table premium-table mb-0 align-middle">
          <thead>
            <tr>
              <th>Actor</th>
              <th>Role</th>
              <th>Action</th>
              <th>Module</th>
              <th>Target</th>
              <th>Device</th>
              <th>Browser</th>
              <th>Timestamp</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log, index) => (
              <tr key={index}>
                <td>{log.actor}</td>
                <td>{log.role}</td>
                <td>{log.action}</td>
                <td>{log.module}</td>
                <td className="mono">{log.targetId}</td>
                <td>{log.device}</td>
                <td>{log.browser}</td>
                <td>{formatDateTime(log.timestamp)}</td>
                <td>{log.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
