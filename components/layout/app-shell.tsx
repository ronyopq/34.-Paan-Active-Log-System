import { TopNav } from "@/components/layout/top-nav";

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="app-shell corporate-shell">
      <TopNav />
      <main className="app-main corporate-main">
        <div className="container-fluid app-content-wrap">{children}</div>
      </main>
    </div>
  );
};
