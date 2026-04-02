"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAppContext } from "@/components/providers/app-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, user, router, pathname]);

  if (!hydrated || !user) {
    return (
      <div className="full-loader">
        <div className="spinner-border text-success" role="status" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
