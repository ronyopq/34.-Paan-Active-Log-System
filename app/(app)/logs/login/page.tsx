"use client";

import { useAppContext } from "@/components/providers/app-context";
import { formatDateTime } from "@/lib/format";

export default function LoginLogPage() {
  const { user, loginLogs } = useAppContext();
  const rows =
    user?.role === "Admin" || user?.role === "Manager"
      ? loginLogs
      : loginLogs.filter((log) => log.username.toLowerCase() === (user?.username || "").toLowerCase());

  const readableDate = (value: string) => {
    if (!value || value === "-") return "-";
    return formatDateTime(value);
  };

  return (
    <div className="d-grid gap-3">
      <section className="page-heading">
        <h1 className="page-title">Login Log</h1>
        <p className="page-subtitle">View login sessions with time, IP, device, and browser data.</p>
      </section>

      <section className="panel-card table-responsive p-0">
        <table className="table premium-table mb-0 align-middle">
          <thead>
            <tr>
              <th>Username</th>
              <th>Login</th>
              <th>Logout</th>
              <th>IP Address</th>
              <th>Device</th>
              <th>Browser</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((log, index) => (
              <tr key={index}>
                <td>{log.username}</td>
                <td>{readableDate(log.loginTime)}</td>
                <td>{readableDate(log.logoutTime)}</td>
                <td className="mono">{log.ipAddress}</td>
                <td>{log.device}</td>
                <td>{log.browser}</td>
                <td>
                  <span className={log.status === "Success" ? "text-success" : "text-danger"}>{log.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
