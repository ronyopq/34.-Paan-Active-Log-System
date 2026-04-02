"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/activities/new/");
  }, [router]);

  return (
    <div className="full-loader">
      <div className="spinner-border text-success" role="status" />
    </div>
  );
}
