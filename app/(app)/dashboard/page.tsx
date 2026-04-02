"use client";

import { useMemo, useState } from "react";
import { KpiCard } from "@/components/common/kpi-card";
import { EntryDetailsModal } from "@/components/activities/entry-details-modal";
import { ActivityCalendar } from "@/components/dashboard/activity-calendar";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { useAppContext } from "@/components/providers/app-context";
import { formatCurrency } from "@/lib/format";

export default function DashboardPage() {
  const { visibleEntries, user, updateEntry, deleteEntry, removeAttachmentFromEntry, addAuditLog, notify } =
    useAppContext();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => visibleEntries.find((entry) => entry.uniqueId === selectedEntryId),
    [visibleEntries, selectedEntryId]
  );

  const totalParticipants = visibleEntries.reduce((sum, entry) => sum + entry.grandTotal, 0);
  const totalBudget = visibleEntries.reduce((sum, entry) => sum + entry.totalBudget, 0);
  const projects = new Set(visibleEntries.map((entry) => entry.project)).size;

  return (
    <div className="d-grid gap-4">
      <section className="page-heading">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Role: {user?.role} | Monitor activities, analytics, and calendar from one place.</p>
      </section>

      <section className="grid-kpi">
        <KpiCard label="Total Activities" value={visibleEntries.length} icon="bi-clipboard-check" accent="green" />
        <KpiCard label="Total Participants" value={totalParticipants} icon="bi-people" accent="blue" />
        <KpiCard label="Total Budget" value={formatCurrency(totalBudget)} icon="bi-cash-stack" accent="amber" />
        <KpiCard label="Projects" value={projects} icon="bi-folder2-open" accent="rose" />
      </section>

      <DashboardCharts entries={visibleEntries} />

      <ActivityCalendar entries={visibleEntries} onEventSelect={setSelectedEntryId} />

      {selectedEntry && (
        <EntryDetailsModal
          entry={selectedEntry}
          onClose={() => setSelectedEntryId(null)}
          canManage={user?.role === "Admin"}
          onUpdateEntry={(id, updates) => {
            updateEntry(id, updates);
            addAuditLog("Updated Entry", "Dashboard", id, "Entry edited from dashboard");
            notify(`Entry updated: ${id}`, "success");
          }}
          onDeleteEntry={(id) => {
            deleteEntry(id);
            addAuditLog("Deleted Entry", "Dashboard", id, "Entry deleted from dashboard");
            notify(`Entry deleted: ${id}`, "success");
          }}
          onRemoveAttachment={(entryId, attachmentId) => {
            removeAttachmentFromEntry(entryId, attachmentId);
            addAuditLog("Deleted Attachment", "Dashboard", entryId, `Attachment removed: ${attachmentId}`);
            notify("Attachment removed.", "success");
          }}
        />
      )}
    </div>
  );
}
