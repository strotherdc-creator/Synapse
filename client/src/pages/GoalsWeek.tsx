/**
 * This week vs your goals — the week so far (Mon–Sun, New York calendar) compared with the full
 * week's goal, then each day's logged numbers. Weekly/monthly "Log Past Stats" totals count in the
 * week total but never in a single day.
 */
import { Link } from "wouter";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { shortDate, weekdayShort } from "@/components/goals/GoalsComparison";
import { formatWhole, type MetricActual } from "@shared/goalsComparison";

type Cols = { visits: boolean; np: boolean; money: boolean };

function cell(metric: "officeVisits" | "newPatients" | "revenue", a: MetricActual, show: boolean) {
  if (!show) return null;
  return a.logged ? (
    <td className="py-3 pl-2 text-right text-lg tabular-nums">{formatWhole(metric, a.value)}</td>
  ) : (
    <td className="py-3 pl-2 text-right text-base text-muted-foreground">Not logged</td>
  );
}

export default function GoalsWeek() {
  const query = trpc.goals.getComparison.useQuery(undefined, { staleTime: 30_000 });
  const data = query.data;
  const week = data?.periods.find((p) => p.period === "week");
  // Which goal metrics are tracked (a stat unchecked in Log Stats shows "Not tracked" above).
  const tracked = new Set<string>((week?.metrics ?? []).filter((m) => m.result.status !== "not_tracked").map((m) => m.metric));
  const cols: Cols = { visits: tracked.has("officeVisits"), np: tracked.has("newPatients"), money: tracked.has("revenue") };

  return (
    <div className="readable min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-brand-gold/15 bg-background px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/goals"
            aria-label="Back to Goals"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">This week, day by day</h1>
            {data && data.week.length === 7 ? (
              <p className="text-base text-muted-foreground">
                {weekdayShort(data.week[0].date)} {shortDate(data.week[0].date)} – {weekdayShort(data.week[6].date)} {shortDate(data.week[6].date)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-3 py-5 sm:px-4">
        {query.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : query.isError || !data || !week ? (
          <p className="py-8 text-center text-base text-destructive">Could not load this week. Please refresh.</p>
        ) : (
          <section className="rounded-xl border border-border bg-card px-3 py-2" aria-label="Each day this week">
            <table className="w-full text-foreground">
              <thead>
                <tr className="border-b border-border text-base text-muted-foreground">
                  <th className="py-2 text-left font-semibold">Day</th>
                  {cols.visits ? <th className="py-2 pl-2 text-right font-semibold">Visits</th> : null}
                  {cols.np ? <th className="py-2 pl-2 text-right font-semibold">New pts</th> : null}
                  {cols.money ? <th className="py-2 pl-2 text-right font-semibold">Collected</th> : null}
                </tr>
              </thead>
              <tbody>
                {data.week.map((d) => {
                  const span = (cols.visits ? 1 : 0) + (cols.np ? 1 : 0) + (cols.money ? 1 : 0);
                  const anyLogged = d.officeVisits.logged || d.newPatients.logged || d.revenue.logged;
                  // A whole day with nothing logged gets ONE plain line instead of a row of blanks.
                  const wholeRow = d.future ? "Coming up" : !anyLogged ? (d.dayType === "off" ? "Day off" : "Not logged") : null;
                  return (
                    <tr key={d.date} className="border-b border-border" data-date={d.date}>
                      <td className="py-3 text-lg font-semibold">
                        {weekdayShort(d.date)} {shortDate(d.date).split(" ")[1]}
                        {d.dayType === "off" && anyLogged ? <span className="block text-base font-normal text-muted-foreground">Day off</span> : null}
                      </td>
                      {wholeRow !== null && span > 0 ? (
                        <td colSpan={span} className="py-3 pl-2 text-right text-base text-muted-foreground">{wholeRow}</td>
                      ) : (
                        <>
                          {cell("officeVisits", d.officeVisits, cols.visits)}
                          {cell("newPatients", d.newPatients, cols.np)}
                          {cell("revenue", d.revenue, cols.money)}
                        </>
                      )}
                    </tr>
                  );
                })}
                {data.weekTotal ? (
                  <tr className="font-bold" data-row="total">
                    <td className="py-3 text-lg">Week total</td>
                    {cell("officeVisits", data.weekTotal.officeVisits, cols.visits)}
                    {cell("newPatients", data.weekTotal.newPatients, cols.np)}
                    {cell("revenue", data.weekTotal.revenue, cols.money)}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
