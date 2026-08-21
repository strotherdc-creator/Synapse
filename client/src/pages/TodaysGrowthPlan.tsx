import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, Flame, Trophy, Target, Copy, ExternalLink, ArrowLeft, RefreshCw } from "lucide-react";

export default function TodaysGrowthPlan() {
  const [, setLocation] = useLocation();
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
    },
    onError: (err: any) => toast.error(err.message),
  });
  const completeMutation = trpc.engagement.completeAction.useMutation({
    onMutate: async (vars) => {
      // Optimistic: move the action from pending to completed immediately
      await utils.engagement.getDailyPlan.cancel();
      const prev = utils.engagement.getDailyPlan.getData();
      if (prev && prev.status === "active") {
        const updated = {
          ...prev,
          actions: prev.actions.map((a: any) =>
            a.id === vars.actionId ? { ...a, status: "completed" } : a
          ),
        };
        utils.engagement.getDailyPlan.setData(undefined, updated as any);
      }
      return { prev };
    },
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
      utils.routine.getStreak.invalidate();
      toast.success("Done! Pick your next action.");
    },
    onError: (err: any, _vars: any, context: any) => {
      if (context?.prev) utils.engagement.getDailyPlan.setData(undefined, context.prev);
      toast.error(err.message);
    },
  });
  const deferMutation = trpc.engagement.deferAction.useMutation({
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });
  const cancelMutation = trpc.engagement.cancelAction.useMutation({
    onMutate: async () => {
      // Optimistic: immediately show the picker by setting plan data to needs_pick
      await utils.engagement.getDailyPlan.cancel();
      const prev = utils.engagement.getDailyPlan.getData();
      // Preserve completed actions so checkmarks remain visible
      const completedFromPrev = (prev as any)?.actions?.filter((a: any) => a.status === "completed") ?? [];
      if (completedFromPrev.length > 0) {
        // Plan still exists with completed actions — show picker but keep completed list
        utils.engagement.getDailyPlan.setData(undefined, {
          status: "active" as const,
          actions: completedFromPrev,
          lyleRecommendation: (prev as any)?.lyleRecommendation ?? undefined,
          topic: (prev as any)?.topic ?? undefined,
          plan: (prev as any)?.plan,
          completedCount: completedFromPrev.length,
          totalCount: completedFromPrev.length,
        } as any);
      } else {
        utils.engagement.getDailyPlan.setData(undefined, { status: "needs_pick" as const, actions: [], lyleRecommendation: (prev as any)?.lyleRecommendation ?? undefined, topic: (prev as any)?.topic ?? undefined });
      }
      return { prev };
    },
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
    },
    onError: (err: any, _vars: any, context: any) => {
      // Rollback on error
      if (context?.prev) utils.engagement.getDailyPlan.setData(undefined, context.prev);
      toast.error(err.message);
    },
  });
  const refreshMutation = trpc.engagement.refreshAction.useMutation({
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
      toast.success("Here's a different one.");
    },
    onError: (err: any) => toast.error(err.message),
  });
  const selectTopicMutation = trpc.engagement.selectTopic.useMutation({
    onSuccess: () => {
      utils.engagement.getDailyPlan.invalidate();
      toast.success("Topic updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Local state
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const data = planQuery.data;
  const streak = streakQuery.data;
  const categories = categoriesQuery.data?.categories ?? [];
  const curriculum = curriculumQuery.data;

  // Copy script to clipboard
  const handleCopy = async (text: string, actionId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(actionId);
      toast.success("Copied!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Pick a single action — creates a plan with just that one action
  const handlePickAction = (key: string) => {
    // Direct navigation for AI Coach and Curriculum — no action card needed
    if (key === "ai_coach") {
      setLocation("/chat");
      return;
    }
    if (key === "curriculum_lesson") {
      setLocation("/curriculum");
      return;
    }
    // Send just the one action — server accepts 1+
    pickMutation.mutate({ actionKeys: [key] });
  };

  // Loading state
  if (planQuery.isLoading) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-6">
        <div className="h-12 bg-muted rounded-xl animate-pulse" />
        <div className="h-40 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (planQuery.error) {
    if ((planQuery.error as any).data?.code === "FORBIDDEN") {
      return (
        <div className="max-w-xl mx-auto p-6">
          <h1 className="text-4xl font-bold text-white">Today's Plan</h1>
          <p className="text-xl text-gray-300 mt-3">Coming soon.</p>
        </div>
      );
    }
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-4xl font-bold text-white">Today's Plan</h1>
        <p className="text-xl text-red-300 mt-3">Something went wrong. Pull down to refresh.</p>
      </div>
    );
  }

  const completedActions = data?.status === "active" ? data.actions.filter((a: any) => a.status === "completed") : [];
  const pendingActions = data?.status === "active" ? data.actions.filter((a: any) => a.status === "pending") : [];
  const currentAction = pendingActions.length > 0 ? pendingActions[0] : null;

  return (
    <div className="max-w-xl mx-auto p-5 space-y-8">
      {/* Header — large, readable */}
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Today's Plan</h1>
        <p className="text-xl text-gray-300 mt-2">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Streak — big numbers */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Flame className="h-7 w-7 text-orange-400" />
          <span className="text-2xl font-bold text-gold">{streak?.currentStreak ?? 0}</span>
          <span className="text-base text-gray-400">day streak</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          <span className="text-2xl font-bold text-gold">{completedActions.length}</span>
          <span className="text-base text-gray-400">done today</span>
        </div>
      </div>

      {/* Lyle Recommendation */}
      {data?.lyleRecommendation && (
        <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl px-4 py-3">
          <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">💡 Lyle says</p>
          <p className="text-base font-semibold text-white mt-1 line-clamp-2">
            {data.lyleRecommendation.actionText}
          </p>
        </div>
      )}

      {/* Topic — right above the action area */}
      <div className="flex items-center gap-3">
        <span className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-lg">
          Topic: {data?.topic?.label ?? "General Corrective Care"}
        </span>
        <button
          onClick={() => setShowTopicPicker(!showTopicPicker)}
          className="text-lg text-gray-400 hover:text-white underline"
        >
          Change
        </button>
      </div>

      {/* Topic Picker */}
      {showTopicPicker && (
        <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 space-y-4">
          {/* Custom topic CTA — at the very top */}
          <a
            href="/curriculum"
            className="block w-full text-center py-4 px-6 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-colors"
          >
            🎯 Want a Custom Topic? Complete Your Modules
          </a>

          <p className="text-xl font-bold text-gold">Or pick a pre-built focus:</p>
          <div className="space-y-3">
            {topicsQuery.data?.topics.map((t: any) => (
              <button
                key={t.id}
                onClick={() => { selectTopicMutation.mutate({ topicId: t.id }); setShowTopicPicker(false); }}
                className={`w-full text-left p-5 rounded-xl border-2 transition-colors ${
                  data?.topic?.id === t.id ? "border-emerald-500 bg-emerald-500/10" : "border-gray-600 hover:border-emerald-500/50"
                }`}
              >
                <p className="text-xl font-bold text-white">{t.label}</p>
                <p className="text-lg text-gray-300 mt-1">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── CURRENT ACTION (one at a time) ─── */}
      {currentAction && (
        <div className="space-y-4">
          {/* Topic badge — always visible with the action */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-sm">
              {data?.topic?.label ?? "General Corrective Care"}
            </span>
            <button
              onClick={() => setShowTopicPicker(!showTopicPicker)}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              Change
            </button>
          </div>

          {/* Back and refresh buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => cancelMutation.mutate({ actionId: currentAction.id })}
              disabled={cancelMutation.isPending}
              className="flex items-center gap-1 text-lg text-gray-300 hover:text-white transition-colors font-semibold"
            >
              <ArrowLeft className="h-7 w-7 stroke-[3]" />
              {cancelMutation.isPending ? "..." : "Back"}
            </button>
            <button
              onClick={() => refreshMutation.mutate({ actionId: currentAction.id })}
              disabled={refreshMutation.isPending}
              className="flex items-center gap-2 text-lg text-gray-300 hover:text-white transition-colors font-semibold"
            >
              <RefreshCw className={`h-5 w-5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              {refreshMutation.isPending ? "Loading..." : "Different script"}
            </button>
          </div>

          <div className="rounded-2xl border-2 border-emerald-500/40 bg-gray-800/80 overflow-hidden">
            <div className="p-6">
              <p className="text-2xl font-bold text-white leading-snug">
                {currentAction.title}
              </p>
            </div>

            {/* The content — large, readable */}
            {currentAction.script && (
              <div className="px-6 pb-6 space-y-4">
                {(() => {
                  // Try to parse as sectioned JSON; fall back to plain text
                  try {
                    const parsed = JSON.parse(currentAction.script!);
                    if (parsed.sections) {
                      return parsed.sections.map((section: any, idx: number) => (
                        <div key={idx} className="bg-gray-900 rounded-xl p-5 border border-gray-700">
                          <p className="text-sm font-bold text-emerald-300 uppercase tracking-wide mb-3">{section.label}</p>
                          <pre className="whitespace-pre-wrap text-base text-gray-100 font-sans leading-relaxed">
                            {section.content}
                          </pre>
                          {section.copyable && (
                            <button
                              onClick={() => handleCopy(section.content, currentAction.id * 100 + idx)}
                              className="mt-3 w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-colors"
                            >
                              <Copy className="h-5 w-5" />
                              {copiedId === currentAction.id * 100 + idx ? "Copied!" : `Copy ${section.label}`}
                            </button>
                          )}
                        </div>
                      ));
                    }
                  } catch {}
                  // Plain text fallback (referral, outreach, community, etc.)
                  return (
                    <>
                      <div className="bg-gray-900 rounded-xl p-5 border border-gray-700">
                        <pre className="whitespace-pre-wrap text-base text-gray-100 font-sans leading-relaxed">
                          {currentAction.script}
                        </pre>
                      </div>
                      <button
                        onClick={() => handleCopy(currentAction.script!, currentAction.id)}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 transition-colors"
                      >
                        <Copy className="h-5 w-5" />
                        {copiedId === currentAction.id ? "Copied!" : "Copy to Clipboard"}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Mark done */}
            <div className="px-6 pb-6">
              <button
                onClick={() => completeMutation.mutate({ actionId: currentAction.id })}
                disabled={completeMutation.isPending}
                className="w-full py-4 rounded-xl bg-emerald-600 text-white text-lg font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {completeMutation.isPending ? "Saving..." : "✓ Done — What's Next?"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PICK NEXT ACTION (always available) ─── */}
      {(data?.status === "needs_pick" || !currentAction) && (
        <div className="space-y-4">
          <p className="text-lg font-bold text-gray-300 uppercase tracking-wide">
            {completedActions.length > 0 ? "Pick Your Next Action" : "What do you want to do first?"}
          </p>
          <div className="space-y-3">
            {categories.map((cat: any) => (
              <button
                key={cat.key}
                onClick={() => handlePickAction(cat.key)}
                disabled={pickMutation.isPending}
                className="w-full text-left p-5 rounded-2xl border-2 border-gray-600 hover:border-emerald-500 bg-gray-800 hover:bg-gray-800/80 transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{cat.icon}</span>
                  <div className="flex-1">
                    <p className="text-xl font-bold text-white">{cat.label}</p>
                    <p className="text-base text-gray-400 mt-1">{cat.description}</p>
                  </div>
                  {completedActions.some((a: any) => a.sourceRef === cat.key) && (
                    <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Done for today button — shows after at least 1 completion */}
          {completedActions.length > 0 && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="w-full py-4 rounded-xl bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 transition-colors mt-4"
            >
              ✓ Done for Today
            </button>
          )}
        </div>
      )}

      {/* ─── COMPLETED TODAY ─── */}
      {completedActions.length > 0 && (
        <div className="space-y-3">
          <p className="text-lg font-bold text-gray-300 uppercase tracking-wide">Completed Today</p>
          {completedActions.map((action: any) => (
            <div key={action.id} className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
              <p className="text-base text-emerald-200 line-through">{action.title}</p>
            </div>
          ))}
          {completedActions.length >= 3 && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-6 text-center">
              <Trophy className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-white">All done for today!</h3>
              <p className="text-lg text-gray-300 mt-2">
                Streak: <span className="font-bold text-emerald-400">{streak?.currentStreak ?? 1} days</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── CURRICULUM REMINDER ─── */}
      {curriculum && !curriculum.allComplete && (
        <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 space-y-4">
          <a
            href={`/curriculum/${curriculum.incompleteModules[0]?.id}/coaching`}
            className="flex items-center justify-center w-full py-4 px-6 rounded-xl bg-blue-600 text-white font-bold text-lg hover:bg-blue-700 transition-colors"
          >
            📚 Continue Curriculum
          </a>
          <p className="text-base text-gray-400">
            Complete your modules to unlock fully customized scripts and positioning.
          </p>
          <div className="space-y-2">
            {curriculum.incompleteModules.map((mod: any) => (
              <a
                key={mod.id}
                href={`/curriculum/${mod.id}/coaching`}
                className="flex items-center gap-3 p-4 rounded-xl border border-gray-600 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-base font-semibold text-white">{mod.title}</p>
                  <p className="text-sm text-gray-400">{mod.completedSteps}/{mod.totalSteps} steps</p>
                </div>
                <div className="w-20 bg-gray-700 rounded-full h-2.5">
                  <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${mod.percentComplete}%` }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* AI Coach */}
      <a
        href="/chat"
        className="block w-full text-center py-4 rounded-2xl border-2 border-gray-600 hover:border-blue-500 text-xl font-bold text-gray-300 hover:text-white transition-colors"
      >
        💬 Ask the AI Coach
      </a>
    </div>
  );
}
