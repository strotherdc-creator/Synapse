import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Minus, Plus, CheckCircle2 } from "lucide-react";

type SessionType = "morning" | "afternoon" | "end_of_day";

interface StatField {
  key: keyof StatValues;
  label: string;
  alias: string;
}

interface StatValues {
  officeVisits: number;
  newPatients: number;
  recall: number;
  testResults: number;
  progressExams: number;
  performanceReviews: number;
  carePlansSigned: number;
}

const STAT_FIELDS: StatField[] = [
  { key: "officeVisits", label: "Office Visits", alias: "OV" },
  { key: "newPatients", label: "New Patients", alias: "Day 1" },
  { key: "recall", label: "Recall", alias: "RC" },
  { key: "testResults", label: "Test Results", alias: "Day 2" },
  { key: "progressExams", label: "Progress Exams", alias: "PE" },
  { key: "performanceReviews", label: "Performance Reviews", alias: "PR" },
  { key: "carePlansSigned", label: "Care Plans Signed", alias: "CPS" },
];

const SESSION_LABELS: Record<SessionType, string> = {
  morning: "Morning Stats",
  afternoon: "Afternoon Stats",
  end_of_day: "End of Day Stats",
};

interface StatEntryFormProps {
  sessionType: SessionType;
  sessionDate: string; // YYYY-MM-DD
  initialValues?: Partial<StatValues>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StatEntryForm({
  sessionType,
  sessionDate,
  initialValues,
  onSuccess,
  onCancel,
}: StatEntryFormProps) {
  const [values, setValues] = useState<StatValues>({
    officeVisits: initialValues?.officeVisits ?? 0,
    newPatients: initialValues?.newPatients ?? 0,
    recall: initialValues?.recall ?? 0,
    testResults: initialValues?.testResults ?? 0,
    progressExams: initialValues?.progressExams ?? 0,
    performanceReviews: initialValues?.performanceReviews ?? 0,
    carePlansSigned: initialValues?.carePlansSigned ?? 0,
  });
  const [submitted, setSubmitted] = useState(false);

  const utils = trpc.useUtils();
  const logSession = trpc.wwld.logSession.useMutation({
    onSuccess: () => {
      // Invalidate ALL wwld queries so every tab and chart refreshes immediately
      utils.wwld.getToday.invalidate();
      utils.wwld.getTodayStatus.invalidate();
      utils.wwld.getStats.invalidate();
      utils.wwld.getAnalytics.invalidate();
      setSubmitted(true);
      setTimeout(() => {
        onSuccess?.();
      }, 1200);
    },
  });

  const adjust = (key: keyof StatValues, delta: number) => {
    setValues((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(9999, prev[key] + delta)),
    }));
  };

  const handleDirectInput = (key: keyof StatValues, raw: string) => {
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      setValues((prev) => ({ ...prev, [key]: Math.max(0, Math.min(9999, num)) }));
    } else if (raw === "") {
      setValues((prev) => ({ ...prev, [key]: 0 }));
    }
  };

  const handleSubmit = () => {
    logSession.mutate({
      sessionDate,
      sessionType,
      ...values,
    });
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <CheckCircle2 className="w-12 h-12 text-[var(--gold)]" />
        <p className="text-lg font-semibold text-foreground">Stats logged!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold text-foreground">
          {SESSION_LABELS[sessionType]}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{sessionDate}</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {STAT_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">
                {field.label}
              </span>
              <span className="text-xs text-muted-foreground">{field.alias}</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => adjust(field.key, -1)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                aria-label={`Decrease ${field.label}`}
              >
                <Minus className="w-4 h-4 text-foreground" />
              </button>
              <input
                type="number"
                min={0}
                max={9999}
                value={values[field.key]}
                onChange={(e) => handleDirectInput(field.key, e.target.value)}
                className="w-14 text-center text-lg font-bold text-foreground bg-transparent border-b border-border focus:outline-none focus:border-[var(--gold)]"
              />
              <button
                onClick={() => adjust(field.key, 1)}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                aria-label={`Increase ${field.label}`}
              >
                <Plus className="w-4 h-4 text-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-2">
        {onCancel && (
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={logSession.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-black font-bold"
          onClick={handleSubmit}
          disabled={logSession.isPending}
        >
          {logSession.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : null}
          Log Stats
        </Button>
      </div>

      {logSession.isError && (
        <p className="text-sm text-destructive text-center">
          Failed to save. Please try again.
        </p>
      )}
    </div>
  );
}
