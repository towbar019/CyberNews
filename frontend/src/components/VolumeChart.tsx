"use client";
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

interface Props {
  volume: { day: string; count: number }[];
}

export default function VolumeChart({ volume }: Props) {
  if (volume.length === 0) {
    return (
      <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "2rem", textAlign: "center", color: "#8b949e" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📈</div>
        Pas encore de données de volume.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: 200 }}>
      <Bar
        data={{
          labels: volume.map(v => v.day),
          datasets: [{
            label: "Articles / jour",
            data: volume.map(v => v.count),
            backgroundColor: "#1f6feb88",
            borderColor: "#58a6ff",
            borderWidth: 1,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: "#8b949e", font: { size: 10 }, maxRotation: 45 }, grid: { color: "#21262d" } },
            y: { beginAtZero: true, ticks: { color: "#8b949e", font: { size: 11 }, stepSize: 10 }, grid: { color: "#21262d" } },
          },
        }}
      />
    </div>
  );
}
