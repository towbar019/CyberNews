"use client";
import { useState } from "react";

interface Props {
  profileName: string;
  content: string;
}

export default function PDFExportButton({ profileName, content }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Use browser print API for PDF export — no backend needed
      const printWindow = window.open("", "_blank");
      if (!printWindow) { alert("Autorisez les popups pour exporter en PDF."); return; }

      // Convert markdown-ish to HTML for printing
      const htmlContent = content
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>\n?)+/gs, "<ul>$&</ul>")
        .replace(/\n\n/g, "<br/><br/>")
        .replace(/^---$/gm, "<hr/>");

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>SecurityNews — ${profileName}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 2rem auto; color: #1a1a1a; line-height: 1.6; }
            h1 { font-size: 1.6rem; border-bottom: 2px solid #1f6feb; padding-bottom: 0.5rem; color: #1f6feb; }
            h2 { font-size: 1.2rem; color: #d29922; margin-top: 1.5rem; }
            h3 { font-size: 1rem; color: #f85149; }
            ul { margin: 0.5rem 0; padding-left: 1.5rem; }
            li { margin: 0.25rem 0; }
            hr { border: none; border-top: 1px solid #ccc; margin: 1.5rem 0; }
            .footer { margin-top: 3rem; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 1rem; }
          </style>
        </head>
        <body>
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem;">
            <span style="font-size:1.5rem;">🐺</span>
            <span style="font-weight:700; font-size:1.1rem;">SecurityNews — ${profileName}</span>
          </div>
          ${htmlContent}
          <div class="footer">
            Généré par SecurityNews AI · ${new Date().toLocaleString("fr-FR")}
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        background: "#161b22",
        border: "1px solid #30363d",
        borderRadius: 6,
        padding: "6px 14px",
        color: "#8b949e",
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
