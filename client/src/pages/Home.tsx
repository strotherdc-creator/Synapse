import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, MessageSquare, Zap, Trophy, Target } from "lucide-react";
import { useLocation } from "wouter";
import { SessionPrompt } from "@/components/wwld/SessionPrompt";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  // Coaching step progress (primary metric)
  const totalSteps = modules?.reduce((sum, m) => sum + m.stepCount, 0) ?? 0;
  const completedSteps = modules?.reduce((sum, m) => sum + m.completedStepCount, 0) ?? 0;
  const stepProgressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Module completion count
  const completedModules = modules?.filter((m) => m.moduleComplete).length ?? 0;
  const totalModules = modules?.length ?? 0;

  return (
    <div className="space-y-8">
      {/* WWLD daily stats prompt */}
      <SessionPrompt />
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Welcome back{user?.name ? `, ${user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Continue your learning journey with Synapse.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-brand-gold/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overall Progress
            </CardTitle>
            <Zap className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gold">{stepProgressPercent}%</div>
            <Progress value={stepProgressPercent} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completedSteps} of {totalSteps} steps completed
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-brand-gold/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Modules Completed
            </CardTitle>
            <Trophy className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {completedModules} / {totalModules}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedModules === totalModules && totalModules > 0
                ? "All modules complete!"
                : completedModules > 0
                  ? "Keep going!"
                  : "Start your first module"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-brand-gold/15">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Steps Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {completedSteps} / {totalSteps}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Coaching steps across all modules</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card border-brand-gold/15 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setLocation("/chat")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Assistant
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-foreground">Ask Synapse</div>
            <p className="text-xs text-muted-foreground mt-1">
              Get help with any lesson
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Module list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Your Modules</h2>
          <button
            onClick={() => setLocation("/curriculum")}
            className="text-sm text-gold hover:underline"
          >
            View all
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card border-brand-gold/15 animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : modules && modules.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((mod) => {
              const usesCoachingSteps = mod.stepCount > 0;
              const completedItems = usesCoachingSteps ? mod.completedStepCount : mod.completedCount;
              const totalItems = usesCoachingSteps ? mod.stepCount : mod.lessonCount;
              const progressLabel = usesCoachingSteps ? "steps" : "lessons";
              const modProgress =
                totalItems > 0
                  ? Math.round((completedItems / totalItems) * 100)
                  : 0;
              return (
                <Card
                  key={mod.id}
                  className="bg-card border-brand-gold/15 cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => setLocation(`/curriculum/${mod.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{mod.iconEmoji || "📘"}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-gold transition-colors">
                            {mod.title}
                          </h3>
                          {mod.moduleComplete && (
                            <CheckCircle2 className="h-4 w-4 text-gold flex-shrink-0" />
                          )}
                        </div>
                        {mod.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {mod.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={modProgress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {completedItems}/{totalItems} {progressLabel}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-brand-gold/15">
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                No modules available yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
