interface DayData {
  date: string; // YYYY-MM-DD
  officeVisits: number;
  newPatients: number;
  testResults: number;
  progressExams: number;
  performanceReviews: number;
  carePlansSigned: number;
}

interface WeekChartProps {
  data: DayData[];
  metric: keyof Omit<DayData, "date">;
  label: string;
  color?: string;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function WeekChart({
  data,
  metric,
  label,
  color = "var(--gold)",
}: WeekChartProps) {
  const values = data.map((d) => d[metric] as number);
  const max = Math.max(...values, 1); // avoid divide-by-zero

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="flex items-end gap-1 h-16">
        {data.map((day, i) => {
          const val = day[metric] as number;
          const pct = (val / max) * 100;
          return (
            <div key={day.date} className="flex flex-col items-center flex-1 gap-1">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {val > 0 ? val : ""}
              </span>
              <div className="w-full flex items-end" style={{ height: "40px" }}>
                <div
                  className="w-full rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${Math.max(pct, val > 0 ? 8 : 2)}%`,
                    backgroundColor: val > 0 ? color : "var(--border)",
                    opacity: val > 0 ? 1 : 0.4,
                  }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {formatDay(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
