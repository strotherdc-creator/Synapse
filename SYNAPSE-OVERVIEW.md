# Synapse — App Overview

## Purpose

Synapse is an AI-powered coaching platform built specifically for chiropractors who want to grow their practice through targeted patient acquisition. Rather than hiring expensive marketing agencies or spending hours guessing on social media, practitioners work through a structured curriculum called **"Bridge the Gap"** — a 6-module program that teaches them to identify, attract, and retain their ideal patients. An AI coach guides them step-by-step, adapts to their specific practice, and generates ready-to-use marketing content based on their answers.

---

## Who It's For

Chiropractors (and potentially other solo healthcare practitioners) who:

- Know they need more patients but don't know where to start
- Have been burned by marketing agencies that don't understand their niche
- Want a repeatable system, not just random social media tips
- Prefer self-paced learning with accountability built in

---

## Core Functionality

### 1. AI-Guided Coaching Curriculum

The heart of the app. Six sequential modules, each containing multiple coaching steps:

| Module | Focus |
|--------|-------|
| 1 | Identifying your ideal patient avatar |
| 2 | Crafting your unique value proposition |
| 3 | Building your targeting strategy |
| 4 | Creating compelling messaging |
| 5 | Executing daily outreach actions |
| 6 | Measuring results and iterating |

Each step presents a question or exercise. The user responds conversationally with an AI coach (powered by Google Gemini with Groq fallback) that asks follow-up questions, challenges assumptions, and helps refine their answers. Once satisfied, the user confirms their final answer and advances.

**Key feature: Answer carry-forward.** Every confirmed answer from previous steps is injected into the AI's context for subsequent steps. By Module 6, the AI knows the user's ideal patient, their messaging, their market — and can give highly specific guidance.

### 2. Content Studio

Generates ready-to-use marketing content based on the user's curriculum answers:

- Social media posts
- Email sequences
- Ad copy
- Blog outlines
- Patient testimonial frameworks
- Referral scripts

All content is contextual — it uses the practitioner's specific language, target audience, and value proposition from their coaching answers.

### 3. Daily Routine

A daily task checklist that keeps users accountable to consistent action. Includes streak tracking with milestone badges to reinforce habit formation.

### 4. Dashboard

Overview screen showing:

- Overall curriculum progress (percentage complete)
- Current streak
- Quick-continue button to resume where they left off
- Lessons learned summary

### 5. Profile & Settings

User profile management. Name and email are required (gated on first login). Google OAuth via Clerk for authentication.

### 6. Admin Panel (Owner Only)

Accessible only to the account matching the `ADMIN_EMAIL` environment variable:

- **Manage Modules** — CRUD for curriculum modules and coaching steps
- **User Analytics** — total users, active users (7-day/30-day), steps completed, module completion breakdown, per-user activity table with streaks and last-active dates

---

## Technical Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS, Wouter (routing) |
| Backend | Express.js, tRPC (type-safe API), Node.js |
| Database | PostgreSQL (hosted on Railway), Drizzle ORM |
| Authentication | Clerk (Google OAuth) |
| AI | Google Gemini (primary), Groq/Llama (fallback), automatic failover |
| Deployment | Railway (Docker), auto-deploy from GitHub |
| PWA | Service worker, manifest.json, installable to home screen |

### Database Schema (14 tables)

- `users` — accounts with role (user/admin), streak data, subscription status
- `modules` — curriculum modules (title, description, order, lock state)
- `module_steps` — individual coaching steps within each module
- `user_step_progress` — per-user completion state and final answers
- `step_chat_messages` — full AI coaching conversation history per step
- `lessons` — legacy lesson content within modules
- `user_progress` — lesson completion tracking
- `user_answers` — confirmed answers keyed by module and question
- `chat_messages` — general chat history
- `daily_tasks` — daily routine completion records
- `streaks` — current and longest streak per user
- `content_history` — generated content saved for reference
- `coupons` — discount/free-access codes

---

## User Flow

```
Landing Page (public)
    ↓ Sign in with Google (Clerk)
Profile Completion (if name missing)
    ↓ Enter name → Continue
Dashboard
    ↓ Start / Continue curriculum
Module 1 → Coaching Step 1
    ↓ Converse with AI coach
    ↓ Confirm final answer
Module 1 → Coaching Step 2 ... N
    ↓ Complete all steps
Module 2 unlocks → repeat
    ...
Module 6 complete → full access to Content Studio with rich context
```

---

## Monetization (Planned)

The landing page presents two subscription tiers:

| Plan | Price | Notes |
|------|-------|-------|
| Monthly | $74.99/mo | Cancel anytime |
| Annual | $749/year | "Best Value" — equivalent to 2 months free |

A 14-day "Full Waiting Room" guarantee is offered. Stripe integration is planned but not yet wired (pricing buttons currently show a placeholder alert).

---

## Key Design Decisions

1. **Sequential module locking** — users cannot skip ahead. Each module builds on confirmed answers from the previous one.
2. **AI context accumulation** — the coaching AI becomes more useful over time because it knows everything the user has already decided.
3. **No mock data** — all progress, answers, and content are real and persisted server-side in PostgreSQL.
4. **PWA-first mobile experience** — installable to home screen, works offline for cached content, iOS share-button hint for installation.
5. **Dark theme by default** — professional, modern aesthetic with dark green and gold branding.
6. **Voice dictation** — Web Speech API microphone input on the coaching chat for hands-free responses.

---

## Current Status

The app is live in production on Railway with active users testing the curriculum. All core features are functional. Remaining work:

- Stripe payment integration (keys needed)
- Protected video delivery behind paywall
- Push notifications for engagement
- Achievement/level system (brainstormed, not yet built)
