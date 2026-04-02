"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { getNavByRole } from "@/lib/navigation";
import { useAppContext } from "@/components/providers/app-context";

const isActivePath = (pathname: string, href: string) => {
  const routePath = href.split("#")[0];
  if (routePath === "/dashboard") return pathname === "/dashboard";
  if (routePath === "/activities") return pathname === "/activities";
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
};

const mobileTabsLeft = [
  { href: "/dashboard", label: "Home", icon: "bi-house" },
  { href: "/activities", label: "My Activity", icon: "bi-clipboard-data" }
];

const mobileTabsRight = [
  { href: "/calendar", label: "Calendar", icon: "bi-calendar3" }
];

export const TopNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, toggleTheme, theme, unreadCount, logout, orgSettings } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!user) return null;

  const navItems = getNavByRole(user.role);
  return (
    <>
      <aside className={clsx("side-nav", mobileOpen && "open")}>
        <div className="side-brand">
          <Link href="/dashboard" className="side-brand-link" onClick={() => setMobileOpen(false)}>
            <span className="brand-logo">P</span>
            <span>
              <strong className="brand-name">{orgSettings.orgName}</strong>
              <span className="brand-sub">Activity Manager</span>
            </span>
          </Link>
          <div className="side-brand-actions">
            <button className="icon-btn side-mobile-theme" onClick={toggleTheme} aria-label="Toggle theme">
              <i className={`bi ${theme === "corporate-dark" ? "bi-brightness-high" : "bi-moon"}`} />
            </button>
            <button
              className="icon-btn side-mobile-logout"
              onClick={() => {
                setMobileOpen(false);
                logout();
                router.push("/login");
              }}
              aria-label="Logout"
            >
              <i className="bi bi-box-arrow-right" />
            </button>
            <button className="icon-btn side-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>

        <nav className="side-menu" aria-label="Primary menu">
          {navItems.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={clsx("side-link", isActivePath(pathname, item.href) && "active")}
            >
              <i className={`bi ${item.icon}`} />
              <span>{item.label}</span>
              {item.href === "/notifications" && unreadCount > 0 && <span className="notif-inline">{unreadCount}</span>}
            </Link>
          ))}
        </nav>

        <div className="side-footer">
          <div className="d-flex gap-2">
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
              <i className={`bi ${theme === "corporate-dark" ? "bi-brightness-high" : "bi-moon"}`} />
            </button>
            <div className="flex-grow-1" />
            {(user.role === "Admin" || user.role === "Manager") && (
              <Link href="/notifications" className="icon-btn text-decoration-none position-relative">
                <i className="bi bi-bell" />
                {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
              </Link>
            )}
          </div>
          <button
            className="danger-outline w-100 mobile-menu-logout"
            onClick={() => {
              setMobileOpen(false);
              logout();
              router.push("/login");
            }}
          >
            <i className="bi bi-box-arrow-right" /> Logout
          </button>

          <div className="side-profile">
            <span className="avatar">{user.fullName.charAt(0).toUpperCase()}</span>
            <div className="side-profile-meta">
              <strong>{user.fullName}</strong>
              <small>{user.title || user.role}</small>
            </div>
            <button
              className="danger-outline"
              onClick={() => {
                logout();
                router.push("/login");
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <header className="mobile-topbar">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <i className="bi bi-list" />
        </button>
        <Link href="/dashboard" className="mobile-brand-link">
          <span className="brand-logo">P</span>
          <strong className="brand-name">{orgSettings.orgName}</strong>
        </Link>
        <div className="d-flex gap-2">
          {(user.role === "Admin" || user.role === "Manager") && (
            <Link href="/notifications" className="icon-btn text-decoration-none position-relative" onClick={() => setMobileOpen(false)}>
              <i className="bi bi-bell" />
              {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
            </Link>
          )}
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            <i className={`bi ${theme === "corporate-dark" ? "bi-brightness-high" : "bi-moon"}`} />
          </button>
          <button
            className="icon-btn mobile-logout-btn"
            onClick={() => {
              setMobileOpen(false);
              logout();
              router.push("/login");
            }}
            aria-label="Logout"
          >
            <i className="bi bi-box-arrow-right" />
          </button>
        </div>
      </header>

      <button
        className={clsx("mobile-overlay", mobileOpen && "show")}
        onClick={() => setMobileOpen(false)}
        aria-label="Close menu overlay"
      />

      <nav className="mobile-bottom-nav" aria-label="Mobile tab navigation">
        {mobileTabsLeft.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setMobileOpen(false)}
            className={clsx(
              "mobile-tab",
              tab.href === "/dashboard" && "mobile-tab-home",
              tab.href === "/activities" && "mobile-tab-my",
              isActivePath(pathname, tab.href) && "active"
            )}
          >
            <i className={`bi ${tab.icon}`} />
            <span>{tab.label}</span>
          </Link>
        ))}
        <Link
          href="/activities/new"
          onClick={() => setMobileOpen(false)}
          className={clsx("mobile-tab mobile-tab-new", isActivePath(pathname, "/activities/new") && "active")}
          aria-label="Open New Activity Form"
        >
          <i className="bi bi-plus-circle" />
          <span>New Form</span>
        </Link>
        {mobileTabsRight.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={() => setMobileOpen(false)}
            className={clsx("mobile-tab mobile-tab-calendar", isActivePath(pathname, tab.href) && "active")}
          >
            <i className={`bi ${tab.icon}`} />
            <span>{tab.label}</span>
          </Link>
        ))}
        <button className="mobile-tab mobile-tab-menu" onClick={() => setMobileOpen(true)}>
          <i className="bi bi-grid" />
          <span>Menu</span>
        </button>
      </nav>
    </>
  );
};
