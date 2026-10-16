/**
 * Friday weekly stat report (Doc, Oct 16 2026). Short and plain: this week's logged numbers
 * against the doctor's weekly goals, the same comparison as the Goals page, only for goals
 * they've set. Pure function so it can be tested and previewed without a database or SMTP.
 */
import type { GoalsComparison, GoalMetricKey } from "../../shared/goalsComparison";

export const SYNAPSE_URL = "https://synapse-production-daae.up.railway.app";
export const WEEKLY_SUBJECT = "Synapse: your week vs your goals";

const LABELS: Record<GoalMetricKey, string> = { officeVisits: "Visits", newPatients: "New patients", revenue: "Revenue" };
const ORDER: GoalMetricKey[] = ["officeVisits", "newPatients", "revenue"];

function whole(metric: GoalMetricKey, n: number): string {
  const v = Math.round(n).toLocaleString("en-US");
  return metric === "revenue" ? `$${v}` : v;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** One line per goal the doctor has set, e.g. "Visits: 244 of 250". */
export function weeklyGoalLines(comparison: GoalsComparison): string[] {
  const week = comparison.periods.find((p) => p.period === "week");
  if (!week) return [];
  const lines: string[] = [];
  for (const key of ORDER) {
    const m = week.metrics.find((x) => x.metric === key);
    if (!m) continue;
    const r = m.result;
    if (r.status === "compared") lines.push(`${LABELS[key]}: ${whole(key, r.actual)} of ${whole(key, r.goal)}`);
    else if (r.status === "no_stats") lines.push(`${LABELS[key]}: nothing logged yet this week`);
    // no_goal / not_tracked / day_off: leave it out.
  }
  return lines;
}

export function buildWeeklyStatEmail(input: { name: string | null; comparison: GoalsComparison }) {
  const name = input.name?.trim() || "Doctor";
  const lines = input.comparison.hasGoals ? weeklyGoalLines(input.comparison) : [];
  const noGoals = lines.length === 0;
  const goalsUrl = `${SYNAPSE_URL}/goals`;

  const intro = noGoals
    ? "You haven't set your goals yet. Set them once and this email will show your week against them."
    : "Here's your week so far against your goals:";
  const nudge = "Log in and log your numbers so these stay up to date.";
  const saveLine = "Save this link, the address is a bit unusual:";

  const text = [
    `Hi ${name},`,
    ``,
    intro,
    ...(noGoals ? [`Set your goals: ${goalsUrl}`] : [``, ...lines]),
    ``,
    nudge,
    ``,
    saveLine,
    SYNAPSE_URL,
    ``,
    `- Synapse`,
    ``,
    `To stop these emails, update your preferences in Synapse > Profile.`,
  ].join("\n");

  const btn = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:bold;font-size:18px;padding:14px 24px;border-radius:10px">${label}</a>`;
  const rows = lines
    .map((l) => {
      const [k, v] = l.split(": ");
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:18px">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:18px;font-weight:bold;text-align:right">${esc(v)}</td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827">
<div style="max-width:480px;margin:0 auto;padding:20px 16px">
<div style="background:#ffffff;border-radius:12px;padding:24px 20px">
<p style="font-size:18px;margin:0 0 12px">Hi ${esc(name)},</p>
<p style="font-size:18px;margin:0 0 16px">${esc(intro)}</p>
${noGoals ? `<p style="margin:0 0 20px">${btn(goalsUrl, "Set your goals")}</p>` : `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${rows}</table>`}
<p style="font-size:18px;margin:0 0 16px">${esc(nudge)}</p>
<p style="margin:0 0 20px">${btn(SYNAPSE_URL, "Open Synapse")}</p>
<p style="font-size:16px;margin:0 0 4px">${esc(saveLine)}</p>
<p style="font-size:16px;margin:0 0 20px;word-break:break-all"><a href="${SYNAPSE_URL}" style="color:#2563eb">${SYNAPSE_URL}</a></p>
<p style="font-size:16px;margin:0">- Synapse</p>
</div>
<p style="font-size:14px;color:#6b7280;margin:16px 4px 0">To stop these emails, update your preferences in Synapse &gt; Profile.</p>
</div></body></html>`;

  return { subject: WEEKLY_SUBJECT, text, html };
}
