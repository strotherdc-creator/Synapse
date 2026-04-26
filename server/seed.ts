import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { modules, lessons } from "../shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required to seed the database");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const db = drizzle(pool);

const CURRICULUM = [
  {
    title: "Bridge the Gap: Foundation",
    description: "Discover your unique value proposition and what makes your practice different from every other provider in your market.",
    iconEmoji: "🌉",
    status: "published" as const,
    lessons: [
      {
        title: "Why Differentiation Matters",
        summary: "Understanding why being different is more important than being better in a crowded healthcare market.",
        content: `# Why Differentiation Matters

In today's healthcare landscape, patients have more choices than ever. The practices that thrive aren't necessarily the ones with the best clinical skills — they're the ones that clearly communicate **why they're different**.

## The Problem with "Better"

Most practitioners try to compete by being "better" — better techniques, better equipment, better outcomes. But here's the truth: **patients can't evaluate "better" before they experience it.** They choose based on what they can understand and relate to.

## The Power of Different

When you differentiate, you:
- Attract patients who are specifically looking for what you offer
- Reduce price sensitivity (you're not a commodity)
- Build a referral network that knows exactly who to send to you
- Create content that resonates because it's specific, not generic

## Your Assignment

Think about these questions:
1. What do patients say about you that they don't say about other providers?
2. What's the one thing you wish every potential patient knew about your approach?
3. If you had to describe your practice in one sentence to a stranger, what would you say?

Write your answers — we'll build on them throughout this curriculum.`,
      },
      {
        title: "Know Your Market",
        summary: "Analyzing your local market to find gaps and opportunities that align with your strengths.",
        content: `# Know Your Market

Before you can position yourself effectively, you need to understand the landscape you're operating in.

## Market Analysis Exercise

### Step 1: List Your Competitors
Write down every practice within a 15-mile radius that offers similar services. Include:
- Their name and location
- Their primary messaging (check their website/social media)
- What they seem to be known for

### Step 2: Identify the Gaps
Look at what everyone is saying. What's missing? Common gaps include:
- **Specialization** — Everyone says "we treat everyone" but nobody owns a niche
- **Communication style** — Most practices use clinical jargon instead of patient language
- **Experience focus** — Few practices describe what the patient experience actually feels like
- **Outcome specificity** — Vague promises vs. specific outcomes

### Step 3: Map Your Strengths to Gaps
Where do your genuine strengths align with market gaps? That intersection is your positioning sweet spot.

## Your Assignment
Complete the market analysis exercise above and identify your top 3 potential positioning angles.`,
      },
      {
        title: "Your Origin Story",
        summary: "Crafting a compelling personal narrative that connects your journey to your practice philosophy.",
        content: `# Your Origin Story

Every great brand has an origin story. Yours is the bridge between who you are and why patients should trust you.

## Why Stories Work

Research shows that stories are:
- 22x more memorable than facts alone
- The primary way humans build trust with strangers
- The fastest path to emotional connection

## The Origin Story Framework

Your story should answer three questions:

### 1. What happened to you?
What personal experience led you to this specific approach? Maybe it was:
- Your own health journey
- A family member's experience
- A pivotal moment in your training
- A patient who changed your perspective

### 2. What did you discover?
What insight or truth did that experience reveal? This is the "aha moment" that shapes your philosophy.

### 3. What do you do about it now?
How does that discovery show up in how you practice today? This connects your story to the patient's benefit.

## Your Assignment
Write your origin story using the framework above. Keep it to 200-300 words. We'll refine it in the next module.`,
      },
    ],
  },
  {
    title: "Messaging & Positioning",
    description: "Translate your unique value into clear, compelling messaging that attracts your ideal patients.",
    iconEmoji: "📣",
    status: "published" as const,
    lessons: [
      {
        title: "The Positioning Statement",
        summary: "Creating a clear, specific positioning statement that guides all your marketing and communication.",
        content: `# The Positioning Statement

Your positioning statement is the foundation of every piece of content, every conversation, and every marketing decision you make.

## The Formula

**I help [specific audience] who struggle with [specific problem] achieve [specific outcome] through [your unique approach].**

### Breaking It Down

**Specific audience** — Not "everyone." Who is your ideal patient?
- Age range, lifestyle, occupation
- What they've already tried
- What frustrates them about healthcare

**Specific problem** — Not "pain." What's the real problem?
- The functional limitation
- The emotional impact
- The life they're missing out on

**Specific outcome** — Not "feeling better." What does success look like?
- Concrete activities they can do again
- How their daily life changes
- The confidence they regain

**Your unique approach** — Not "chiropractic care." What makes YOUR approach different?
- Your specific methodology
- Your philosophy
- Your patient experience

## Your Assignment
Write your positioning statement using the formula above. Then test it: read it to someone who isn't in healthcare. Do they immediately understand what you do and who you help?`,
      },
      {
        title: "Speaking Your Patient's Language",
        summary: "Learning to communicate in terms patients understand and care about, not clinical jargon.",
        content: `# Speaking Your Patient's Language

The biggest communication gap in healthcare isn't knowledge — it's language.

## The Jargon Trap

Clinical language creates distance. Compare:

| Clinical Language | Patient Language |
|---|---|
| "Subluxation correction" | "Getting your spine moving properly again" |
| "Neurological optimization" | "Helping your body communicate better" |
| "Corrective care protocol" | "A step-by-step plan to fix the root cause" |
| "Postural rehabilitation" | "Standing taller and feeling more confident" |

## The Translation Exercise

For each of your key services or approaches:
1. Write the clinical description
2. Translate it into what the patient experiences
3. Connect it to an outcome they care about

## The "So What?" Test

After every statement you make about your practice, ask "So what?" from the patient's perspective:

- "We use the latest technology" → So what? → "Which means we can find problems other offices miss"
- "I have 15 years of experience" → So what? → "Which means I've seen cases like yours hundreds of times and know what works"

## Your Assignment
Take your top 5 clinical talking points and translate them using the framework above.`,
      },
      {
        title: "Your Content Pillars",
        summary: "Defining 3-5 content themes that consistently reinforce your positioning across all platforms.",
        content: `# Your Content Pillars

Content pillars are the 3-5 themes you consistently talk about. They keep your messaging focused and make content creation easier.

## Why Pillars Work

Without pillars, content creation feels random and overwhelming. With pillars:
- You always know what to talk about
- Your audience knows what to expect from you
- Every piece of content reinforces your positioning
- You build authority in specific areas

## Choosing Your Pillars

Your pillars should:
1. **Align with your positioning** — Each pillar supports your unique approach
2. **Address patient concerns** — Topics your ideal patients actually care about
3. **Showcase your expertise** — Areas where you have genuine authority
4. **Be sustainable** — You can create content about them indefinitely

## Example Pillars for a Corrective Chiropractor
1. **Root Cause vs. Symptom Relief** — Why treating symptoms keeps you stuck
2. **Desk Worker Wellness** — Specific tips for the 9-5 crowd
3. **Patient Transformations** — Real stories of life-changing results
4. **Myth Busting** — Common misconceptions about chiropractic care
5. **Daily Habits** — Simple things patients can do between visits

## Your Assignment
Define your 3-5 content pillars. For each one, write:
- The pillar name
- A one-sentence description
- 5 potential content topics within that pillar`,
      },
    ],
  },
  {
    title: "Content Creation System",
    description: "Build a repeatable system for creating engaging content that attracts and converts your ideal patients.",
    iconEmoji: "✍️",
    status: "published" as const,
    lessons: [
      {
        title: "The Content Machine",
        summary: "Setting up a sustainable content creation workflow that doesn't consume your entire week.",
        content: `# The Content Machine

You don't need to spend hours creating content. You need a system that makes it efficient and consistent.

## The 1-Hour Content Week

Here's how to create a week's worth of content in about an hour:

### Monday (15 min): Plan
- Pick one content pillar for the week
- Choose a specific angle or topic
- Outline 3-4 pieces of content from that one topic

### Tuesday (20 min): Create the Core Piece
- Write one longer piece (email, blog post, or video script)
- This is your "pillar content" for the week

### Wednesday (15 min): Repurpose
- Pull 2-3 social media posts from your pillar content
- Create a text message or short tip from the same material

### Thursday (10 min): Schedule
- Use your Content Studio to polish and schedule everything
- Set up posts for the rest of the week

### Friday: Engage
- Respond to comments and messages
- Note what resonated for future content ideas

## Your Assignment
Plan your first content week using this system. Use the Content Studio to generate your first batch of content.`,
      },
      {
        title: "Social Media That Converts",
        summary: "Creating social media content that goes beyond likes to actually drive new patient inquiries.",
        content: `# Social Media That Converts

Likes don't pay the bills. Here's how to create social content that actually brings patients through your door.

## The AIDA Framework for Social Posts

**Attention** — Stop the scroll with a hook
**Interest** — Share something valuable or surprising
**Desire** — Connect it to what they want
**Action** — Tell them what to do next

## Post Types That Convert

### 1. The Problem-Solution Post
"Most people think [common belief]. But actually, [surprising truth]. Here's what to do instead: [actionable tip]."

### 2. The Patient Story
"[Patient name/anonymous] came to us with [problem]. After [timeframe], they can now [specific outcome]. Here's what made the difference..."

### 3. The Myth Buster
"I hear this every week: '[common myth].' Let me explain why this isn't true and what you should know instead..."

### 4. The Behind-the-Scenes
Show your process, your team, your office. People buy from people they feel they know.

### 5. The Direct Offer
"If you're dealing with [specific problem], we have [specific number] spots open this week. [How to book]."

## The 80/20 Rule
- 80% value (education, stories, tips)
- 20% direct offers (book now, call us, limited spots)

## Your Assignment
Write one post for each of the 5 types above using your positioning and content pillars.`,
      },
    ],
  },
  {
    title: "Patient Experience & Retention",
    description: "Design a patient experience that turns first-time visitors into long-term advocates who refer others.",
    iconEmoji: "⭐",
    status: "published" as const,
    lessons: [
      {
        title: "The First Visit Experience",
        summary: "Designing a memorable first visit that sets you apart from every other provider they've seen.",
        content: `# The First Visit Experience

The first visit is your biggest opportunity to demonstrate your differentiation. It's where positioning becomes reality.

## The Experience Gap

Most first visits follow the same script:
1. Fill out paperwork
2. Wait in a generic waiting room
3. Brief exam
4. Treatment
5. Schedule next visit

This is forgettable. Here's how to make it remarkable.

## The Remarkable First Visit

### Before They Arrive
- Send a welcome video (60 seconds, from you personally)
- Include what to expect and what to wear
- Ask about their goals, not just their symptoms

### The Arrival
- Greet them by name
- The environment should reflect your brand
- Offer something unexpected (not just water — think about what aligns with your positioning)

### The Consultation
- Listen more than you talk (aim for 70/30)
- Use their language, not yours
- Show them you understand their specific situation
- Explain your approach in terms of their goals

### The Report
- Visual, not verbal
- Show them the path from where they are to where they want to be
- Make the plan feel achievable, not overwhelming

### The Follow-Up
- Same-day follow-up message (text or email)
- Reference something specific from your conversation
- Reinforce why your approach is right for their situation

## Your Assignment
Map out your ideal first visit experience step by step. Identify 3 moments where you can exceed expectations.`,
      },
      {
        title: "Building a Referral Engine",
        summary: "Creating a systematic approach to generating referrals that doesn't feel awkward or salesy.",
        content: `# Building a Referral Engine

Referrals are the highest-quality leads you'll ever get. But most practitioners leave them to chance.

## Why Referrals Stall

The #1 reason patients don't refer: **They don't know how to describe what you do.**

This is why positioning matters. When your patients can clearly articulate your unique value, referrals happen naturally.

## The Referral System

### Step 1: Equip Your Patients
Give them the words. Your positioning statement should be simple enough that a patient can repeat it:
"My chiropractor specializes in [specific thing] for [specific people]. They helped me [specific outcome]."

### Step 2: Create Referral Moments
Identify natural points in the patient journey to mention referrals:
- After a milestone (first pain-free day, completing a care phase)
- When they express gratitude
- During progress reviews

### Step 3: Make It Easy
- Referral cards (physical or digital)
- A simple text they can forward
- A landing page specifically for referred patients

### Step 4: Acknowledge and Reward
- Thank them personally (not just a generic card)
- Consider a referral appreciation program
- Share the impact: "Your friend is doing great — thank you for connecting us"

### Step 5: Track and Optimize
- Know where your referrals come from
- Double down on what's working
- Ask your best referrers what made them comfortable referring

## Your Assignment
Design your referral system using the steps above. Write the referral message your patients would send.`,
      },
    ],
  },
  {
    title: "Growth Strategy & Metrics",
    description: "Set measurable goals, track the right numbers, and build a sustainable growth plan for your practice.",
    iconEmoji: "📈",
    status: "published" as const,
    lessons: [
      {
        title: "The Numbers That Matter",
        summary: "Identifying and tracking the key metrics that actually predict practice growth.",
        content: `# The Numbers That Matter

You can't improve what you don't measure. But measuring the wrong things wastes your time.

## The Core Metrics

### 1. New Patient Acquisition
- **Track:** New patients per week/month
- **Source:** Where did they hear about you?
- **Cost:** What did it cost to acquire them?

### 2. Patient Retention Rate
- **Track:** What percentage complete their recommended care plan?
- **Benchmark:** Top practices retain 70-85%
- **Why it matters:** Retention is cheaper than acquisition

### 3. Patient Lifetime Value (PLV)
- **Calculate:** Average revenue per patient over their entire relationship
- **Improve by:** Better retention, appropriate care plans, referral programs

### 4. Referral Rate
- **Track:** What percentage of new patients come from referrals?
- **Benchmark:** Healthy practices see 30-50% from referrals
- **Why it matters:** Referrals have the highest conversion rate and lowest cost

### 5. Content Engagement
- **Track:** Which content drives the most inquiries (not just likes)
- **Optimize:** Double down on what converts

## The Weekly Dashboard

Create a simple weekly review:
- New patients this week: ___
- Referrals this week: ___
- Content pieces published: ___
- Patient retention rate: ___

## Your Assignment
Set up your tracking system. Define your baseline numbers and set 90-day targets for each metric.`,
      },
      {
        title: "Your 90-Day Growth Plan",
        summary: "Creating an actionable 90-day plan that ties everything together into measurable practice growth.",
        content: `# Your 90-Day Growth Plan

You've built the foundation. Now it's time to execute. This lesson ties everything together into a concrete action plan.

## The 90-Day Framework

### Month 1: Foundation (Weeks 1-4)
**Focus:** Positioning and messaging

- [ ] Finalize your positioning statement
- [ ] Write your origin story
- [ ] Define your content pillars
- [ ] Set up your Content Studio workflow
- [ ] Create your first week of content
- [ ] Update your website/social profiles with new messaging

### Month 2: Execution (Weeks 5-8)
**Focus:** Content and patient experience

- [ ] Publish content consistently (minimum 3x/week)
- [ ] Implement your new first-visit experience
- [ ] Launch your referral system
- [ ] Start tracking your core metrics
- [ ] Refine messaging based on patient feedback

### Month 3: Optimization (Weeks 9-12)
**Focus:** Scaling what works

- [ ] Review metrics and identify what's working
- [ ] Double down on top-performing content types
- [ ] Expand referral program
- [ ] Plan next quarter's focus areas
- [ ] Celebrate wins and document lessons learned

## Daily Habits for Growth

Use the Daily Routine feature to build these habits:
1. Complete one curriculum lesson
2. Create or schedule one piece of content
3. Review your positioning statement
4. Take one outreach action
5. Ask the AI Coach one question

## Your Assignment
Customize this 90-day plan for your specific situation. Set your start date and commit to the daily routine.`,
      },
    ],
  },
];

async function seed() {
  console.log("Seeding Bridge the Gap curriculum...");

  for (let i = 0; i < CURRICULUM.length; i++) {
    const mod = CURRICULUM[i];
    const [inserted] = await db
      .insert(modules)
      .values({
        title: mod.title,
        description: mod.description,
        iconEmoji: mod.iconEmoji,
        status: mod.status,
        sortOrder: i + 1,
      })
      .returning({ id: modules.id });

    console.log(`  Module ${i + 1}: ${mod.title} (id: ${inserted.id})`);

    for (let j = 0; j < mod.lessons.length; j++) {
      const lesson = mod.lessons[j];
      await db.insert(lessons).values({
        moduleId: inserted.id,
        title: lesson.title,
        summary: lesson.summary,
        content: lesson.content,
        status: "published",
        sortOrder: j + 1,
      });
      console.log(`    Lesson ${j + 1}: ${lesson.title}`);
    }
  }

  console.log("\nDone! Seeded 5 modules with 12 lessons total.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
