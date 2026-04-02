"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-context";

export default function RegisterPage() {
  const { register, projectMap, notify } = useAppContext();
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    project: "",
    password: "",
    confirm: ""
  });

  useEffect(() => {
    if (!form.project && projectMap[0]?.project) {
      setForm((prev) => ({ ...prev, project: projectMap[0].project }));
    }
  }, [form.project, projectMap]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      const message = "Passwords do not match";
      notify(message, "error");
      return;
    }

    const result = register({
      fullName: form.fullName,
      username: form.username,
      email: form.email,
      project: form.project,
      password: form.password
    });

    if (!result.ok) {
      const message = result.message || "Registration failed";
      notify(message, "error");
      return;
    }

    notify("Registration successful. Redirecting to new activity entry...", "success");
    router.push("/activities/new");
  };

  return (
    <div className="auth-card-wrap">
      <div className="auth-card wide">
        <div className="mb-4 text-center">
          <p className="auth-eyebrow mb-2">PRAAN Activity Management System</p>
          <h1 className="auth-title">Create Account</h1>
          <p className="text-muted mb-0">Register as a field user. Admin can update role later.</p>
        </div>

        <form onSubmit={onSubmit} className="d-grid gap-3">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Full Name</label>
              <input
                className="form-control premium-input"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Username</label>
              <input
                className="form-control premium-input"
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control premium-input"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
                <label className="form-label">Project</label>
                <select
                  className="form-select premium-input"
                  value={form.project}
                  onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))}
                >
                  {!projectMap.length && <option value="">No project available</option>}
                  {projectMap.map((item) => (
                    <option key={item.project} value={item.project}>
                      {item.project}
                    </option>
                  ))}
                </select>
              </div>
            <div className="col-md-6">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control premium-input"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control premium-input"
                value={form.confirm}
                onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
                required
              />
            </div>
          </div>

          <button className="primary-btn w-100">Create Account</button>
        </form>

        <p className="mt-3 mb-0 text-center text-muted">
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
