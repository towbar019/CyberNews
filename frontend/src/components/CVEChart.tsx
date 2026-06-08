"use client";
import { useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DataPoint {
  app: string;
  month: string;
  count: number;
}

interface Props {
  data: DataPoint[];
  monitoredApps: string[];
}

const COLORS = [
  "#58a6ff", "#3fb950", "#f85149", "#d29922", "#bc8cff",
  "#ff7b72", "#56d364", "#79c0ff", "#ffa657", "#db61a2",
  "#85e89d", "#ffab70", "#b392f0", "#f97583", "#2188ff",
  "#34d058", "#e36209", "#ea4aaa", "#0075ca", "#e3b341",
];

export default function CVEChart({ data, monitoredApps }: Props) {
  const months = [...new Set(data.map((d) => d.month))].sort();

  const activeApps = monitoredApps.filter((app) =>
    data.some((d) => d.app === app && d.count > 0)
  );

  const [selectedApps, setSelectedApps] = useState<string[]>(activeApps);

  if (months.length === 0 || activeApps.length === 0) {
    return (
      <div style={{
        background: "#161b22", border: "1px solid #30363d", borderRadius: 8,
        padding: "2rem", textAlign: "center", color: "#8b949e",
      }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</div>
        Pas encore de données CVE.
      </div>
    );
  }

  const toggleApp = (app: string) => {
    setSelectedApps((prev) =>
      prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]
    );
  };

  const allSelected = selectedApps.length === activeApps.length;

  const datasets = activeApps
    .filter((app) => selectedApps.includes(app))
    .map((app, i) => {
      const colorIdx = activeApps.indexOf(app);
      return {
        label: app,
        backgroundColor: COLORS[colorIdx % COLORS.length] + "bb",
        borderColor: COLORS[colorIdx % COLORS.length],
        borderWidth: 1,
        data: months.map((m) => {
          const found = data.find((d) => d.app === app && d.month === m);
          return found?.count ?? 0;
        }),
      };
    });

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.75rem" }}>
        <button
          onClick={() => setSelectedApps(allSelected ? [] : [...activeApps])}
          style={{
            padding: "2px 8px", fontSize: "0.68rem", borderRadius: 4, cursor: "pointer",
            border: "1px solid #444", fontWeight: 700,
            background: allSelected ? "#1f3a5f" : "#0d1117",
            color: allSelected ? "#58a6ff" : "#8b949e",
          }}
        >
          {allSelected ? "Aucun" : "Tous"}
        </button>
        {activeApps.map((app, i) => {
          const selected = selectedApps.includes(app);
          const color = COLORS[i % COLORS.length];
          return (
            <button
              key={app}
              onClick={() => toggleApp(app)}
              style={{
                padding: "2px 8px", fontSize: "0.68rem", borderRadius: 4, cursor: "pointer",
                border: `1px solid ${selected ? color : "#30363d"}`,
                background: selected ? color + "22" : "#0d1117",
                color: selected ? color : "#8b949e",
                fontWeight: selected ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {app}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      {datasets.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8b949e", padding: "1rem", fontSize: "0.85rem" }}>
          Aucune app sélectionnée.
        </div>
      ) : (
        <div style={{ position: "relative", height: 300 }}>
          <Bar
            data={{ labels: months, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "bottom" as const,
                  labels: {
                    color: "#8b949e", boxWidth: 10, font: { size: 10 },
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} mention${ctx.parsed.y > 1 ? "s" : ""}`,
                  },
                },
              },
              scales: {
                x: {
                  stacked: false,
                  ticks: { color: "#8b949e", font: { size: 10 } },
                  grid: { color: "#21262d" },
                },
                y: {
                  beginAtZero: true,
                  ticks: { color: "#8b949e", font: { size: 10 }, stepSize: 1 },
                  grid: { color: "#21262d" },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
