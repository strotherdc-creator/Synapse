import { describe, it, expect } from "vitest";

// These are live smoke tests against the real Gemini/Groq APIs — they need
// real, working keys and network access, so they only make sense to run as
// a manual/production verification step (see spec §17.2), not as part of
// every local/CI run. They skip themselves when the relevant key is absent
// instead of failing a clean checkout that has no secrets configured.
const hasGemini = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10;
const hasGroq = !!process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.length > 10;

describe.skipIf(!hasGemini)("Gemini API", () => {
  it("responds to a simple prompt", async () => {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent("Say 'hello' in one word.");
    const text = result.response.text();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("[Gemini] Response:", text.slice(0, 100));
  }, 20000);

  it("Full coaching simulation - handles a chiropractic coaching message", async () => {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const systemPrompt = `You are a chiropractic business coach helping a chiropractor define their local position.
RULES:
1. ALWAYS accept the user's answer without rejection
2. Ask ONE follow-up question to help them refine their answer
3. Be encouraging and specific`;

    // Gemini requires systemInstruction as a Content object, not a raw string —
    // this mirrors the real call shape in server/_core/llm.ts's callGemini().
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: { role: "user", parts: [{ text: systemPrompt }] },
    });

    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage(
      "I think my local position is the family chiropractor in my town."
    );
    const text = result.response.text();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(20);
    // Should NOT contain rejection language
    expect(text.toLowerCase()).not.toContain("i can't");
    expect(text.toLowerCase()).not.toContain("i'm unable");
    console.log("[Coaching Sim] Response:", text.slice(0, 200));
  }, 25000);
});

// Model IDs must match server/_core/llm.ts's invokeLLM() fallback chain exactly —
// update both places together when a provider deprecates a model.
describe.skipIf(!hasGroq)("Groq API", () => {
  it.each([
    ["openai/gpt-oss-120b", "Groq-GPT-OSS-120B (1st fallback)", true],
    ["qwen/qwen3.6-27b", "Groq-Qwen-27B (2nd fallback)", false],
    ["openai/gpt-oss-20b", "Groq-GPT-OSS-20B (3rd/final fallback)", true],
  ] as const)("%s responds to a simple prompt (%s)", async (model, _label, isGptOss) => {
    const Groq = (await import("groq-sdk")).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Say 'hello' in one word." }],
      ...(isGptOss
        ? {
            max_completion_tokens: 1024,
            reasoning_effort: "low" as const,
            include_reasoning: false,
          }
        : { max_tokens: 50 }),
    });

    const text = completion.choices[0]?.message?.content ?? "";
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log(`[Groq ${model}] Response:`, text.slice(0, 100));
  }, 20000);
});
