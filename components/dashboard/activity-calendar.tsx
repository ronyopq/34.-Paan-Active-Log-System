"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ActivityEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";

type Props = {
  entries: ActivityEntry[];
  onEventSelect?: (id: string) => void;
};

export const ActivityCalendar = ({ entries, onEventSelect }: Props) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const events = useMemo(() => {
    return entries.map((entry) => ({
      id: entry.uniqueId,
      title: entry.activityName,
      start: entry.date,
      classNames: [`event-status-${entry.status.toLowerCase()}`],
      extendedProps: {
        project: entry.project,
        status: entry.status,
        participants: entry.grandTotal
      }
    }));
  }, [entries]);

  const selectedEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entries.filter((entry) => entry.date === selectedDate);
  }, [entries, selectedDate]);

  const totalEvents = entries.length;
  const uniqueDays = new Set(entries.map((entry) => entry.date)).size;

  return (
    <div className="panel-card calendar-pro">
      <div className="calendar-pro-head">
        <div>
          <h3 className="panel-title mb-1">Activity Calendar</h3>
          <p className="text-muted mb-0 small">Click a date or event to view entries and open details.</p>
        </div>
        <div className="calendar-pro-stats">
          <span className="soft-badge">{totalEvents} Total Events</span>
          <span className="soft-badge">{uniqueDays} Active Days</span>
        </div>
      </div>

      <div className="calendar-pro-layout">
        <div className="calendar-pro-main">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height="auto"
            dayMaxEventRows={2}
            events={events}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth"
            }}
            eventDisplay="block"
            dateClick={(arg) => setSelectedDate(arg.dateStr)}
            eventClick={(arg) => {
              const id = String(arg.event.id || "");
              const eventDate = arg.event.startStr.slice(0, 10);
              if (eventDate) setSelectedDate(eventDate);
              if (id) onEventSelect?.(id);
            }}
          />
        </div>

        <aside className="calendar-pro-side">
          <h4 className="h6 mb-1">Selected Date</h4>
          <p className="text-muted small mb-3">{selectedDate ? formatDate(selectedDate) : "Select any date from calendar."}</p>
          <div className="d-grid gap-2">
            {selectedEntries.length === 0 && <p className="text-muted small mb-0">No entries for selected date.</p>}
            {selectedEntries.map((entry) => (
              <button key={entry.uniqueId} className="calendar-side-item" onClick={() => onEventSelect?.(entry.uniqueId)}>
                <strong>{entry.activityName}</strong>
                <span>{entry.project}</span>
                <span>{entry.activityType}</span>
                <span className="mono">{entry.uniqueId}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};
