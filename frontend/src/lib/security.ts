import { z } from "zod";

/**
 * Security utilities — validation & sanitisation layer.
 * Voir security review 2026-06-09 : XSS via markdown links + article URLs,
 * URL params non validés.
 */

// ── URL scheme sanitisation ──────────────────────────────────────────────────
// Bloque javascript:, data:, vbscript: etc. Ne laisse passer que http(s).
export function safeUrl(url: string | null | undefined): string {
  if (!url) return "#";
  try {
    const parsed = new URL(url, "https://placeholder.invalid");
    return ["http:", "https:"].includes(parsed.protocol) ? url : "#";
  } catch {
    return "#";
  }
}

// ── HTML escaping ────────────────────────────────────────────────────────────
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Markdown → HTML (sanitised) ──────────────────────────────────────────────
// Convertisseur volontairement minimal : le contenu vient de l'AI (DB), mais on
// le traite comme non-fiable. Escape d'abord, puis conversion, et les hrefs
// passent par safeUrl().
export function markdownToHtml(md: string): string {
  const escaped = escapeHtml(md);
  return escaped
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (_m, text: string, href: string) => {
      return `<a href="${escapeHtml(safeUrl(href))}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    })
    .replace(/^---$/gm, "<hr/>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/\n\n/g, "</p><p>");
}

// ── URL parameter validation (zod) ───────────────────────────────────────────

export const TabSchema = z.enum(["daily", "weekly", "monthly"]).catch("daily");
export const ViewSchema = z.enum(["summary", "detailed"]).catch("summary");
export const LangSchema = z.enum(["fr", "en"]).catch("fr");
export const RangeSchema = z.enum(["day", "week", "month"]).catch("day");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function parseDateParam(value: string | null): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(value + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseMonthParam(value: string | null): Date | null {
  if (!value || !MONTH_RE.test(value)) return null;
  const d = new Date(value + "-01T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

// Slug de profil : alphanumérique + tirets, max 64
export const ProfileSlugSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/)
  .catch("");

// Nom d'app pour la sous-page CVE : lettres/chiffres/espaces/./-/_/()
export const AppNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9 ._()/-]{1,64}$/)
  .catch("");

export const YearSchema = z.coerce.number().int().min(2000).max(2100).nullable().catch(null);
