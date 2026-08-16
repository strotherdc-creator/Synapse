import { describe, it, expect } from "vitest";

// Test that API keys are set and the LLM providers respond correctly
describe("LLM API Key Validation", () => {
  it("GEMINI_API_KEY is set", () => {
    expect(process.env.GEMINI_API_KEY).toBeTruthy();
    expect(process.env.GEMINI_API_KEY!.length).toBeGreaterThan(10);
  });

  it("GROQ_API_KEY is set", () => {
    expect(process.env.GROQ_API_KEY).toBeTruthy();
    expect(process.env.GROQ_API_KEY!.length).toBeGreaterThan(10);
  });

  it("Gemini API responds to a simple prompt", async () => {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent("Say 'hello' in one word.");
    const text = result.response.text();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("[Gemini] Response:", text.slice(0, 100));
  }, 20000);

  it("Groq API (GPT-OSS 120B) responds to a simple prompt", async () => {
    const Groq = (await import("groq-sdk")).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "user", content: "Say 'hello' in one word." }],
      max_completion_tokens: 1024,
      reasoning_effort: "low",
      include_reasoning: false,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("[Groq-GPT-OSS-120B] Response:", text.slice(0, 100));
  }, 20000);

  it("Groq API (GPT-OSS 20B) responds to a simple prompt", async () => {
    const Groq = (await import("groq-sdk")).default;
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: "Say 'hello' in one word." }],
      max_completion_tokens: 1024,
      reasoning_effort: "low",
      include_reasoning: false,
    });

    const text = completion.choices[0]?.message?.content ?? "";
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
    console.log("[Groq-GPT-OSS-20B] Response:", text.slice(0, 100));
  }, 20000);

  it("Full coaching simulation - Gemini handles a chiropractic coaching message", async () => {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const systemPrompt = `You are a chiropractic business coach helping a chiropractor define their local position. 
RULES: 
1. ALWAYS accept the user's answer without rejection
2. Ask ONE follow-up question to help them refine their answer
3. Be encouraging and specific`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
    });

    const chat = model.startChat();

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
