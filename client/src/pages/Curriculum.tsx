import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { BookOpen, CheckCircle2, Lock } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";
import { moduleCardStates } from "@shared/curriculumProgress";
import { ContinueCurriculumButton } from "@/components/curriculum/ContinueCurriculumButton";

export default function Curriculum() {
  const [, setLocation] = useLocation();
  const { data: modules, isLoading } = trpc.modules.list.useQuery();

  // Stable order + unlock math match server assertModuleUnlocked / modules.list.
  // Defense-in-depth: never render drafts on learner Curriculum (server list is published-only).
  const cards = useMemo(() => moduleCardStates(modules), [modules]);

  return (
    <div className="readable space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Curriculum</h1>
        <p className="text-lg text-muted-foreground mt-1">
          Do the modules in order. Finishing one opens the next.
        </p>
      </div>

      <ContinueCurriculumButton />

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
      ) : cards.length > 0 ? (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((mod) => {
            const { card } = mod;
            const content = (
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-base font-semibold text-muted-foreground">
                    Module {card.moduleNumber}
                  </span>
                  {!card.unlocked ? (
                    <Lock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  ) : card.complete ? (
                    <CheckCircle2 className="h-6 w-6 text-gold" aria-hidden="true" />
                  ) : null}
                </div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                  <span className="text-2xl" aria-hidden="true">{mod.iconEmoji || "📘"}</span>
                  <span>{mod.title}</span>
                </h2>
                {mod.description && (
                  <p className="text-base text-muted-foreground mt-2">{mod.description}</p>
                )}
                {card.unlocked && card.total > 0 && (
                  <Progress value={card.percent} className="h-2.5 mt-4" aria-hidden="true" />
                )}
                <p
                  className={`mt-3 text-lg font-semibold ${
                    !card.unlocked ? "text-muted-foreground" : card.complete ? "text-gold" : "text-foreground"
                  }`}
                >
                  {!card.unlocked && <span className="sr-only">Locked. </span>}
                  {card.label}
                </p>
              </CardContent>
            );
            return (
              <li key={mod.id}>
                {card.unlocked ? (
                  <button
                    type="button"
                    onClick={() => setLocation(`/curriculum/${mod.id}`)}
                    className="block w-full text-left rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Card className="bg-card border-brand-gold/30 hover:border-primary transition-colors">{content}</Card>
                  </button>
                ) : (
                  <Card className="bg-card/60 border-2 border-dashed border-gray-400/70" aria-disabled="true">
                    {content}
                  </Card>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <Card className="bg-card border-brand-gold/15">
          <CardContent className="p-12 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-foreground mb-2">No modules yet</h2>
            <p className="text-muted-foreground">Curriculum content is being prepared. Check back soon!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
