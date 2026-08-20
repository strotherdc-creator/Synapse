import { useState } from "react";
import { Copy, MessageSquare, Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

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
  const [conversation, setConversation] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [channel, setChannel] = useState<"text" | "email" | "verbal">("text");
  const [direction, setDirection] = useState<"incoming" | "outgoing" | "both">("incoming");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [emotionalTone, setEmotionalTone] = useState("");
  const [relationshipStage, setRelationshipStage] = useState("");
  const [knownObstacles, setKnownObstacles] = useState("");
  const [urgency, setUrgency] = useState("");
  const [coachMode, setCoachMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!conversation.trim()) { toast.error("Paste the conversation first"); return; }
    if (!desiredOutcome.trim()) { toast.error("Tell me what you want to happen"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/communication/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          direction,
          conversation,
          context: {
            emotional_tone: emotionalTone,
            relationship_stage: relationshipStage,
            desired_outcome: desiredOutcome,
            known_obstacles: knownObstacles,
            urgency,
          },
          coachMode,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate response");
      }
      const data = await res.json();
      setResult(data);
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
    setConversation("");
    setDesiredOutcome("");
    setResult(null);
    setShowAdvanced(true);
    setEmotionalTone("");
    setRelationshipStage("");
    setKnownObstacles("");
    setUrgency("");
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
          <p className="text-base text-muted-foreground">Paste a conversation. Get the right response.</p>
        </div>
      </div>

      {/* PHI Warning */}
      <div className="px-4 py-2 rounded-xl bg-red-900/20 border border-red-500/30 text-sm text-red-300">
        Do not include patient names, DOB, or protected health information.
      </div>

      {/* Main Input Section */}
      {!result && (
        <div className="space-y-5 bg-card rounded-2xl border border-border p-5">

          {/* 1. Paste the conversation */}
          <div className="space-y-2">
            <label className="text-lg font-bold text-foreground">Paste the conversation</label>
            <textarea
              value={conversation}
              onChange={(e) => setConversation(e.target.value)}
              placeholder="Paste the text, email, or describe what was said..."
              rows={5}
              className="w-full rounded-xl bg-gray-900 border border-gray-700 p-4 text-base text-foreground placeholder:text-gray-500 resize-none focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* 2. What do you want to happen? */}
          <div className="space-y-2">
            <label className="text-lg font-bold text-foreground">What do you want to happen?</label>
            <input
              value={desiredOutcome}
              onChange={(e) => setDesiredOutcome(e.target.value)}
              placeholder="e.g., Get them scheduled, handle price objection, get them back in..."
              className="w-full rounded-xl bg-gray-900 border border-gray-700 p-4 text-base text-foreground placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* 3. Quick toggles */}
          <div className="flex gap-4 flex-wrap">
            <div className="space-y-1">
              <span className="text-sm font-semibold text-muted-foreground">Type</span>
              <div className="flex gap-2">
                {(["text", "email", "verbal"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
                      channel === ch ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-semibold text-muted-foreground">Who sent it?</span>
              <div className="flex gap-2">
                {([
                  { key: "incoming" as const, label: "They did" },
                  { key: "outgoing" as const, label: "I did" },
                  { key: "both" as const, label: "Both" },
                ]).map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDirection(d.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      direction === d.key ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Extra context — always visible */}
          <p className="text-base font-bold text-foreground">Extra context (optional)</p>

          {showAdvanced && (
            <div className="space-y-3 pl-2 border-l-2 border-purple-600/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-muted-foreground">Their tone</label>
                  <select value={emotionalTone} onChange={(e) => setEmotionalTone(e.target.value)} className="w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-sm text-foreground">
                    <option value="">Not sure</option>
                    <option value="frustrated">Frustrated</option>
                    <option value="anxious">Anxious</option>
                    <option value="skeptical">Skeptical</option>
                    <option value="curious">Curious</option>
                    <option value="angry">Angry</option>
                    <option value="neutral">Neutral</option>
                    <option value="excited">Excited</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-muted-foreground">Who are they?</label>
                  <select value={relationshipStage} onChange={(e) => setRelationshipStage(e.target.value)} className="w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-sm text-foreground">
                    <option value="">Not sure</option>
                    <option value="cold_lead">Cold lead</option>
                    <option value="new_lead">New inquiry</option>
                    <option value="scheduled">Scheduled, not seen</option>
                    <option value="active_patient">Active patient</option>
                    <option value="inactive_patient">Dropped off</option>
                    <option value="referral_source">Referral source</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-muted-foreground">Known obstacles</label>
                <input value={knownObstacles} onChange={(e) => setKnownObstacles(e.target.value)} placeholder="price, time, spouse, scared..." className="w-full rounded-lg bg-gray-900 border border-gray-700 p-2 text-sm text-foreground placeholder:text-gray-500" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800">
                <div>
                  <p className="text-sm font-bold text-foreground">Coach Me</p>
                  <p className="text-xs text-muted-foreground">Score my communication</p>
                </div>
                <button onClick={() => setCoachMode(!coachMode)} className={`px-3 py-1 rounded-lg text-xs font-bold ${coachMode ? "bg-purple-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                  {coachMode ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-purple-600 text-white text-lg font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Thinking...</> : "Get Response"}
          </button>
        </div>
      )}

      {/* Result Section */}
      {result && (
        <div className="space-y-5">

          {/* Situation Read — compact */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-sm font-bold text-purple-400 uppercase tracking-wide mb-1">What's happening</p>
            <p className="text-base text-foreground leading-relaxed">{result.situation_read}</p>
          </div>

          {/* THE RESPONSE — the main output, prominent */}
          <div className="bg-card rounded-2xl border-2 border-purple-500/50 p-5 space-y-4">
            <p className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Your Response — Copy & Send</p>
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

          {/* What they're protecting */}
          {result.protecting.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-bold text-yellow-400 uppercase tracking-wide mb-2">What they're protecting</p>
              {result.protecting.map((p, i) => (
                <p key={i} className="text-base text-foreground">• {p}</p>
              ))}
            </div>
          )}

          {/* Technique */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-sm font-bold text-blue-400 uppercase tracking-wide mb-1">Why this works</p>
            <p className="text-base text-foreground">{result.technique_applied}</p>
          </div>

          {/* What NOT to say */}
          {result.what_not_to_say?.bad_example && (
            <div className="bg-red-900/20 rounded-2xl border border-red-500/30 p-4">
              <p className="text-sm font-bold text-red-400 uppercase tracking-wide mb-1">Don't say this</p>
              <p className="text-base text-red-200 italic">"{result.what_not_to_say.bad_example}"</p>
              <p className="text-sm text-red-300 mt-1">{result.what_not_to_say.why}</p>
            </div>
          )}

          {/* Follow-up */}
          {result.follow_up_question && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-sm font-bold text-orange-400 uppercase tracking-wide mb-1">If they go silent</p>
              <p className="text-base text-foreground">"{result.follow_up_question}"</p>
            </div>
          )}

          {/* Coach Mode Scorecard */}
          {result.coaching && (
            <div className="bg-purple-900/20 rounded-2xl border border-purple-500/30 p-5 space-y-3">
              <p className="text-sm font-bold text-purple-400 uppercase tracking-wide">Your Scorecard</p>
              <p className="text-xl font-bold text-foreground">{result.coaching.total_score}/24 — {result.coaching.interpretation}</p>
              <p className="text-base text-emerald-300">✓ Strength: {result.coaching.biggest_strength}</p>
              <p className="text-base text-red-300">✗ Leak: {result.coaching.biggest_leak}</p>
              {result.coaching.practice_rep && (
                <p className="text-base text-purple-300">Practice: {result.coaching.practice_rep}</p>
              )}
            </div>
          )}

          {/* Start Over */}
          <button
            onClick={handleReset}
            className="w-full py-4 rounded-xl bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 transition-colors"
          >
            New Conversation
          </button>
        </div>
      )}
    </div>
  );
}
