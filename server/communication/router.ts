/**
 * Communication Coach API — integrated into Synapse's Express server.
 * Uses Synapse's existing LLM abstraction (Gemini + Groq fallback).
 */
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { COMMUNICATION_SYSTEM_PROMPT } from "./system-prompt";

// Import Synapse's LLM
import { invokeLLM } from "../_core/llm";

export const communicationRouter = Router();

const MAX_CONVERSATION_LENGTH = 6000;
const MAX_CONTEXT_FIELD_LENGTH = 1000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

function consumeRequest(userId: string): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  bucket.count += 1;
  return true;
}

communicationRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", module: "communication-coach", timestamp: new Date().toISOString() });
});

communicationRouter.post("/generate", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Sign in is required to use Communication Coach." });
      return;
    }
    if (!consumeRequest(auth.userId)) {
      res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
      return;
    }

    const { channel, direction, conversation, context, coachMode } = req.body;

    // Validate required fields
    if (!channel || !["text", "email", "verbal"].includes(channel)) {
      res.status(400).json({ error: "Invalid channel. Must be: text, email, or verbal" });
      return;
    }
    if (!direction || !["incoming", "outgoing", "both"].includes(direction)) {
      res.status(400).json({ error: "Invalid direction. Must be: incoming, outgoing, or both" });
      return;
    }
    if (!conversation || typeof conversation !== "string" || conversation.trim().length === 0) {
      res.status(400).json({ error: "Conversation text is required" });
      return;
    }
    if (conversation.length > MAX_CONVERSATION_LENGTH) {
      res.status(400).json({ error: `Conversation must be ${MAX_CONVERSATION_LENGTH} characters or less.` });
      return;
    }
    if (!context?.desired_outcome || context.desired_outcome.trim().length === 0) {
      res.status(400).json({ error: "Desired outcome is required in context" });
      return;
    }
    if (typeof context.desired_outcome !== "string" || context.desired_outcome.length > MAX_CONTEXT_FIELD_LENGTH) {
      res.status(400).json({ error: "Desired outcome is too long." });
      return;
    }

    const directionLabel =
      direction === "incoming" ? "They sent this to us"
      : direction === "outgoing" ? "We sent this (need feedback)"
      : "Full thread (both sides)";

    const channelInstruction =
      channel === "verbal"
        ? "talking points with [TONE: warm/calm/curious] and [PAUSE] and [LISTEN FOR: ...] markers"
        : channel === "text"
        ? "text message (short, conversational, under 320 chars)"
        : "email (3-8 sentences, professional but warm)";

    const coachingBlock = coachMode
      ? `,
  "coaching": {
    "scores": {"self_mastery": 0-2, "frame_clarity": 0-2, "listening_quality": 0-2, "tactical_empathy": 0-2, "observation_discipline": 0-2, "information_discovery": 0-2, "questions_silence": 0-2, "authority_clarity": 0-2, "autonomy": 0-2, "ethical_influence": 0-2, "qualification": 0-2, "next_step": 0-2},
    "total_score": 0-24,
    "interpretation": "Excellent/Strong/Inconsistent/Rebuild needed",
    "biggest_strength": "exact behavior worth repeating",
    "biggest_leak": "exact moment resistance likely increased",
    "ethics_check": {"status": "PASS or FLAG", "details": "explanation"},
    "best_next_move": {"technique": "technique name", "explanation": "why this is best now"},
    "practice_rep": "one specific role-play challenge"
  }`
      : "";

    const userPrompt = `CONVERSATION INPUT:
Channel: ${channel}
Direction: ${directionLabel}

CONVERSATION:
${conversation.trim()}

CONTEXT:
- Emotional tone: ${context.emotional_tone || "not specified"}
- Relationship stage: ${context.relationship_stage || "not specified"}
- Desired outcome: ${context.desired_outcome.trim()}
- Known obstacles: ${context.known_obstacles || "none specified"}
- Urgency: ${context.urgency || "not specified"}

TASK: Generate a response following the Six-Layer Model. Return ONLY valid JSON with this exact structure:
{
  "situation_read": "2-3 sentence summary of what's happening",
  "protecting": ["array of 1-3 concerns they may be protecting"],
  "missing_info": ["array of 1-3 unknown questions that would change the approach"],
  "recommended_response": "The actual ${channelInstruction}",
  "technique_applied": "One sentence explaining which technique is used and why",
  "what_not_to_say": {"bad_example": "the mistake to avoid", "why": "why it increases resistance"},
  "follow_up_question": "One question if they resist or go silent"${coachingBlock}
}`;

    const llmResponse = await invokeLLM([
      { role: "system", content: COMMUNICATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);

    // Parse the response content
    let jsonStr = (llmResponse.content || "").trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const parsed = JSON.parse(jsonStr);
      res.json(parsed);
    } catch {
      // If JSON parse fails, return the raw text as a fallback
      res.json({
        situation_read: "Analysis generated but format was non-standard.",
        protecting: [],
        missing_info: [],
        recommended_response: jsonStr,
        technique_applied: "Direct response",
        what_not_to_say: { bad_example: "", why: "" },
        follow_up_question: "",
      });
    }
  } catch (error: any) {
    console.error("[Communication Generate Error]", error.message);
    res.status(500).json({ error: "Unable to generate a response right now. Please try again." });
  }
});
