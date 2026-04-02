"use client";

import { useEffect, useState } from "react";
import { useAppContext } from "@/components/providers/app-context";

export default function ProfilePage() {
  const { user, users, setUsers, notify, addAuditLog } = useAppContext();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    title: "",
    password: ""
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName,
      email: user.email,
      title: user.title || "",
      password: user.password || "123456"
    });
  }, [user]);

  if (!user) return null;

  const saveProfile = () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      notify("Name and email are required.", "error");
      return;
    }

    const nextUsers = users.map((item) =>
      item.username === user.username
        ? {
            ...item,
            fullName: form.fullName.trim(),
            email: form.email.trim(),
            title: form.title.trim() || "Field Officer",
            password: form.password.trim() || item.password || "123456"
          }
        : item
    );

    setUsers(nextUsers);
    addAuditLog("Updated Own Profile", "Profile", `user:${user.username}`, "Updated name, email, designation and password");
    notify("Profile updated successfully.", "success");
  };

  return (
    <div className="d-grid gap-3">
      <section className="page-heading">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Update your account information and password.</p>
      </section>

      <section className="panel-card">
        <div className="row g-4">
          <div className="col-md-6">
            <label className="form-label">Full Name</label>
            <input
              className="form-control premium-input"
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
            />
            <label className="form-label mt-3">Username</label>
            <input className="form-control premium-input mono" value={user.username} readOnly />
            <label className="form-label mt-3">Email</label>
            <input
              type="email"
              className="form-control premium-input"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            />
            <label className="form-label mt-3">Designation</label>
            <input
              className="form-control premium-input"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Field Officer"
            />
            <label className="form-label mt-3">Password</label>
            <input
              type="text"
              className="form-control premium-input mono"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <button className="primary-btn mt-3" onClick={saveProfile}>
              <i className="bi bi-save" /> Save Profile
            </button>
          </div>
          <div className="col-md-6">
            <p className="text-muted mb-1">Role</p>
            <p className="fw-semibold">{user.role}</p>
            <p className="text-muted mb-1">Active</p>
            <p className="fw-semibold">{user.active ? "Yes" : "No"}</p>
            <p className="text-muted mb-1">Project Access</p>
            <div className="d-flex flex-wrap gap-2">
              {user.projects.map((project) => (
                <span className="soft-badge" key={project}>
                  {project}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
