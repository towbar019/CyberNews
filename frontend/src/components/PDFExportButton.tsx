"use client";
import { useState } from "react";

interface Props {
  profileName: string;
  content: string;
}

// ── Sanitisation (duplicated from lib/security.ts — island bundle must stay
// self-contained, no server deps) ─────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return ["http:", "https:"].includes(parsed.protocol) ? url : "#";
  } catch {
    return "#";
  }
}

function markdownToSafeHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_m, text: string, href: string) =>
      `<a href="${escapeHtml(safeUrl(href))}" rel="noopener noreferrer">${text}</a>`
    )
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/gs, "<ul>$&</ul>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/^---$/gm, "<hr/>");
}

const PRINT_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 2rem auto; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #1f6feb; padding-bottom: 0.5rem; color: #1f6feb; }
  h2 { font-size: 1.2rem; color: #d29922; margin-top: 1.5rem; }
  h3 { font-size: 1rem; color: #f85149; }
  ul { margin: 0.5rem 0; padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 1.5rem 0; }
  .footer { margin-top: 3rem; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 1rem; }
`;

export default function PDFExportButton({ profileName, content }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = () => {
    setLoading(true);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Autorisez les popups pour exporter en PDF.");
        return;
      }

      const doc = printWindow.document;

      // Safe DOM construction — no document.write (deprecated & unsafe sink).
      doc.title = `SecurityNews — ${profileName}`;

      const style = doc.createElement("style");
      style.textContent = PRINT_CSS;
      doc.head.appendChild(style);

      const header = doc.createElement("div");
      header.style.cssText = "display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem; font-weight:700; font-size:1.1rem;";
      header.textContent = `🐺 SecurityNews — ${profileName}`;
      doc.body.appendChild(header);

      const main = doc.createElement("div");
      // Content is escaped first, markdown converted after, hrefs sanitised →
      // safe to assign.
      main.innerHTML = markdownToSafeHtml(content);
      doc.body.appendChild(main);

      const footer = doc.createElement("div");
      footer.className = "footer";
      footer.textContent = `Généré par SecurityNews AI · ${new Date().toLocaleString("fr-FR")}`;
      doc.body.appendChild(footer);

      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        background: "#161b24",
        border: "1px solid #1d2430",
        borderRadius: 6,
        padding: "6px 14px",
        color: "#8b95a7",
        cursor: loading ? "not-allowed" : "pointer",
        fontSize: "0.83rem",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}>
      {loading ? "⏳" : "📄"} Export PDF
    </button>
  );
}
