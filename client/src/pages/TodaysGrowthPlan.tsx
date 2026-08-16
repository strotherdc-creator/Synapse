import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, Flame, Trophy, Target, Copy, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

export default function TodaysGrowthPlan() {
  const utils = trpc.useUtils();

  // Queries
  const planQuery = trpc.engagement.getDailyPlan.useQuery(undefined, { retry: 1 });
  const categoriesQuery = trpc.engagement.getActionCategories.useQuery();
  const topicsQuery = trpc.engagement.getTopics.useQuery();
  const curriculumQuery = trpc.engagement.getCurriculumReminder.useQuery();
  const streakQuery = trpc.routine.getStreak.useQuery();

  // Mutations
  const pickMutation = trpc.engagement.pickDailyActions.useMutation({
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
      toast.success("Let's go! Your actions are set.");
    },
    onError: (err: any) => toast.error(err.message),
  });
  const completeMutation = trpc.engagement.completeAction.useMutation({
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
      utils.routine.getStreak.invalidate();
      toast.success("Nice work! Action complete.");
    },
    onError: (err: any) => toast.error(err.message),
  });
  const selectTopicMutation = trpc.engagement.selectTopic.useMutation({
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
      toast.success("Topic updated! Your plan will refresh.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Local state
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [expandedAction, setExpandedAction] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const data = planQuery.data;
  const streak = streakQuery.data;
  const categories = categoriesQuery.data?.categories ?? [];
  const curriculum = curriculumQuery.data;

  // Handle action toggle in picker
  const toggleAction = (key: string) => {
    setSelectedActions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Submit picks
  const handleSubmitPicks = () => {
    if (selectedActions.length < 3) {
      toast.error("Pick at least 3 actions for today.");
      return;
    }
    pickMutation.mutate({ actionKeys: selectedActions });
  };

  // Copy script to clipboard
  const handleCopy = async (text: string, actionId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(actionId);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Loading state
  if (planQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  // Error state
  if (planQuery.error) {
    if ((planQuery.error as any).data?.code === "FORBIDDEN") {
      return (
        <div className="max-w-2xl mx-auto p-6">
          <h1 className="text-3xl font-bold">Today's Growth Plan</h1>
          <p className="text-lg text-muted-foreground mt-2">Coming soon — your personalized daily actions.</p>
        </div>
      );
    }
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold">Today's Growth Plan</h1>
        <p className="text-lg text-red-400 mt-2">Something went wrong. Please refresh.</p>
      </div>
    );
  }

  const completedCount = data?.status === "active" ? (data.completedCount ?? 0) : 0;
  const totalCount = data?.status === "active" ? (data.totalCount ?? 0) : 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Today's Growth Plan</h1>
        <p className="text-lg text-muted-foreground mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Streak & Progress */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Flame className="h-6 w-6 text-orange-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{streak?.currentStreak ?? 0}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{streak?.longestStreak ?? 0}</p>
          <p className="text-xs text-muted-foreground">Best Streak</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <Target className="h-6 w-6 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{completedCount}/{totalCount}</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </div>
      </div>

      {/* Progress Bar */}
      {data?.status === "active" && (
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Topic Badge + Change */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="px-3 py-1.5 rounded-full bg-primary/15 text-primary font-semibold text-sm">
          Focus: {data?.topic?.label ?? "General Corrective Care"}
        </span>
        <button
          onClick={() => setShowTopicPicker(!showTopicPicker)}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Change topic
        </button>
      </div>

      {/* Topic Picker */}
      {showTopicPicker && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-foreground mb-2">Pick your focus condition:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topicsQuery.data?.topics.map((t: any) => (
              <button
                key={t.id}
                onClick={() => { selectTopicMutation.mutate({ topicId: t.id }); setShowTopicPicker(false); }}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  data?.topic?.id === t.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
              >
                <p className="font-semibold text-sm text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Want a topic not on this list? Complete your coaching modules for a fully custom approach.
          </p>
        </div>
      )}

      {/* Lyle Recommendation */}
      {data?.lyleRecommendation && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-bold">Lyle Recommends</span>
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold">Priority</span>
          </div>
          <p className="text-base font-semibold text-foreground leading-relaxed">
            {data.lyleRecommendation.actionText}
          </p>
          <p className="text-sm text-muted-foreground mt-2 italic">
            Your {data.lyleRecommendation.metricTrigger} trend is "{data.lyleRecommendation.trendState}" — this targets your {data.lyleRecommendation.pillar} pillar.
          </p>
        </div>
      )}

      {/* ─── ACTION PICKER (when no plan yet) ─── */}
      {data?.status === "needs_pick" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Pick your 3 actions for today</h2>
            <p className="text-base text-muted-foreground mt-1">
              Choose at least 3. These become your daily checklist.
            </p>
          </div>

          <div className="space-y-2">
            {categories.map((cat: any) => {
              const isSelected = selectedActions.includes(cat.key);
              return (
                <button
                  key={cat.key}
                  onClick={() => toggleAction(cat.key)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-foreground">{cat.label}</p>
                      <p className="text-sm text-muted-foreground">{cat.description}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSubmitPicks}
            disabled={selectedActions.length < 3 || pickMutation.isPending}
            className="w-full py-4 rounded-xl bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pickMutation.isPending ? "Setting up..." : `Lock in ${selectedActions.length} action${selectedActions.length !== 1 ? "s" : ""}`}
          </button>

          {selectedActions.length > 0 && selectedActions.length < 3 && (
            <p className="text-sm text-amber-400 text-center">Pick at least 3 actions</p>
          )}
        </div>
      )}

      {/* ─── ACTIVE CHECKLIST (when plan exists) ─── */}
      {data?.status === "active" && data.actions && data.actions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">Your actions today</h2>

          {data.actions.map((action: any) => {
            const isCompleted = action.status === "completed";
            const isExpanded = expandedAction === action.id;

            return (
              <div
                key={action.id}
                className={`rounded-xl border-2 transition-all overflow-hidden ${
                  isCompleted ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card"
                }`}
              >
                {/* Action header */}
                <div className="p-4 flex items-start gap-3">
                  <button
                    onClick={() => !isCompleted && completeMutation.mutate({ actionId: action.id })}
                    disabled={isCompleted || completeMutation.isPending}
                    className={`mt-0.5 shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-muted-foreground hover:border-emerald-500"
                    }`}
                  >
                    {isCompleted && <CheckCircle2 className="h-5 w-5 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-base font-semibold leading-relaxed ${isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {action.title}
                    </p>
                    {action.whyNow && !isCompleted && (
                      <p className="text-sm text-muted-foreground mt-1">{action.whyNow}</p>
                    )}
                  </div>

                  {action.script && (
                    <button
                      onClick={() => setExpandedAction(isExpanded ? null : action.id)}
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  )}
                </div>

                {/* Expanded script/content */}
                {isExpanded && action.script && (
                  <div className="px-4 pb-4 border-t border-border pt-3">
                    <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed bg-muted/50 rounded-lg p-4">
                      {action.script}
                    </pre>
                    <button
                      onClick={() => handleCopy(action.script!, action.id)}
                      className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                      {copiedId === action.id ? "Copied!" : "Copy to clipboard"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* All complete celebration */}
          {progressPercent === 100 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <Trophy className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-foreground">All actions complete!</h3>
              <p className="text-base text-muted-foreground mt-1">
                Your streak is now <span className="font-bold text-emerald-400">{streak?.currentStreak ?? 1}</span> days!
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── CURRICULUM REMINDER ─── */}
      {curriculum && !curriculum.allComplete && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          {/* Quick jump button */}
          <a
            href={`/curriculum/${curriculum.incompleteModules[0]?.id}/coaching`}
            className="flex items-center justify-between w-full py-3.5 px-5 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary/90 transition-colors"
          >
            <span>📚 Continue Curriculum</span>
            <span className="text-sm opacity-80">{curriculum.incompleteModules[0]?.title}</span>
          </a>
          <h3 className="text-base font-bold text-foreground">Modules to complete</h3>
          <p className="text-sm text-muted-foreground">
            Finish these to unlock fully customized content, positioning, and referral language.
          </p>
          <div className="space-y-2">
            {curriculum.incompleteModules.map((mod: any) => (
              <a
                key={mod.id}
                href={`/curriculum/${mod.id}/coaching`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{mod.title}</p>
                  <p className="text-xs text-muted-foreground">{mod.completedSteps}/{mod.totalSteps} steps</p>
                </div>
                <div className="w-16 bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${mod.percentComplete}%` }} />
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
          <p className="text-xs text-muted-foreground italic">
            {curriculum.completedModules}/{curriculum.totalModules} modules complete
          </p>
        </div>
      )}

      {/* AI Coach link */}
      <a
        href="/chat"
        className="block w-full text-center py-3 rounded-xl border border-border hover:border-primary/40 text-base font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        💬 Have a question? Ask the AI Coach
      </a>
    </div>
  );
}
