"use client";

import { useMemo, useState } from "react";
import { EntryDetailsModal } from "@/components/activities/entry-details-modal";
import { ActivityCalendar } from "@/components/dashboard/activity-calendar";
import { useAppContext } from "@/components/providers/app-context";

export default function CalendarPage() {
  const { visibleEntries } = useAppContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => visibleEntries.find((entry) => entry.uniqueId === selectedId) || null,
    [visibleEntries, selectedId]
  );

  return (
    <div className="d-grid gap-3">
      <section className="page-heading">
        <h1 className="page-title">Calendar</h1>
        <p className="page-subtitle">Track activity dates and open entry details directly from calendar events.</p>
      </section>

      <ActivityCalendar entries={visibleEntries} onEventSelect={setSelectedId} />

      {selectedEntry && <EntryDetailsModal entry={selectedEntry} onClose={() => setSelectedId(null)} />}
    </div>
  );
}