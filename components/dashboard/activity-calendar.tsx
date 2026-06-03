"use client";

import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { ActivityEntry } from "@/lib/types";
import { formatDate } from "@/lib/format";

const PROJECT_PALETTE = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a5f" },
  { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
  { bg: "#fef3c7", border: "#f59e0b", text: "#713f12" },
  { bg: "#fce7f3", border: "#ec4899", text: "#831843" },
  { bg: "#e0e7ff", border: "#6366f1", text: "#312e81" },
  { bg: "#ffedd5", border: "#f97316", text: "#7c2d12" },
  { bg: "#ccfbf1", border: "#14b8a6", text: "#134e4a" },
  { bg: "#f3e8ff", border: "#a855f7", text: "#581c87" },
  { bg: "#fef9c3", border: "#eab308", text: "#713f12" },
  { bg: "#e5e7eb", border: "#6b7280", text: "#1f2937" },
];

type Props = {
  entries: ActivityEntry[];
  onEventSelect?: (id: string) => void;
};

export const ActivityCalendar = ({ entries, onEventSelect }: Props) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<"dayGridMonth" | "dayGridWeek">("dayGridMonth");
  const [filterProject, setFilterProject] = useState("");

  const projectOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.project))).sort(),
    [entries]
  );

  const projectColorMap = useMemo(() => {
    const map = new Map<string, (typeof PROJECT_PALETTE)[number]>();
    projectOptions.forEach((project, idx) => {
      map.set(project, PROJECT_PALETTE[idx % PROJECT_PALETTE.length]);
    });
    return map;
  }, [projectOptions]);

  const filteredEntries = useMemo(
    () => (filterProject ? entries.filter((e) => e.project === filterProject) : entries),
    [entries, filterProject]
  );

  const events = useMemo(() => {
    return filteredEntries.map((entry) => {
      const colors = projectColorMap.get(entry.project) || PROJECT_PALETTE[0];
      return {
        id: entry.uniqueId,
        title: entry.activityName,
        start: entry.date,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        classNames: [],
        extendedProps: {
          project: entry.project,
          status: entry.status,
          participants: entry.grandTotal
        }
      };
    });
  }, [filteredEntries, projectColorMap]);

  const selectedEntries = useMemo(() => {
    if (!selectedDate) return [];
    return filteredEntries.filter((entry) => entry.date === selectedDate);
  }, [filteredEntries, selectedDate]);

  const totalEvents = filteredEntries.length;
  const uniqueDays = new Set(filteredEntries.map((entry) => entry.date)).size;

  return (
    <div className="panel-card calendar-pro">
      <div className="calendar-pro-head">
        <div>
          <h3 className="panel-title mb-1">Activity Calendar</h3>
          <p className="text-muted mb-0 small">Click a date or event to view entries and open details.</p>
        </div>
        <div className="calendar-pro-stats">
          <span className="soft-badge">{totalEvents} Events</span>
          <span className="soft-badge">{uniqueDays} Active Days</span>
        </div>
      </div>

      <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
        <div style={{ minWidth: 180 }}>
          <select
            className="form-select premium-input"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">All Projects</option>
            {projectOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="d-flex gap-3 flex-wrap">
          {projectOptions.slice(0, 5).map((p) => {
            const colors = projectColorMap.get(p);
            if (!colors) return null;
            return (
              <span key={p} className="d-flex align-items-center gap-1 small" style={{ color: colors.text }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: colors.border, display: "inline-block" }} />
                {p}
              </span>
            );
          })}
          {projectOptions.length > 5 && (
            <span className="small text-muted">+{projectOptions.length - 5} more</span>
          )}
        </div>
      </div>

      <div className="calendar-pro-layout">
        <div className="calendar-pro-main">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView={view}
            height="auto"
            dayMaxEventRows={2}
            events={events}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek"
            }}
            views={{
              dayGridMonth: { buttonText: "Month" },
              dayGridWeek: { buttonText: "Week" }
            }}
            eventDisplay="block"
            dateClick={(arg) => setSelectedDate(arg.dateStr)}
            eventClick={(arg) => {
              const id = String(arg.event.id || "");
              const eventDate = arg.event.startStr.slice(0, 10);
              if (eventDate) setSelectedDate(eventDate);
              if (id) onEventSelect?.(id);
            }}
            viewDidMount={(arg) => setView(arg.view.type as "dayGridMonth" | "dayGridWeek")}
          />
        </div>

        <aside className="calendar-pro-side">
          <h4 className="h6 mb-1">Selected Date</h4>
          <p className="text-muted small mb-3">{selectedDate ? formatDate(selectedDate) : "Select any date from calendar."}</p>
          <div className="d-grid gap-2">
            {selectedEntries.length === 0 && <p className="text-muted small mb-0">No entries for this date.</p>}
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
