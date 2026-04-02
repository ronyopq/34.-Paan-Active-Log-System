"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-context";

export default function LoginPage() {
  const router = useRouter();
  const { login, notify } = useAppContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/activities/new");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setNextPath(query.get("next") || "/activities/new");
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const result = login(username, password);
    if (!result.ok) {
      const message = result.message || "Login failed";
      notify(message, "error");
      setLoading(false);
      return;
    }

    router.push(nextPath);
  };

  return (
    <div className="auth-card-wrap login-hero-wrap">
      <div className="auth-card login-card">
        <div className="login-card-glow" aria-hidden="true" />
        <div className="mb-4 text-center login-head">
          <div className="login-logo-badge">
            <i className="bi bi-stars" />
          </div>
          <p className="auth-eyebrow mb-2">PRAAN Activity Management System</p>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="text-muted mb-0">Sign in with your account to continue.</p>
        </div>

        <form onSubmit={onSubmit} className="d-grid gap-3">
          <div>
            <label className="form-label">Username</label>
            <input
              className="form-control premium-input login-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control premium-input login-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
            />
            <small className="text-muted">Use your account password.</small>
          </div>

          <button className="primary-btn w-100 login-submit-btn" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <p className="mt-3 mb-0 text-center text-muted">
          No account? <Link href="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
