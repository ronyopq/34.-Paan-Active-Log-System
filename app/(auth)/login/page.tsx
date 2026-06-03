"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-context";

export default function LoginPage() {
  const router = useRouter();
  const { hydrated, login, notify, user } = useAppContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [nextPath, setNextPath] = useState("/dashboard");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setNextPath(query.get("next") || "/dashboard");
  }, []);

  useEffect(() => {
    if (hydrated && user) {
      router.replace(nextPath);
    }
  }, [hydrated, nextPath, router, user]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const result = login(username, password, remember);
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
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="form-control premium-input login-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="password-input-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="form-control premium-input login-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`} />
              </button>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <input
              id="login-remember"
              type="checkbox"
              className="form-check-input"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            <label className="form-label mb-0" htmlFor="login-remember">Remember me</label>
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
