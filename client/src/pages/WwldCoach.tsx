import { useState } from "react";
import { BarChart2, Loader2, Send } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ChatTurn = { role: "user" | "assistant"; content: string };

const SUGGESTED = [
  "What do my last 2 weeks of WWLD numbers say?",
  "Office visits are flat — what would Lyle have me do this week?",
  "New patients slipped. What's the one action?",
  "How should I read recall vs new patients?",
];

export default function WwldCoach() {
  const { getToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text) {
      toast.error("Ask a WWLD question first");
      return;
    }
    setLoading(true);
    const nextTurns = [...turns, { role: "user" as const, content: text }];
    setTurns(nextTurns);
    setQuestion("");
    try {
      const token = await getToken();
      const res = await fetch("/api/wwld-coach/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          history: nextTurns.slice(0, -1),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to get an answer");
      }
      const data = await res.json();
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: data.content || "No answer returned." },
      ]);
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      setTurns((prev) => prev.slice(0, -1));
      setQuestion(text);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTurns([]);
    setQuestion("");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
          <BarChart2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            WWLD Coach
            <span className="text-xs font-bold bg-yellow-600 text-black px-2 py-0.5 rounded-full">
              BETA
            </span>
          </h1>
          <p className="text-base text-muted-foreground">
            Ask about your numbers. Answers stay in What Would Lyle Do — not curriculum or Communication Coach.
          </p>
        </div>
      </div>

      <div className="px-4 py-2 rounded-xl bg-emerald-900/20 border border-emerald-500/30 text-sm text-emerald-200">
        Uses your logged WWLD stats and Lyle daily line only. For patient reply drafting use Communication Coach; for curriculum use AI Coach.
      </div>

      {turns.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {SUGGESTED.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              disabled={loading}
              className="text-left rounded-xl border border-brand-gold/15 bg-card p-3 text-sm text-foreground hover:border-emerald-500/40 transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {turns.length > 0 && (
        <div className="space-y-3">
          {turns.map((turn, i) => (
            <Card
              key={`${turn.role}-${i}`}
              className={
                turn.role === "user"
                  ? "bg-card border-brand-gold/30"
                  : "bg-card border-emerald-500/30"
              }
            >
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {turn.role === "user" ? "You" : "WWLD Coach"}
                </p>
                <p className="text-base text-foreground whitespace-pre-wrap leading-relaxed">
                  {turn.content}
                </p>
              </CardContent>
            </Card>
          ))}
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear conversation
          </button>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-brand-gold/15 p-4 space-y-3">
        <label className="text-lg font-bold text-foreground">Your WWLD question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Care plans are down while visits are up — what would Lyle focus on?"
          rows={3}
          disabled={loading}
          className="w-full rounded-xl bg-gray-900 border border-gray-700 p-4 text-base text-foreground placeholder:text-gray-500 resize-none focus:outline-none focus:border-emerald-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
        />
        <Button
          onClick={() => ask(question)}
          disabled={loading}
          className="w-full py-6 text-lg font-bold bg-emerald-600 hover:bg-emerald-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Thinking...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" /> Ask WWLD Coach
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
