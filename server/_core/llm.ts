import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { ENV } from "./env";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMResponse = {
  content: string;
  provider: "gemini" | "groq-gpt-oss-120b" | "groq-qwen-27b" | "groq-8b";
};

// ─── Timeout Utility ───────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

// ─── Retry Utility ─────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number,
  label: string
): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.response?.status;
      // Don't retry on auth errors (401/403) — key is invalid
      if (status === 401 || status === 403) {
        console.error(`[LLM] ${label} auth error (${status}): ${err.message}`);
        throw err;
      }
      if (i < retries) {
        const wait = delayMs * Math.pow(2, i);
        console.warn(`[LLM] ${label} attempt ${i + 1} failed (${err.message}), retrying in ${wait}ms...`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

// ─── Gemini Provider ────────────────────────────────────────────────

async function callGemini(messages: ChatMessage[]): Promise<string> {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(ENV.geminiApiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Extract system instruction from messages
  const systemMessages = messages.filter((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const systemInstruction = systemMessages.map((m) => m.content).join("\n\n");

  // Convert to Gemini format
  const history = chatMessages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const lastMessage = chatMessages[chatMessages.length - 1];
  if (!lastMessage) throw new Error("No user message provided");

  const chat = model.startChat({
    history,
    systemInstruction: systemInstruction || undefined,
  });

  const result = await chat.sendMessage(lastMessage.content);
  const response = result.response;
  return response.text();
}

// ─── Groq Provider ─────────────────────────────────────────────────

async function callGroq(messages: ChatMessage[], model: string): Promise<string> {
  if (!ENV.groqApiKey) throw new Error("GROQ_API_KEY not configured");

  const groq = new Groq({ apiKey: ENV.groqApiKey });

  const completion = await groq.chat.completions.create({
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: 4096,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? "Unable to generate response.";
}

// ─── Unified LLM Interface (3-deep fallback with retry) ───────────

export async function invokeLLM(messages: ChatMessage[]): Promise<LLMResponse> {
  const errors: string[] = [];

  // 1. Try Gemini with retry (2 retries, 1s initial backoff, 15s timeout)
  if (ENV.geminiApiKey) {
    try {
      const content = await withTimeout(
        withRetry(() => callGemini(messages), 2, 1000, "Gemini"),
        15000,
        "Gemini"
      );
      return { content, provider: "gemini" };
    } catch (error: any) {
      const msg = `Gemini: ${error.message}`;
      errors.push(msg);
      console.error(`[LLM] ${msg}`);
    }
  } else {
    errors.push("Gemini: API key not configured");
  }

  // 2. Fallback to Groq GPT-OSS 120B (replaces deprecated llama-3.3-70b-versatile)
  if (ENV.groqApiKey) {
    try {
      const content = await withTimeout(
        callGroq(messages, "openai/gpt-oss-120b"),
        15000,
        "Groq-GPT-OSS-120B"
      );
      return { content, provider: "groq-gpt-oss-120b" };
    } catch (error: any) {
      const msg = `Groq-GPT-OSS-120B: ${error.message}`;
      errors.push(msg);
      console.error(`[LLM] ${msg}`);
    }

    // 3. Fallback to Groq Qwen3.6 27B (fast, capable reasoning model)
    try {
      const content = await withTimeout(
        callGroq(messages, "qwen/qwen3.6-27b"),
        15000,
        "Groq-Qwen-27B"
      );
      return { content, provider: "groq-qwen-27b" };
    } catch (error: any) {
      const msg = `Groq-Qwen-27B: ${error.message}`;
      errors.push(msg);
      console.error(`[LLM] ${msg}`);
    }

    // 4. Final fallback to Groq llama-3.1-8b-instant (fastest, highest rate limits)
    try {
      const content = await withTimeout(
        callGroq(messages, "llama-3.1-8b-instant"),
        15000,
        "Groq-8b"
      );
      return { content, provider: "groq-8b" };
    } catch (error: any) {
      const msg = `Groq-8b: ${error.message}`;
      errors.push(msg);
      console.error(`[LLM] ${msg}`);
    }
  } else {
    errors.push("Groq: API key not configured");
  }

  // All providers failed — include detailed error info
  const detail = errors.join(" | ");
  console.error(`[LLM] ALL PROVIDERS FAILED: ${detail}`);
  throw new Error(
    `All LLM providers failed. Details: ${detail}`
  );
}
