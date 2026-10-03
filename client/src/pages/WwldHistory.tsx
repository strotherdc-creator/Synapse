import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { BUILTIN_STATS } from "@shared/wwldStats";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const SESSION_LABELS: Record<string, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  end_of_day: "End of Day",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function getTodayDate(): string {
  const d = new Date();
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatLongDate(key: string) {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

type HistoryData = inferRouterOutputs<AppRouter>["wwld"]["getHistory"];
type HistoryDay = HistoryData["days"][number];

function MonthGrid({
  year,
  month,
  loggedDates,
  selected,
  today,
  onSelect,
}: {
  year: number;
  month: number;
  loggedDates: Set<string>;
  selected: string;
  today: string;
  onSelect: (key: string) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: Array<number | null> = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="bg-card border border-brand-gold/15 rounded-xl p-2 sm:p-3">
      <h3 className="text-lg font-bold text-foreground mb-2 px-1">{MONTHS[month]}</h3>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="pb-1 text-base font-semibold text-muted-foreground" aria-hidden="true">{d}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e-${i}`} />;
          const key = dateKey(year, month, day);
          const logged = loggedDates.has(key);
          const isSelected = key === selected;
          const isFuture = key > today;
          return (
            <button
              key={key}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(key)}
              aria-label={`${formatLongDate(key)}${logged ? ", stats logged" : ", nothing logged"}`}
              aria-pressed={isSelected}
              className={[
                "relative flex h-11 min-w-0 flex-col items-center justify-center rounded-md text-base leading-none transition-colors",
                isSelected
                  ? "bg-[var(--gold)] text-black font-bold"
                  : logged
                    ? "bg-[var(--gold)]/20 text-foreground font-bold hover:bg-[var(--gold)]/35"
                    : "text-foreground/85 hover:bg-muted",
                key === today && !isSelected ? "ring-2 ring-[var(--gold)]" : "",
                isFuture ? "text-muted-foreground/60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {day}
              {logged && (
                <span
                  aria-hidden="true"
                  className={[
                    "mt-1 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-black" : "bg-[var(--gold)]",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayDetail({ dateKeyStr, day, data }: { dateKeyStr: string; day: HistoryDay | undefined; data: HistoryData }) {
  const customById = useMemo(() => new Map(data.customStats.map((c) => [String(c.id), c])), [data.customStats]);

  if (!day) {
    return (
      <div className="bg-card border border-brand-gold/15 rounded-xl p-4">
        <h3 className="text-lg font-bold text-foreground">{formatLongDate(dateKeyStr)}</h3>
        <p className="text-sm text-muted-foreground mt-2">Nothing logged on this day.</p>
      </div>
    );
  }

  // Day totals — only stats that were actually logged in at least one session.
  const builtinRows = BUILTIN_STATS.flatMap((stat) => {
    const sessions = day.sessions.filter((s) => typeof s.builtin[stat.key] === "number");
    if (sessions.length === 0) return [];
    return [{ key: stat.key, label: stat.label, alias: stat.alias, value: sessions.reduce((sum, s) => sum + (s.builtin[stat.key] ?? 0), 0) }];
  });
  const customIds = Array.from(new Set(day.sessions.flatMap((s) => Object.keys(s.custom))));
  const customRows = customIds
    .map((id) => {
      const def = customById.get(id);
      const value = day.sessions.reduce((sum, s) => sum + (s.custom[id] ?? 0), 0);
      return {
        key: `custom-${id}`,
        label: def ? def.name : "Custom stat",
        alias: [def?.unit, def?.archived ? "removed" : null].filter(Boolean).join(" · ") || "Custom",
        value,
        sortOrder: def?.sortOrder ?? 99,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const rows = [...builtinRows, ...customRows];
  const backlogSessions = day.sessions.filter((s) => s.isBacklogTotal);

  return (
    <div className="bg-card border border-brand-gold/15 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground">{formatLongDate(dateKeyStr)}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Logged: {day.sessions.map((s) => SESSION_LABELS[s.sessionType] ?? s.sessionType).join(", ")}
        </p>
      </div>

      {backlogSessions.length > 0 && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-foreground/90">
          {backlogSessions.some((s) => s.note?.startsWith("Monthly"))
            ? "Monthly total: these numbers were entered for the whole month, not just this one day."
            : "Weekly total: these numbers were entered for the whole week, not just this one day."}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">A log was saved for this day, but no stat values were entered.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3 py-3">
              <div className="flex flex-col">
                <span className="text-sm text-foreground">{row.label}</span>
                <span className="text-[11px] text-muted-foreground">{row.alias}</span>
              </div>
              <span className="text-2xl font-bold text-foreground tabular-nums">{row.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {day.sessions.length > 1 && rows.length > 0 && (
        <details className="text-xs">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[var(--gold)] underline underline-offset-4">Show by session</summary>
          <div className="mt-2 space-y-2">
            {day.sessions.map((s) => (
              <div key={s.sessionType} className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="font-semibold text-foreground mb-1">{SESSION_LABELS[s.sessionType] ?? s.sessionType}</p>
                <p className="text-muted-foreground">
                  {[
                    ...BUILTIN_STATS.filter((st) => typeof s.builtin[st.key] === "number").map(
                      (st) => `${st.alias}: ${s.builtin[st.key]}`
                    ),
                    ...Object.entries(s.custom).map(([id, v]) => `${customById.get(id)?.name ?? "Custom"}: ${v}`),
                  ].join(" · ") || "No values"}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default function WwldHistory() {
  const today = getTodayDate();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [selected, setSelected] = useState(today);

  const historyQuery = trpc.wwld.getHistory.useQuery({ year });
  const data = historyQuery.data;

  const dayMap = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d])), [data]);
  const loggedDates = useMemo(() => new Set(dayMap.keys()), [dayMap]);

  const changeYear = (delta: number) => {
    const next = year + delta;
    if (next > currentYear) return;
    setYear(next);
    setSelected(next === currentYear ? today : `${next}-12-31`);
  };

  const selectDay = (key: string) => {
    setSelected(key);
    document.getElementById("history-day-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectedInYear = selected.startsWith(`${year}-`);

  return (
    <div className="readable min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background border-b border-brand-gold/15 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between max-w-4xl mx-auto gap-2">
          <div className="flex items-center gap-3">
            <Link href="/wwld" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted" aria-label="Back to Log Stats">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <CalendarDays className="hidden w-6 h-6 text-[var(--gold)] sm:block" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Stats History</h1>
              <p className="text-xs text-muted-foreground">Tap any day to see what you logged</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => changeYear(-1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted" aria-label="Previous year">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-bold text-foreground w-14 text-center">{year}</span>
            <button
              type="button"
              onClick={() => changeYear(1)}
              disabled={year >= currentYear}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-40"
              aria-label="Next year"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 py-5 space-y-5 sm:px-4">
        {historyQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : historyQuery.isError || !data ? (
          <p className="text-sm text-destructive text-center py-8">Could not load your history. Please refresh.</p>
        ) : (
          <>
            <p className="text-base text-muted-foreground">
              {loggedDates.size === 0
                ? `No stats logged in ${year}.`
                : `${loggedDates.size} day${loggedDates.size === 1 ? "" : "s"} with stats logged in ${year}.`}
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-base text-foreground" aria-label="Calendar key">
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 flex-col items-center justify-center rounded-md bg-[var(--gold)]/20 text-sm font-bold" aria-hidden="true">
                  5<span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-[var(--gold)]" />
                </span>
                Dot = stats logged
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md ring-2 ring-[var(--gold)] text-sm" aria-hidden="true">5</span>
                Ring = today
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gold)] text-sm font-bold text-black" aria-hidden="true">5</span>
                Filled = selected
              </li>
            </ul>

            <div id="history-day-detail" className="scroll-mt-24">
              {selectedInYear && <DayDetail dateKeyStr={selected} day={dayMap.get(selected)} data={data} />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MONTHS.map((_, month) => (
                <MonthGrid
                  key={month}
                  year={year}
                  month={month}
                  loggedDates={loggedDates}
                  selected={selected}
                  today={today}
                  onSelect={selectDay}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
