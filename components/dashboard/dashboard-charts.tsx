"use client";

import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { formatCurrency } from "@/lib/format";
import { ActivityEntry } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

type Props = {
  entries: ActivityEntry[];
};

export const DashboardCharts = ({ entries }: Props) => {
  if (!entries.length) {
    return (
      <section id="analytics" className="panel-card">
        <div className="empty-state-inline">
          <i className="bi bi-bar-chart-line" />
          <p className="mb-1 fw-semibold">No analytics data for the selected filters</p>
          <small className="text-muted">Try a wider date range or reset the current filters.</small>
        </div>
      </section>
    );
  }

  const byProject = new Map<string, number>();
  const participantsByDistrict = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byActivityType = new Map<string, number>();
  const byMonth = new Map<string, { budget: number; expenses: number }>();

  let photoCount = 0;
  let documentCount = 0;

  for (const entry of entries) {
    byProject.set(entry.project, (byProject.get(entry.project) || 0) + 1);
    participantsByDistrict.set(entry.district, (participantsByDistrict.get(entry.district) || 0) + entry.grandTotal);
    byStatus.set(entry.status, (byStatus.get(entry.status) || 0) + 1);
    byActivityType.set(entry.activityType, (byActivityType.get(entry.activityType) || 0) + 1);

    const month = new Date(entry.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const currentMonth = byMonth.get(month) || { budget: 0, expenses: 0 };
    byMonth.set(month, {
      budget: currentMonth.budget + entry.totalBudget,
      expenses: currentMonth.expenses + entry.totalExpenses
    });

    entry.attachments.forEach((file) => {
      if (file.type === "image") {
        photoCount += 1;
      } else {
        documentCount += 1;
      }
    });
  }

  const projectLabels = Array.from(byProject.keys());
  const projectData = Array.from(byProject.values());
  const districtLabels = Array.from(participantsByDistrict.keys());
  const districtData = Array.from(participantsByDistrict.values());
  const statusLabels = Array.from(byStatus.keys());
  const statusData = Array.from(byStatus.values());
  const typeLabels = Array.from(byActivityType.keys());
  const typeData = Array.from(byActivityType.values());
  const monthLabels = Array.from(byMonth.keys());
  const budgetData = Array.from(byMonth.values()).map((item) => item.budget);
  const expenseData = Array.from(byMonth.values()).map((item) => item.expenses);

  const avgParticipants = Math.round(entries.reduce((sum, entry) => sum + entry.grandTotal, 0) / entries.length);
  const avgBudget = Math.round(entries.reduce((sum, entry) => sum + entry.totalBudget, 0) / entries.length);
  const reviewedRate = Math.round((entries.filter((entry) => entry.status === "Reviewed").length / entries.length) * 100);
  const submittedRate = Math.round((entries.filter((entry) => entry.status !== "Draft").length / entries.length) * 100);
  const highestBudgetEntry = [...entries].sort((a, b) => b.totalBudget - a.totalBudget)[0];

  return (
    <section id="analytics" className="row g-3 mt-1">
      <div className="col-12 col-xxl-5">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Activities by Project</h3>
          </div>
          <Bar
            data={{
              labels: projectLabels,
              datasets: [
                {
                  label: "Activities",
                  data: projectData,
                  backgroundColor: "rgba(15, 79, 168, 0.75)",
                  borderRadius: 8
                }
              ]
            }}
            options={{
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  ticks: { precision: 0 }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="col-12 col-xxl-7">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Budget vs Expense Trend</h3>
          </div>
          <Line
            data={{
              labels: monthLabels,
              datasets: [
                {
                  label: "Budget",
                  data: budgetData,
                  borderColor: "#0f4fa8",
                  backgroundColor: "rgba(15, 79, 168, 0.12)",
                  fill: true,
                  tension: 0.28
                },
                {
                  label: "Expense",
                  data: expenseData,
                  borderColor: "#1d9c6f",
                  backgroundColor: "rgba(29, 156, 111, 0.08)",
                  fill: true,
                  tension: 0.28
                }
              ]
            }}
            options={{
              plugins: {
                legend: {
                  position: "bottom"
                }
              }
            }}
          />
        </div>
      </div>

      <div className="col-12 col-xl-5">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Participant Coverage by District</h3>
          </div>
          <Bar
            data={{
              labels: districtLabels,
              datasets: [
                {
                  label: "Participants",
                  data: districtData,
                  backgroundColor: "rgba(0, 165, 166, 0.72)",
                  borderRadius: 8
                }
              ]
            }}
            options={{
              indexAxis: "y",
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  ticks: { precision: 0 }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="col-12 col-md-6 col-xl-3">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Status Mix</h3>
          </div>
          <Doughnut
            data={{
              labels: statusLabels,
              datasets: [
                {
                  data: statusData,
                  backgroundColor: ["#0f4fa8", "#1d9c6f", "#f2a43a"]
                }
              ]
            }}
            options={{
              plugins: {
                legend: { position: "bottom" }
              }
            }}
          />
        </div>
      </div>

      <div className="col-12 col-md-6 col-xl-4">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Activity Type Mix</h3>
          </div>
          <Bar
            data={{
              labels: typeLabels,
              datasets: [
                {
                  label: "Entries",
                  data: typeData,
                  backgroundColor: ["#0f4fa8", "#1d9c6f", "#f2a43a", "#7c6fd0", "#db5f45"],
                  borderRadius: 8
                }
              ]
            }}
            options={{
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  ticks: { precision: 0 }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="col-12 col-xl-6">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Operations Snapshot</h3>
          </div>
          <div className="dashboard-mini-grid">
            <article className="dashboard-mini-card">
              <span className="dashboard-mini-label">Average Participants</span>
              <strong>{avgParticipants}</strong>
            </article>
            <article className="dashboard-mini-card">
              <span className="dashboard-mini-label">Average Budget</span>
              <strong>{formatCurrency(avgBudget)}</strong>
            </article>
            <article className="dashboard-mini-card">
              <span className="dashboard-mini-label">Reviewed Rate</span>
              <strong>{reviewedRate}%</strong>
            </article>
            <article className="dashboard-mini-card">
              <span className="dashboard-mini-label">Submission Rate</span>
              <strong>{submittedRate}%</strong>
            </article>
            <article className="dashboard-mini-card">
              <span className="dashboard-mini-label">Photo Files</span>
              <strong>{photoCount}</strong>
            </article>
            <article className="dashboard-mini-card">
              <span className="dashboard-mini-label">Document Files</span>
              <strong>{documentCount}</strong>
            </article>
          </div>

          <div className="dashboard-callout mt-3">
            <p className="mb-1 text-muted">Highest Budget Activity</p>
            <strong>{highestBudgetEntry.activityName}</strong>
            <p className="mb-0 text-muted">
              {highestBudgetEntry.project} | {formatCurrency(highestBudgetEntry.totalBudget)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
