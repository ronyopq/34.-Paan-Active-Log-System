"use client";

import { useEffect } from "react";
import { AppContextProvider } from "@/components/providers/app-context";

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // @ts-ignore
    import("bootstrap/dist/js/bootstrap.bundle.min.js");
  }, []);

  return <AppContextProvider>{children}</AppContextProvider>;
};