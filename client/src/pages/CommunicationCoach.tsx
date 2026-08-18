import { useState } from "react";
import { ArrowLeft, Copy, MessageSquare, Shield, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Channel = "text" | "email" | "verbal";
type Direction = "incoming" | "outgoing" | "both";
type Step = "input" | "context" | "output";

interface ContextData {
  emotional_tone: string;
  relationship_stage: string;
  desired_outcome: string;
  known_obstacles: string;
  urgency: string;
}

interface GenerateResult {
  situation_read: string;
  protecting: string[];
  missing_info: string[];
  recommended_response: string;
  technique_applied: string;
  what_not_to_say: { bad_example: string; why: string };
  follow_up_question: string;
  coaching?: any;
}

export default function CommunicationCoach() {
  const [step, setStep] = useState<Step>("input");
  const [channel, setChannel] = useState<Channel>("text");
  const [direction, setDirection] = useState<Direction>("incoming");
  const [conversation, setConversation] = useState("");
  const [context, setContext] = useState<ContextData>({
    emotional_tone: "",
    relationship_stage: "",
    desired_outcome: "",
    known_obstacles: "",
    urgency: "",
  });
  const [coachMode, setCoachMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/communication/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, direction, conversation, context, coachMode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate response");
      }
      const data = await res.json();
      setResult(data);
      setStep("output");
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied!");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleReset = () => {
    setStep("input");
    setConversation("");
    setContext({ emotional_tone: "", relationship_stage: "", desired_outcome: "", known_obstacles: "", urgency: "" });
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Communication Coach
            <span className="text-xs font-bold bg-yellow-600 text-black px-2 py-0.5 rounded-full">BETA</span>
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Shield className="w-3 h-3" /> Ethical Influence Framework
          </p>
        </div>
      </div>

      {/* PHI Warning */}
      <div className="px-4 py-3 rounded-xl bg-red-900/20 border border-red-500/30 text-sm text-red-300">
        Do not include full patient names, dates of birth, or protected health information.
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-3">
        {["Input", "Context", "Response"].map((label, i) => {
          const currentIndex = step === "input" ? 0 : step === "context" ? 1 : 2;
          const isActive = i === currentIndex;
          const isComplete = i < currentIndex;
          return (
            <div key={label} className={`flex-1 py-2 text-center rounded-lg text-sm font-semibold ${
              isActive ? "bg-purple-600 text-white" :
              isComplete ? "bg-emerald-600/30 text-emerald-300" :
              "bg-gray-800 text-gray-500"
            }`}>
              {isComplete ? "✓ " : ""}{label}
            </div>
          );
        })}
      </div>

      {/* STEP 1: Input */}
      {step === "input" && (
        <div className="space-y-5 bg-card rounded-2xl border border-border p-6">
          <div className="space-y-3">
            <label className="text-lg font-bold text-foreground">Channel</label>
            <div className="grid grid-cols-3 gap-3">
              {(["text", "email", "verbal"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`py-3 rounded-xl font-semibold capitalize transition-colors ${
                    channel === ch ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-lg font-bold text-foreground">Direction</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: "incoming", label: "They sent" },
                { key: "outgoing", label: "We sent" },
                { key: "both", label: "Full thread" },
              ] as const).map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDirection(d.key)}
                  className={`py-3 rounded-xl font-semibold transition-colors ${
                    direction === d.key ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-lg font-bold text-foreground">Paste the conversation</label>
            <textarea
              value={conversation}
              onChange={(e) => setConversation(e.target.value)}
              placeholder="Paste the text message, email, or describe what was said verbally..."
              rows={6}
              className="w-full rounded-xl bg-gray-900 border border-gray-700 p-4 text-base text-foreground placeholder:text-gray-500 resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          <button
            onClick={() => { if (conversation.trim()) setStep("context"); else toast.error("Paste the conversation first"); }}
            className="w-full py-4 rounded-xl bg-purple-600 text-white text-lg font-bold hover:bg-purple-700 transition-colors"
          >
            Next: Add Context →
          </button>
        </div>
      )}

      {/* STEP 2: Context */}
      {step === "context" && (
        <div className="space-y-5 bg-card rounded-2xl border border-border p-6">
          <button onClick={() => setStep("input")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to input
          </button>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-base font-bold text-foreground">Their emotional tone</label>
              <select
                value={context.emotional_tone}
                onChange={(e) => setContext({ ...context, emotional_tone: e.target.value })}
                className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3 text-base text-foreground"
              >
                <option value="">Select...</option>
                <option value="frustrated">Frustrated</option>
                <option value="anxious">Anxious / Worried</option>
                <option value="skeptical">Skeptical</option>
                <option value="curious">Curious / Open</option>
                <option value="angry">Angry</option>
                <option value="neutral">Neutral</option>
                <option value="excited">Excited / Ready</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold text-foreground">Relationship stage</label>
              <select
                value={context.relationship_stage}
                onChange={(e) => setContext({ ...context, relationship_stage: e.target.value })}
                className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3 text-base text-foreground"
              >
                <option value="">Select...</option>
                <option value="cold_lead">Cold lead (never been in)</option>
                <option value="new_lead">New lead (inquiring)</option>
                <option value="scheduled">Scheduled but not seen yet</option>
                <option value="active_patient">Active patient</option>
                <option value="inactive_patient">Inactive / dropped off</option>
                <option value="referral_source">Referral source</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold text-foreground">What outcome do you want? *</label>
              <input
                value={context.desired_outcome}
                onChange={(e) => setContext({ ...context, desired_outcome: e.target.value })}
                placeholder="e.g., Schedule a consultation, Get them back in, Handle price objection"
                className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3 text-base text-foreground placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold text-foreground">Known obstacles</label>
              <input
                value={context.known_obstacles}
                onChange={(e) => setContext({ ...context, known_obstacles: e.target.value })}
                placeholder="e.g., price, time, spouse needs to agree, scared of chiropractic"
                className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3 text-base text-foreground placeholder:text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-base font-bold text-foreground">Urgency</label>
              <select
                value={context.urgency}
                onChange={(e) => setContext({ ...context, urgency: e.target.value })}
                className="w-full rounded-xl bg-gray-900 border border-gray-700 p-3 text-base text-foreground"
              >
                <option value="">Select...</option>
                <option value="today">Today</option>
                <option value="this_week">This week</option>
                <option value="no_rush">No rush</option>
              </select>
            </div>

            {/* Coach Mode Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-800 border border-gray-700">
              <div>
                <p className="font-bold text-foreground">Coach Me Mode</p>
                <p className="text-sm text-muted-foreground">Get a scorecard on YOUR communication</p>
              </div>
              <button
                onClick={() => setCoachMode(!coachMode)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${
                  coachMode ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400"
                }`}
              >
                {coachMode ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <button
            onClick={() => { if (context.desired_outcome.trim()) handleGenerate(); else toast.error("Desired outcome is required"); }}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-purple-600 text-white text-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : "Generate Response →"}
          </button>
        </div>
      )}

      {/* STEP 3: Output */}
      {step === "output" && result && (
        <div className="space-y-5">
          <button onClick={() => setStep("context")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to context
          </button>

          {/* Situation Read */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
            <p className="text-sm font-bold text-purple-400 uppercase tracking-wide">Situation Read</p>
            <p className="text-base text-foreground leading-relaxed">{result.situation_read}</p>
          </div>

          {/* What they're protecting */}
          {result.protecting.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
              <p className="text-sm font-bold text-yellow-400 uppercase tracking-wide">What They're Protecting</p>
              <ul className="space-y-1">
                {result.protecting.map((p, i) => (
                  <li key={i} className="text-base text-foreground">• {p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Response — the main output */}
          <div className="bg-card rounded-2xl border-2 border-purple-500/40 p-5 space-y-4">
            <p className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Recommended Response</p>
            <pre className="whitespace-pre-wrap text-lg text-foreground font-sans leading-relaxed">
              {result.recommended_response}
            </pre>
            <button
              onClick={() => handleCopy(result.recommended_response)}
              className="w-full py-3 rounded-xl bg-blue-600 text-white text-base font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <><CheckCircle2 className="w-5 h-5" /> Copied!</> : <><Copy className="w-5 h-5" /> Copy Response</>}
            </button>
          </div>

          {/* Technique */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
            <p className="text-sm font-bold text-blue-400 uppercase tracking-wide">Technique Applied</p>
            <p className="text-base text-foreground">{result.technique_applied}</p>
          </div>

          {/* What NOT to say */}
          {result.what_not_to_say?.bad_example && (
            <div className="bg-red-900/20 rounded-2xl border border-red-500/30 p-5 space-y-2">
              <p className="text-sm font-bold text-red-400 uppercase tracking-wide">What NOT to Say</p>
              <p className="text-base text-red-200 italic">"{result.what_not_to_say.bad_example}"</p>
              <p className="text-sm text-red-300">{result.what_not_to_say.why}</p>
            </div>
          )}

          {/* Follow-up */}
          {result.follow_up_question && (
            <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <p className="text-sm font-bold text-orange-400 uppercase tracking-wide">If They Resist or Go Silent</p>
              <p className="text-base text-foreground">"{result.follow_up_question}"</p>
            </div>
          )}

          {/* Missing Info */}
          {result.missing_info.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5 space-y-2">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Questions That Would Change the Approach</p>
              <ul className="space-y-1">
                {result.missing_info.map((q, i) => (
                  <li key={i} className="text-sm text-muted-foreground">• {q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Coach Mode Scorecard */}
          {result.coaching && (
            <div className="bg-purple-900/20 rounded-2xl border border-purple-500/30 p-5 space-y-4">
              <p className="text-sm font-bold text-purple-400 uppercase tracking-wide">Coach Me Scorecard</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(result.coaching.scores || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="text-foreground font-bold">{String(val)}/2</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-purple-500/20 space-y-2">
                <p className="text-base text-foreground"><strong>Score:</strong> {result.coaching.total_score}/24 — {result.coaching.interpretation}</p>
                <p className="text-base text-emerald-300"><strong>Strength:</strong> {result.coaching.biggest_strength}</p>
                <p className="text-base text-red-300"><strong>Leak:</strong> {result.coaching.biggest_leak}</p>
                {result.coaching.practice_rep && (
                  <p className="text-base text-purple-300"><strong>Practice:</strong> {result.coaching.practice_rep}</p>
                )}
              </div>
            </div>
          )}

          {/* Start Over */}
          <button
            onClick={handleReset}
            className="w-full py-4 rounded-xl bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 transition-colors"
          >
            Start New Conversation
          </button>
        </div>
      )}
    </div>
  );
}
