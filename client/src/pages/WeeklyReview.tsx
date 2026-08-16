import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, TrendingUp, Calendar, Target } from "lucide-react";

export default function WeeklyReview() {
  const { data, isLoading } = trpc.engagement.getDailyPlan.useQuery(undefined, {
    retry: 1,
    staleTime: 60_000,
  });

  // For now, show a summary of today's plan state as a preview of the review concept
  // The full weekly review will aggregate 7 days of data

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Weekly Review</h1>
          <p className="text-muted-foreground mt-1">Loading your progress...</p>
        </div>
        <Card className="border-border bg-card animate-pulse">
          <CardContent className="p-6 h-32" />
        </Card>
      </div>
    );
  }

  const completedCount = data?.actions?.filter((a: any) => a.status === "completed").length ?? 0;
  const totalCount = data?.actions?.length ?? 0;
  const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Weekly Review</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          How your practice growth actions are tracking this week.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center space-y-1">
            <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
            <p className="text-2xl font-bold text-foreground">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Actions Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center space-y-1">
            <Target className="h-6 w-6 text-primary mx-auto" />
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            <p className="text-xs text-muted-foreground">Total Actions</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center space-y-1">
            <TrendingUp className="h-6 w-6 text-amber-500 mx-auto" />
            <p className="text-2xl font-bold text-foreground">{rate}%</p>
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Insight */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium text-foreground">
            {rate >= 80
              ? "Strong week. Your consistency is building real practice momentum."
              : rate >= 50
              ? "Solid progress. Each completed action compounds over time."
              : rate > 0
              ? "You showed up this week. Even small steps move the needle."
              : "This week was quiet. One action tomorrow starts a new streak."}
          </p>
          <p className="text-xs text-muted-foreground">
            Focus: {(data as any)?.plan?.focus ?? data?.topic?.label ?? "New Patients & Referrals"}
          </p>
        </CardContent>
      </Card>

      {/* Completed actions list */}
      {completedCount > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">What you accomplished:</p>
          <div className="space-y-1">
            {data?.actions
              ?.filter((a: any) => a.status === "completed")
              .map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span>{a.title}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
