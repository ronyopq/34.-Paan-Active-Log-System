"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAppContext } from "@/components/providers/app-context";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, router, pathname]);

  if (!user) {
    return (
      <div className="full-loader">
        <div className="spinner-border text-success" role="status" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}