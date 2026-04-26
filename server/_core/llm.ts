import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { ENV } from "./env";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMResponse = {
  content: string;
  provider: "gemini" | "groq";
};

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

// ─── Groq Provider (Fallback) ───────────────────────────────────────

async function callGroq(messages: ChatMessage[]): Promise<string> {
  if (!ENV.groqApiKey) throw new Error("GROQ_API_KEY not configured");

  const groq = new Groq({ apiKey: ENV.groqApiKey });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-70b-versatile",
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    max_tokens: 4096,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content ?? "Unable to generate response.";
}

// ─── Unified LLM Interface ─────────────────────────────────────────

export async function invokeLLM(messages: ChatMessage[]): Promise<LLMResponse> {
  // Try Gemini first
  if (ENV.geminiApiKey) {
    try {
      const content = await callGemini(messages);
      return { content, provider: "gemini" };
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;
      const isRateLimit = status === 429;
      const isServerError = status >= 500;

      if (isRateLimit || isServerError) {
        console.warn(
          `[LLM] Gemini ${isRateLimit ? "rate limited" : "server error"} (${status}), falling back to Groq`
        );
      } else {
        console.error("[LLM] Gemini error:", error.message);
        // For non-rate-limit errors, still try fallback
      }
    }
  }

  // Fallback to Groq
  if (ENV.groqApiKey) {
    try {
      const content = await callGroq(messages);
      return { content, provider: "groq" };
    } catch (error: any) {
      console.error("[LLM] Groq fallback error:", error.message);
    }
  }

  // Both failed
  throw new Error(
    "All LLM providers failed. Please check your API keys (GEMINI_API_KEY, GROQ_API_KEY)."
  );
}
