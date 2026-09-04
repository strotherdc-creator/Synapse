/**
 * WWLD Coach API — dedicated module parallel to Communication Coach.
 * Answers questions using ONLY WWLD/Lyle context (system prompt + user's WWLD stats).
 */
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { invokeLLM, type ChatMessage } from "../_core/llm";
import { WWLD_SYSTEM_PROMPT } from "./system-prompt";
import * as db from "../db";

export const wwldCoachRouter = Router();

const MAX_MESSAGE_LENGTH = 4000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CONTENT = 2000;
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

async function buildWwldContext(userId: number): Promise<string> {
  const endStr = db.getCentralDateKey();
  const startStr = db.shiftDateKey(endStr, -28);
  const { totals, dailyBreakdown } = await db.getWwldTotalsForRange(
    userId,
    startStr,
    endStr,
    true
  );

  const workDaysLogged = dailyBreakdown.length;
  const recentDays = dailyBreakdown.slice(-7);
  const recentLines = recentDays
    .map(
      (d: any) =>
        `${d.date}: OV ${d.officeVisits}, NP ${d.newPatients}, recall ${d.recall ?? 0}, CP ${d.carePlansSigned}`
    )
    .join("\n");

  let dailyQuote = "";
  try {
    const quote = await db.getOrCreateDailyLyleQuote(userId, endStr);
    if (quote?.actionText) {
      dailyQuote = `\nToday's Lyle daily line (${endStr}): ${quote.actionText}`;
    }
  } catch {
    // Non-critical — coach still works without the quote
  }

  return `
CONTEXT — this doctor's WWLD data only (Central Time window ${startStr} → ${endStr}):
28-day totals (excluding backlog corrections): OV ${totals.officeVisits}, NP ${totals.newPatients}, recall ${totals.recall}, test results ${totals.testResults}, progress exams ${totals.progressExams}, performance reviews ${totals.performanceReviews}, care plans signed ${totals.carePlansSigned}.
Work days with stats in range: ${workDaysLogged}.
Last up to 7 logged days:
${recentLines || "(none logged yet)"}
${dailyQuote}

Use ONLY this WWLD context plus the WWLD system rules. Do not invent curriculum or communication-coach frameworks.`;
}

wwldCoachRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", module: "wwld-coach", timestamp: new Date().toISOString() });
});

wwldCoachRouter.post("/ask", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Sign in is required to use WWLD Coach." });
      return;
    }
    if (!consumeRequest(auth.userId)) {
      res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
      return;
    }

    const { message, history } = req.body ?? {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ error: "A question is required." });
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Question must be ${MAX_MESSAGE_LENGTH} characters or less.` });
      return;
    }

    const user = await db.getUserByClerkId(auth.userId);
    if (!user) {
      res.status(401).json({ error: "Sign in is required to use WWLD Coach." });
      return;
    }

    const wwldContext = await buildWwldContext(user.id);

    const historyMessages: ChatMessage[] = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-MAX_HISTORY_MESSAGES)) {
        if (!item || typeof item !== "object") continue;
        const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
        const content = typeof item.content === "string" ? item.content.slice(0, MAX_HISTORY_CONTENT) : "";
        if (!role || !content.trim()) continue;
        historyMessages.push({ role, content: content.trim() });
      }
    }

    const messages: ChatMessage[] = [
      { role: "system", content: WWLD_SYSTEM_PROMPT + "\n" + wwldContext },
      ...historyMessages,
      { role: "user", content: message.trim() },
    ];

    const llmResponse = await invokeLLM(messages);
    res.json({
      content: llmResponse.content,
      provider: llmResponse.provider,
    });
  } catch (error: any) {
    console.error("[WWLD Coach Ask Error]", error?.message ?? error);
    res.status(500).json({ error: "Unable to answer right now. Please try again." });
  }
});
