import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ArrowRight, Sparkles, Target, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { OutcomeModal } from "@/components/engagement/OutcomeModal";

type ActionStatus = "pending" | "completed" | "deferred" | "skipped";

interface ActionCardProps {
  id: number;
  title: string;
  whyNow: string | null;
  script: string | null;
  estimateMinutes: number | null;
  pillar: string | null;
  required: boolean;
  status: ActionStatus;
  source: string;
  onComplete: (id: number) => void;
  onDefer: (id: number) => void;
  isCompleting: boolean;
  isDeferring: boolean;
}

function ActionCard({
  id, title, whyNow, script, estimateMinutes, pillar, required, status, source,
  onComplete, onDefer, isCompleting, isDeferring
}: ActionCardProps) {
  const [showScript, setShowScript] = useState(false);
  const isActive = status === "pending";
  const isDone = status === "completed";
  const isDeferred = status === "deferred";

  const sourceColors: Record<string, string> = {
    lyle: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    coaching: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    content: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    routine: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  const sourceLabels: Record<string, string> = {
    lyle: "Lyle Recommends",
    coaching: "From Your Coaching",
    content: "Content to Share",
    routine: "Daily Habit",
  };

  return (
    <Card className={`border transition-all ${isDone ? "border-green-500/30 bg-green-500/5 opacity-75" : isDeferred ? "border-muted opacity-60" : required ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${sourceColors[source] ?? "bg-muted text-muted-foreground border-border"}`}>
                {sourceLabels[source] ?? source}
              </span>
              {required && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30 font-medium">
                  Priority
                </span>
              )}
              {estimateMinutes && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> ~{estimateMinutes} min
                </span>
              )}
            </div>
            <p className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {title}
            </p>
          </div>
          {isDone && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
        </div>

        {/* Why now */}
        {whyNow && isActive && (
          <p className="text-xs text-muted-foreground italic">{whyNow}</p>
        )}

        {/* Script preview */}
        {script && isActive && (
          <div>
            <button
              onClick={() => setShowScript(!showScript)}
              className="text-xs text-primary flex items-center gap-1 hover:underline"
            >
              {showScript ? "Hide script" : "View script"} <ChevronRight className={`h-3 w-3 transition-transform ${showScript ? "rotate-90" : ""}`} />
            </button>
            {showScript && (
              <div className="mt-2 p-3 bg-muted/50 rounded-md text-xs text-foreground whitespace-pre-wrap border border-border">
                {script}
              </div>
            )}
          </div>
        )}

        {/* Pillar */}
        {pillar && isActive && (
          <p className="text-xs text-muted-foreground">
            <Target className="h-3 w-3 inline mr-1" />{pillar}
          </p>
        )}

        {/* Action buttons */}
        {isActive && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onComplete(id)}
              disabled={isCompleting || isDeferring}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isCompleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Done
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDefer(id)}
              disabled={isCompleting || isDeferring}
              className="text-muted-foreground"
            >
              {isDeferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Tomorrow
            </Button>
          </div>
        )}

        {/* Deferred state */}
        {isDeferred && (
          <p className="text-xs text-muted-foreground">Moved to tomorrow</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function TodaysGrowthPlan() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.engagement.getDailyPlan.useQuery(undefined, {
    retry: 1,
    staleTime: 30_000,
  });

  const completeMutation = trpc.engagement.completeAction.useMutation({
    onSuccess: () => utils.engagement.getDailyPlan.invalidate(),
  });

  const deferMutation = trpc.engagement.deferAction.useMutation({
    onSuccess: () => utils.engagement.getDailyPlan.invalidate(),
  });

  const [completingId, setCompletingId] = useState<number | null>(null);
  const [deferringId, setDeferringId] = useState<number | null>(null);
  const [outcomeAction, setOutcomeAction] = useState<{ id: number; title: string } | null>(null);

  const handleComplete = async (actionId: number) => {
    setCompletingId(actionId);
    try {
      await completeMutation.mutateAsync({ actionId });
      // Show outcome modal after successful completion
      const action = data?.actions.find(a => a.id === actionId);
      if (action) {
        setOutcomeAction({ id: actionId, title: action.title });
      }
    } finally {
      setCompletingId(null);
    }
  };

  const handleDefer = async (actionId: number) => {
    setDeferringId(actionId);
    try {
      await deferMutation.mutateAsync({ actionId });
    } finally {
      setDeferringId(null);
    }
  };

  // Feature not enabled — show a friendly placeholder
  if (error?.data?.code === "FORBIDDEN") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Today's Growth Plan</h1>
          <p className="text-muted-foreground mt-1">Coming soon — your personalized daily actions.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Today's Growth Plan</h1>
          <p className="text-muted-foreground mt-1">Building your plan...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-border bg-card animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const pendingCount = data.actions.filter(a => a.status === "pending").length;
  const completedCount = data.actions.filter(a => a.status === "completed").length;
  const allDone = pendingCount === 0 && data.actions.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Today's Growth Plan</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          {allDone
            ? "All done for today — great work!"
            : `${pendingCount} action${pendingCount !== 1 ? "s" : ""} to grow your practice today`}
        </p>
      </div>

      {/* Focus badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
          Focus: {data.plan.focus}
        </span>
        {completedCount > 0 && (
          <span className="text-xs text-green-600 font-medium">
            {completedCount}/{data.actions.length} completed
          </span>
        )}
      </div>

      {/* All done celebration */}
      {allDone && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
            <p className="text-lg font-semibold text-foreground">Practice growth actions complete</p>
            <p className="text-sm text-muted-foreground">
              You took {completedCount} step{completedCount !== 1 ? "s" : ""} toward growing your practice today. Come back tomorrow for fresh actions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action cards */}
      <div className="space-y-3">
        {data.actions.map((action) => (
          <ActionCard
            key={action.id}
            id={action.id}
            title={action.title}
            whyNow={action.whyNow}
            script={action.script}
            estimateMinutes={action.estimateMinutes}
            pillar={action.pillar}
            required={action.required}
            status={action.status as ActionStatus}
            source={action.source}
            onComplete={handleComplete}
            onDefer={handleDefer}
            isCompleting={completingId === action.id}
            isDeferring={deferringId === action.id}
          />
        ))}
      </div>

      {/* Empty state */}
      {data.actions.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-6 text-center space-y-2">
            <Target className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              No actions generated yet. Log your WWLD stats and complete some coaching steps to get personalized recommendations.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Outcome reflection modal */}
      {outcomeAction && (
        <OutcomeModal
          actionId={outcomeAction.id}
          actionTitle={outcomeAction.title}
          onClose={() => setOutcomeAction(null)}
          onSuccess={() => utils.engagement.getDailyPlan.invalidate()}
        />
      )}
    </div>
  );
}
