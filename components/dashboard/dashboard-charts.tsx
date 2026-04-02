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
  const byProject = new Map<string, number>();
  const byDistrict = new Map<string, number>();
  const byMonth = new Map<string, number>();

  for (const entry of entries) {
    byProject.set(entry.project, (byProject.get(entry.project) || 0) + 1);
    byDistrict.set(entry.district, (byDistrict.get(entry.district) || 0) + 1);
    const month = new Date(entry.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    byMonth.set(month, (byMonth.get(month) || 0) + 1);
  }

  const projectLabels = Array.from(byProject.keys());
  const projectData = Array.from(byProject.values());
  const districtLabels = Array.from(byDistrict.keys());
  const districtData = Array.from(byDistrict.values());
  const monthLabels = Array.from(byMonth.keys());
  const monthData = Array.from(byMonth.values());

  return (
    <section id="analytics" className="row g-3 mt-1">
      <div className="col-12 col-xl-5">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Activities by Project</h3>
          </div>
          <Bar
            data={{
              labels: projectLabels,
              datasets: [
                {
                  data: projectData,
                  backgroundColor: "rgba(45, 108, 46, 0.75)",
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
                  ticks: {
                    precision: 0
                  }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="col-12 col-xl-3">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">By District</h3>
          </div>
          <Doughnut
            data={{
              labels: districtLabels,
              datasets: [
                {
                  data: districtData,
                  backgroundColor: [
                    "#2d6c2e",
                    "#4f8a58",
                    "#8dbf8a",
                    "#f7b955",
                    "#e56b3f",
                    "#6699cc"
                  ]
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

      <div className="col-12 col-xl-4">
        <div className="panel-card h-100">
          <div className="panel-head">
            <h3 className="panel-title">Monthly Trend</h3>
          </div>
          <Line
            data={{
              labels: monthLabels,
              datasets: [
                {
                  data: monthData,
                  borderColor: "#2d6c2e",
                  backgroundColor: "rgba(45,108,46,.16)",
                  fill: true,
                  tension: 0.35
                }
              ]
            }}
            options={{
              plugins: {
                legend: { display: false }
              }
            }}
          />
        </div>
      </div>
    </section>
  );
};