import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen, Lock } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  isModuleUnlockedAtIndex,
  sortModulesForUnlock,
} from "@shared/curriculumUnlock";

export default function Curriculum() {
  const [, setLocation] = useLocation();
  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  // Stable order + unlock math must match server assertModuleUnlocked / modules.list
  const ordered = useMemo(
    () => (modules ? sortModulesForUnlock(modules) : []),
    [modules]
  );

  const isModuleUnlocked = (index: number): boolean => {
    // Prefer server-computed unlocked when present; fall back to shared helper
    const fromServer = ordered[index]?.unlocked;
    if (typeof fromServer === "boolean") return fromServer;
    return isModuleUnlockedAtIndex(ordered, index);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Curriculum
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete each module in order to unlock the next.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-card border-brand-gold/15 animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded-lg w-8 mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-2 bg-muted rounded w-full mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : ordered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((mod, index) => {
            const unlocked = isModuleUnlocked(index);
            const usesCoachingSteps = mod.stepCount > 0;
            const completedItems = usesCoachingSteps ? mod.completedStepCount : mod.completedCount;
            const totalItems = usesCoachingSteps ? mod.stepCount : mod.lessonCount;
            const progressLabel = usesCoachingSteps ? "steps" : "lessons";
            const modProgress =
              totalItems > 0
                ? Math.round((completedItems / totalItems) * 100)
                : 0;
            const prevModTitle = index > 0 ? ordered[index - 1]?.title : "";
            // Never show Lock + Complete together (finishability / badge integrity)
            const showComplete = unlocked && mod.moduleComplete;

            return (
              <Card
                key={mod.id}
                className={`bg-card border-brand-gold/15 transition-all ${
                  unlocked
                    ? "cursor-pointer hover:border-primary/50 group"
                    : "opacity-60 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (unlocked) {
                    setLocation(`/curriculum/${mod.id}`);
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl">{mod.iconEmoji || "📘"}</div>
                    {!unlocked ? (
                      <Lock className="h-5 w-5 text-muted-foreground/60" />
                    ) : showComplete ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--gold)", color: "#1a1a1a" }}>
                        Complete
                      </span>
                    ) : null}
                  </div>
                  <h3
                    className={`font-semibold text-lg ${
                      unlocked
                        ? "text-foreground group-hover:text-primary transition-colors"
                        : "text-muted-foreground"
                    }`}
                  >
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {mod.description}
                    </p>
                  )}

                  {unlocked ? (
                    <div className="mt-4 flex items-center gap-3">
                      <Progress value={modProgress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {completedItems}/{totalItems} {progressLabel}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-muted-foreground italic">
                      Complete "{prevModTitle}" first
                    </p>
                  )}

                  {mod.status === "draft" && (
                    <span className="inline-block mt-3 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      Draft
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-card border-brand-gold/15">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No modules yet
            </h3>
            <p className="text-muted-foreground">
              Curriculum content is being prepared. Check back soon!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
