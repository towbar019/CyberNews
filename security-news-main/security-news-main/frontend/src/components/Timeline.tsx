"use client";
import { useEffect, useState } from "react";

interface Article {
  id: number;
  source: string;
  title: string;
  url: string;
  published_at: string;
  content: string | null;
  cvss_score: number | null;
  is_cisa_kev: boolean;
}

interface Props {
  articles: Article[];
  profileId: number;
}

export default function Timeline({ articles, profileId }: Props) {
  const [readIds, setReadIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread" | "kev" | "critical">("all");

  useEffect(() => {
    const stored = localStorage.getItem(`secnews_read_${profileId}`);
    if (stored) {
      setReadIds(new Set(JSON.parse(stored) as number[]));
    }
  }, [profileId]);

  const markRead = (id: number) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    localStorage.setItem(`secnews_read_${profileId}`, JSON.stringify([...next]));
  };

  const markUnread = (id: number) => {
    const next = new Set(readIds);
    next.delete(id);
    setReadIds(next);
    localStorage.setItem(`secnews_read_${profileId}`, JSON.stringify([...next]));
  };

  const filtered = articles.filter((a) => {
    if (filter === "unread") return !readIds.has(a.id);
    if (filter === "kev") return a.is_cisa_kev;
    if (filter === "critical") return a.cvss_score != null && a.cvss_score >= 9.0;
    return true;
  });

  // Group by day
  const byDay: Record<string, Article[]> = {};
  for (const a of filtered) {
    const day = new Date(a.published_at).toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(a);
  }

  const filterStyle = (active: boolean) => ({
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid",
    borderColor: active ? "#58a6ff" : "#30363d",
    background: active ? "#1f6feb22" : "#161b22",
    color: active ? "#58a6ff" : "#8b949e",
    cursor: "pointer",
    fontSize: "0.82rem",
    fontWeight: active ? 600 : 400,
  } as React.CSSProperties);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const }}>
        {(["all", "unread", "kev", "critical"] as const).map((f) => (
          <button key={f} style={filterStyle(filter === f)} onClick={() => setFilter(f)}>
            {f === "all" && "Tous"}
            {f === "unread" && `Non lus (${articles.filter(a => !readIds.has(a.id)).length})`}
            {f === "kev" && `CISA KEV (${articles.filter(a => a.is_cisa_kev).length})`}
            {f === "critical" && `Critical ≥ 9.0 (${articles.filter(a => a.cvss_score != null && a.cvss_score >= 9.0).length})`}
          </button>
        ))}
        {readIds.size > 0 && (
          <button style={{ ...filterStyle(false), marginLeft: "auto", borderColor: "#30363d" }}
            onClick={() => { setReadIds(new Set()); localStorage.removeItem(`secnews_read_${profileId}`); }}>
            Tout marquer non lu
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "2rem", textAlign: "center" as const, color: "#8b949e" }}>
          Aucun article pour ce filtre.
        </div>
      )}

      {/* Timeline */}
      {Object.entries(byDay).map(([day, dayArticles]) => (
        <div key={day} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid #30363d" }}>
            {day}
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {dayArticles.map((a) => {
              const isRead = readIds.has(a.id);
              return (
                <div key={a.id} style={{
                  background: "#161b22",
                  border: "1px solid",
                  borderColor: isRead ? "#21262d" : "#30363d",
                  borderRadius: 8,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  opacity: isRead ? 0.6 : 1,
                  transition: "opacity .2s",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4, flexWrap: "wrap" as const }}>
                      {a.is_cisa_kev && (
                        <span style={{ background: "#f85149", color: "#fff", fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3 }}>CISA KEV</span>
                      )}
                      {a.cvss_score != null && a.cvss_score >= 9.0 && (
                        <span style={{ background: "#d29922", color: "#000", fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3 }}>CVSS {a.cvss_score}</span>
                      )}
                      {a.cvss_score != null && a.cvss_score >= 7.0 && a.cvss_score < 9.0 && (
                        <span style={{ background: "#d2992244", color: "#d29922", fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3, border: "1px solid #d29922" }}>CVSS {a.cvss_score}</span>
                      )}
                      <span style={{ fontSize: "0.73rem", color: "#8b949e" }}>{a.source}</span>
                    </div>
                    <a href={a.url} target="_blank" rel="noopener" style={{ color: isRead ? "#8b949e" : "#e6edf3", fontWeight: 500, fontSize: "0.9rem", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, textDecoration: "none" }}>
                      {a.title}
                    </a>
                  </div>
                  <button
                    onClick={() => isRead ? markUnread(a.id) : markRead(a.id)}
                    title={isRead ? "Marquer non lu" : "Marquer lu"}
                    style={{ background: "none", border: "none", cursor: "pointer", color: isRead ? "#3fb950" : "#8b949e", fontSize: "1rem", flexShrink: 0, padding: "2px 4px" }}>
                    {isRead ? "✓" : "○"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
