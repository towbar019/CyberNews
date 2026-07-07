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
  /** Slug du profil — active le drill-down au clic vers la sous-page CVE */
  profileSlug?: string;
  lang?: "fr" | "en";
}

const COLORS = [
  "#58a6ff", "#3fb950", "#f85149", "#d29922", "#bc8cff",
  "#ff7b72", "#56d364", "#79c0ff", "#ffa657", "#db61a2",
  "#85e89d", "#ffab70", "#b392f0", "#f97583", "#2188ff",
  "#34d058", "#e36209", "#ea4aaa", "#0075ca", "#e3b341",
];

export default function CVEChart({ data, monitoredApps, profileSlug, lang = "fr" }: Props) {
  const months = [...new Set(data.map((d) => d.month))].sort();

  const activeApps = monitoredApps.filter((app) =>
    data.some((d) => d.app === app && d.count > 0)
  );

  const [selectedApps, setSelectedApps] = useState<string[]>(activeApps);

  if (months.length === 0 || activeApps.length === 0) {
    return (
      <div style={{
        background: "#161b24", border: "1px solid #1d2430", borderRadius: 8,
        padding: "2rem", textAlign: "center", color: "#8b95a7",
      }}>
        {lang === "en" ? "No CVE data yet." : "Pas encore de données CVE."}
      </div>
    );
  }

  const toggleApp = (app: string) => {
    setSelectedApps((prev) =>
      prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]
    );
  };

  const allSelected = selectedApps.length === activeApps.length;
  const shownApps = activeApps.filter((app) => selectedApps.includes(app));

  const datasets = shownApps.map((app) => {
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

  // Drill-down : clic sur une barre → sous-page CVE filtrée app + mois
  const handleClick = (_evt: unknown, elements: { datasetIndex: number; index: number }[]) => {
    if (!profileSlug || elements.length === 0) return;
    const el = elements[0];
    const app = shownApps[el.datasetIndex];
    const month = months[el.index];
    if (!app || !month) return;
    const params = new URLSearchParams({ app, month });
    if (lang === "en") params.set("lang", "en");
    window.location.href = `/security-news/${profileSlug}/cve?${params.toString()}`;
  };

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.75rem" }}>
        <button
          onClick={() => setSelectedApps(allSelected ? [] : [...activeApps])}
          style={{
            padding: "2px 8px", fontSize: "0.68rem", borderRadius: 4, cursor: "pointer",
            border: "1px solid #2a3344", fontWeight: 700,
            background: allSelected ? "#1f3a5f" : "#0a0d12",
            color: allSelected ? "#5b9cf8" : "#8b95a7",
          }}
        >
          {allSelected ? (lang === "en" ? "None" : "Aucun") : (lang === "en" ? "All" : "Tous")}
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
                border: `1px solid ${selected ? color : "#1d2430"}`,
                background: selected ? color + "22" : "#0a0d12",
                color: selected ? color : "#8b95a7",
                fontWeight: selected ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {app}
            </button>
          );
        })}
      </div>

      {profileSlug && (
        <div style={{ fontSize: "0.72rem", color: "#5b6577", marginBottom: "0.5rem" }}>
          {lang === "en"
            ? "Tip: click a bar to open the CVE list for that app & month."
            : "Astuce : cliquez sur une barre pour ouvrir la liste des CVE de l'app sur ce mois."}
        </div>
      )}

      {/* Chart */}
      {datasets.length === 0 ? (
        <div style={{ textAlign: "center", color: "#8b95a7", padding: "1rem", fontSize: "0.85rem" }}>
          {lang === "en" ? "No app selected." : "Aucune app sélectionnée."}
        </div>
      ) : (
        <div style={{ position: "relative", height: 420 }}>
          <Bar
            data={{ labels: months, datasets }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              onClick: handleClick as never,
              onHover: (evt, elements) => {
                const target = evt.native?.target as HTMLElement | undefined;
                if (target && profileSlug) target.style.cursor = elements.length ? "pointer" : "default";
              },
              plugins: {
                legend: {
                  position: "bottom" as const,
                  labels: {
                    color: "#8b95a7", boxWidth: 10, font: { size: 11 },
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} mention${ctx.parsed.y > 1 ? "s" : ""}`,
                    footer: () => (profileSlug ? (lang === "en" ? "Click to view CVEs" : "Cliquer pour voir les CVE") : ""),
                  },
                },
              },
              scales: {
                x: {
                  stacked: false,
                  ticks: { color: "#8b95a7", font: { size: 11 } },
                  grid: { color: "#1d2430" },
                },
                y: {
                  beginAtZero: true,
                  ticks: { color: "#8b95a7", font: { size: 11 }, stepSize: 1 },
                  grid: { color: "#1d2430" },
                },
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
