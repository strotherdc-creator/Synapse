import { trpc } from "@/lib/trpc";
import { nextCurriculumStep } from "@shared/curriculumProgress";
import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

/**
 * One big button straight to the learner's next unfinished step: "Continue: Module 2, Step 3".
 * Hidden while loading and when every open module is done.
 */
export function ContinueCurriculumButton({ className = "" }: { className?: string }) {
  const [, setLocation] = useLocation();
  const { data: modules } = trpc.modules.list.useQuery();
  const next = nextCurriculumStep(modules);
  if (!next) return null;
  return (
    <button
      type="button"
      onClick={() => setLocation(next.href)}
      className={`w-full min-h-[56px] text-left rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-4 flex items-center gap-3 shadow-lg transition-colors ${className}`}
      data-testid="continue-curriculum"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-xl font-bold leading-snug">{next.label}</span>
        <span className="block text-base text-blue-50 mt-0.5">{next.moduleTitle}</span>
      </span>
      <ChevronRight className="h-7 w-7 shrink-0" aria-hidden="true" />
    </button>
  );
}
