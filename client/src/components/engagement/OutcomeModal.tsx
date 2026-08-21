import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, X } from "lucide-react";

const OUTCOME_TYPES = [
  { value: "spoke", label: "Spoke to someone", emoji: "🗣️" },
  { value: "posted", label: "Posted content", emoji: "📱" },
  { value: "sent", label: "Sent a message", emoji: "✉️" },
  { value: "scheduled", label: "Scheduled something", emoji: "📅" },
  { value: "other", label: "Other action", emoji: "✅" },
] as const;

const CONFIDENCE_LEVELS = [
  { value: 1, label: "Not great" },
  { value: 2, label: "Okay" },
  { value: 3, label: "Good" },
  { value: 4, label: "Strong" },
  { value: 5, label: "Nailed it" },
];

interface OutcomeModalProps {
  actionId: number;
  actionTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function OutcomeModal({ actionId, actionTitle, onClose, onSuccess }: OutcomeModalProps) {
  const [outcomeType, setOutcomeType] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const recordMutation = trpc.engagement.recordOutcome.useMutation({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const handleSubmit = () => {
    if (!outcomeType) return;
    recordMutation.mutate({
      actionId,
      outcomeType: outcomeType as "spoke" | "posted" | "sent" | "scheduled" | "other",
      confidence: confidence ?? undefined,
      note: note.trim() || undefined,
    });
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md border-brand-gold/15 bg-card shadow-xl">
        <CardContent className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <h3 className="text-base font-semibold text-foreground">Quick reflection</h3>
              </div>
              <p className="text-xs text-muted-foreground">30 seconds — what happened?</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Action context */}
          <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2 border border-brand-gold/15">
            {actionTitle}
          </p>

          {/* Outcome type selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">What did you do?</p>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOME_TYPES.map(type => (
                <button
                  key={type.value}
                  onClick={() => setOutcomeType(type.value)}
                  className={`text-left text-xs p-2 rounded-md border transition-all ${
                    outcomeType === type.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-brand-gold/15 bg-card text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="mr-1">{type.emoji}</span> {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confidence rating */}
          {outcomeType && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">How'd it feel?</p>
              <div className="flex gap-1">
                {CONFIDENCE_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setConfidence(level.value)}
                    className={`flex-1 text-xs py-2 rounded-md border transition-all ${
                      confidence === level.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-brand-gold/15 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {level.value}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Not great</span>
                <span>Nailed it</span>
              </div>
            </div>
          )}

          {/* Optional note */}
          {outcomeType && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Quick note (optional)</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Who did you talk to? What did you say?"
                className="w-full text-xs p-2 rounded-md border border-brand-gold/15 bg-background text-foreground placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:ring-1 focus:ring-primary"
                maxLength={500}
              />
              <p className="text-[10px] text-muted-foreground">No patient names — practice behavior only.</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!outcomeType || recordMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white flex-1"
            >
              {recordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save reflection"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
