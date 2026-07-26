# Synapse — Project Architecture

**Last updated:** July 2026  
**Maintained by:** Manus AI (on behalf of C. Bryan Strother, DC)  
**Repository:** `strotherdc-creator/Synapse` (GitHub)  
**Production URL:** `https://synapse-production-daae.up.railway.app`

---

## 1. Purpose

Synapse is a chiropractic practice growth platform built for Dr. Bryan Strother and his team. It combines a structured coaching curriculum, an AI chat coach, a content generation studio, a daily routine tracker, and the **WWLD (What Would Lyle Do?)** stats engine — a proprietary algorithm that diagnoses practice trend states and surfaces a single, non-repeating action recommendation each day.

---

## 2. High-Level Architecture

Synapse is a **single-repository, single-process** application. One Node.js server handles both the API and static file serving. There is no separate frontend deployment.

```
Browser (React SPA)
    │
    │  HTTPS
    ▼
Railway (Docker container)
    ├── Express HTTP server  (:PORT)
    │     ├── GET  /api/health          → health check (no auth)
    │     ├── ALL  /api/trpc/*          → tRPC router (Clerk-protected)
    │     └── GET  *                    → Vite (dev) / static files (prod)
    │
    └── PostgreSQL (Railway managed DB)
```

**Dev mode:** `pnpm dev` runs `tsx watch server/_core/index.ts` (server with hot reload) and `vite` (client HMR) concurrently via `concurrently`.

**Production build:**
```
vite build                                  → dist/public/  (React SPA)
esbuild server/_core/index.ts → dist/index.js  (Node server bundle)
```

The Dockerfile copies both outputs into a `node:22-slim` production image. Railway auto-deploys on every push to `main`.

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 19 + Vite 7 | SPA, client-side routing via Wouter |
| UI components | Radix UI + shadcn/ui | Tailwind CSS v4 |
| Charts | Recharts | Used in WWLD analytics |
| Animations | Framer Motion | Subtle transitions only |
| Client routing | Wouter 3 | Lightweight; no React Router |
| API layer | tRPC v11 + TanStack Query v5 | End-to-end type safety; superjson serializer |
| Auth | Clerk (React + Express) | JWT tokens; server validates on `/api` only |
| Server | Express 4 | Single process; no separate API server |
| ORM | Drizzle ORM + `pg` | Schema-first; migrations via `drizzle-kit` |
| Database | PostgreSQL (Railway managed) | Connection via `DATABASE_URL` env var |
| LLM (primary) | Google Gemini 2.5 Flash | `GEMINI_API_KEY` env var |
| LLM (fallback 1) | Groq — `openai/gpt-oss-120b` | `GROQ_API_KEY` env var |
| LLM (fallback 2) | Groq — `qwen-qwq-32b` | Same key |
| LLM (fallback 3) | Groq — `llama-3.1-8b-instant` | Last resort |
| Scheduled jobs | `node-cron` | Weekly WWLD backup job |
| Email | Nodemailer (Gmail SMTP) | Weekly CSV backup delivery |
| Payments | Stripe | Coupon/discount system |
| PWA | `vite-plugin-pwa` | Add-to-homescreen support |
| Language | TypeScript 5.9 (strict) | Full-stack; shared types in `shared/` |
| Package manager | pnpm 9.12 | Workspace config in `pnpm-workspace.yaml` |
| Container | Docker (node:22-slim, multi-stage) | Railway reads `Dockerfile` |

---

## 4. Repository Structure

```
synapse-repo/
├── client/                   ← React SPA (Vite)
│   └── src/
│       ├── _core/            ← Client-side auth hook (useAuth)
│       ├── components/
│       │   ├── ui/           ← shadcn/ui primitives
│       │   ├── wwld/         ← WWLD feature components
│       │   │   ├── LyleRecommendationCard.tsx
│       │   │   ├── StatCard.tsx
│       │   │   ├── StatEntryForm.tsx
│       │   │   ├── WeekChart.tsx
│       │   │   ├── BacklogModal.tsx
│       │   │   └── SessionPrompt.tsx
│       │   ├── DashboardLayout.tsx
│       │   └── ErrorBoundary.tsx
│       ├── contexts/         ← ThemeContext (dark/light)
│       ├── hooks/            ← useMobile, useSpeechToText, etc.
│       ├── lib/
│       │   ├── trpc.ts       ← tRPC client (httpBatchLink → /api/trpc)
│       │   └── utils.ts      ← cn() class merger
│       ├── pages/            ← One file per route
│       │   ├── WWLD.tsx      ← Flagship stats/coaching page
│       │   ├── Curriculum.tsx
│       │   ├── Chat.tsx
│       │   ├── ContentStudio.tsx
│       │   ├── DailyRoutine.tsx
│       │   ├── Home.tsx
│       │   ├── Landing.tsx
│       │   ├── Profile.tsx
│       │   ├── AdminModules.tsx
│       │   └── AdminStats.tsx
│       ├── App.tsx           ← Route map + auth gating
│       └── main.tsx          ← React root + tRPC + Clerk providers
│
├── server/
│   ├── _core/
│   │   ├── index.ts          ← Express bootstrap + startup jobs
│   │   ├── context.ts        ← tRPC context (Clerk → DB user)
│   │   ├── trpc.ts           ← publicProcedure / protectedProcedure / adminProcedure
│   │   ├── llm.ts            ← LLM abstraction (Gemini → Groq fallback chain)
│   │   ├── env.ts            ← All ENV var references (single source of truth)
│   │   └── vite.ts           ← Dev/prod static file serving
│   ├── routers.ts            ← All tRPC routers and procedures
│   ├── db.ts                 ← All database query functions (Drizzle)
│   ├── seed-coaching.ts      ← Coaching curriculum seed (idempotent)
│   ├── seed-lyle.ts          ← Lyle Algorithm content bank seed (114 rows)
│   └── wwld-backup.ts        ← Weekly CSV backup cron job
│
├── shared/
│   ├── schema.ts             ← Drizzle table definitions (single source of truth)
│   ├── types.ts              ← Shared TypeScript types
│   └── const.ts              ← Shared constants
│
├── Dockerfile                ← Multi-stage Docker build for Railway
├── pnpm-workspace.yaml       ← pnpm config (allowBuilds for esbuild/clerk/tailwind)
├── drizzle.config.ts         ← Drizzle Kit config (points to shared/schema.ts)
├── vite.config.ts            ← Vite config (React plugin, PWA, path aliases)
├── tailwind.config.ts        ← Tailwind v4 config
├── tsconfig.json             ← TypeScript config (path alias @/ → client/src/)
├── todo.md                   ← Feature/bug tracking
├── design.md                 ← UI/UX design decisions
└── ARCHITECTURE.md           ← This file
```

---

## 5. Authentication Flow

Synapse uses **Clerk** for identity management. The flow is:

1. The React SPA wraps the entire app in `<ClerkProvider>` (configured in `client/src/main.tsx`).
2. On login, Clerk issues a JWT. The tRPC client attaches it as a `Bearer` token on every request.
3. The Express server applies `clerkMiddleware` **only to `/api` routes** — static files load without auth.
4. `createContext` (`server/_core/context.ts`) calls `getAuth(req)` to extract the Clerk user ID, then looks up (or auto-creates) the corresponding row in the `users` table. The resulting `{ req, res, user }` object is the tRPC context.
5. `protectedProcedure` throws `UNAUTHORIZED` if `ctx.user` is null. `adminProcedure` additionally requires `ctx.user.role === "admin"`.

**First-login behavior:** If no `users` row exists for the Clerk ID, `context.ts` inserts one using the name and email from the Clerk profile. The `ADMIN_EMAIL` env var auto-promotes that address to `role: "admin"`.

**Client-side auth gating** (`App.tsx`):
- Loading → `DashboardLayoutSkeleton`
- No user → `Landing` (Clerk sign-in)
- User with no name → `ProfileCompletion` modal
- Authenticated → `AuthenticatedRouter` (full app)

---

## 6. tRPC API Layer

All API calls go through tRPC at `/api/trpc`. The client uses `httpBatchLink` with `superjson` serialization. The full router tree is:

| Router | Key Procedures | Auth Level |
|---|---|---|
| `system` | `getVersion` | public |
| `auth` | `me` | public |
| `profile` | `get`, `update` | protected |
| `modules` | `list`, `get`, `create`, `update`, `delete` | protected / admin |
| `lessons` | `list`, `get`, `create`, `update`, `delete` | protected / admin |
| `progress` | `get`, `markComplete` | protected |
| `answers` | `save`, `get` | protected |
| `ai` | `chat`, `streamChat` | protected |
| `content` | `generate`, `history` | protected |
| `routine` | `get`, `update`, `complete` | protected |
| `coupons` | `validate`, `create`, `list` | protected / admin |
| `coaching` | `getSteps`, `getProgress`, `saveAnswer`, `chat` | protected |
| `adminStats` | `getUsers`, `getActivity` | admin |
| `wwld` | `getToday`, `getTodayStatus`, `saveSession`, `getStats`, `getAnalytics`, `getDailyAction` | protected |

---

## 7. Database Schema

All tables are defined in `shared/schema.ts` using Drizzle ORM. The database is a Railway-managed PostgreSQL instance.

| Table | Purpose |
|---|---|
| `users` | App users; synced from Clerk on first login |
| `modules` | Coaching curriculum modules (admin-managed) |
| `module_steps` | Structured steps within each module |
| `user_step_progress` | Per-user completion state for coaching steps |
| `step_chat_messages` | AI coaching conversation history per step |
| `lessons` | Reading/content lessons within modules |
| `user_progress` | Per-user lesson completion |
| `user_answers` | User responses to lesson questions |
| `chat_messages` | General AI chat history |
| `daily_tasks` | Daily routine task completion |
| `streaks` | Current and longest completion streaks |
| `content_history` | AI-generated content studio outputs |
| `coupons` | Discount codes with usage limits |
| `wwld_sessions` | Daily practice stats (OV, NP, TR, PE, PR, CPS) |
| `lyle_content` | 114-row recommendation content bank (seeded at startup) |
| `lyle_served_log` | Tracks which content items each user has received (12-month dedup) |

**Schema changes:** Run `pnpm db:push` to generate and apply migrations via Drizzle Kit. The `drizzle.config.ts` points to `shared/schema.ts` and `DATABASE_URL`.

---

## 8. WWLD — What Would Lyle Do?

WWLD is the core practice growth feature. Users log daily stats (Office Visits, New Patients, Test Results, Progress Exams, Performance Reviews, Care Plans Signed) and receive trend-based coaching recommendations.

### 8.1 Stats Logging

Stats are stored in `wwld_sessions` with a unique constraint on `(userId, sessionDate, sessionType)`. Session types are `morning`, `afternoon`, and `end_of_day`. The `saveSession` procedure upserts on conflict, so re-submitting a session overwrites rather than duplicates.

### 8.2 Lyle Algorithm (`getDailyAction` procedure)

The algorithm runs server-side on every call and follows this sequence:

**Step 1 — Fetch data.** Pull the last 28 days of `wwld_sessions` for the user, aggregated by day into `dailyBreakdown`.

**Step 2 — Compute trend states.** For each of the three key metrics (Office Visits, New Patients, Care Plans Signed), compare the 7-day recent average against the prior 7-day average:

| Condition | State |
|---|---|
| < 7 days of data | `breaking` (default — new users get urgent content immediately) |
| ≥ 15% decline | `breaking` |
| 5–15% decline | `slipping` |
| < 5% change, low variance (< 10% CV over 21 days) | `stuck` |
| < 5% change, higher variance | `plateaued` |
| < 15% growth | `climbing` |
| ≥ 15% growth | `momentum` |

**Step 3 — Prioritize.** The most urgent metric drives the recommendation. Priority order: `breaking > slipping > stuck > plateaued > climbing > momentum`.

**Step 4 — Select content.** Content is pulled from `lyle_content` using a three-level fallback:
1. Match on `pillar + cadence + trendState` (most specific)
2. Match on `pillar + cadence` only
3. Match on `trendState + cadence` only
4. Full pool reset (prevents ever showing nothing)

Already-served content IDs (from `lyle_served_log`, last 12 months) are excluded at every level. The daily pick is deterministic within the day using `(userId × 17 + dateInt) mod poolSize` so the same user sees the same recommendation all day.

**Step 5 — Return.** The procedure returns `{ trendState, triggerMetric, triggerValue, pillar, weeklyTheme, dailyAction, hasEnoughData }`.

### 8.3 Content Bank

114 rows seeded from `server/seed-lyle.ts` on server startup (idempotent — skips if rows exist):

| Cadence | Count | Purpose |
|---|---|---|
| `weekly` | 52 | Weekly theme shown Mon–Sun |
| `daily` | 62 | Today's single action step |

Content is distributed across 6 trend states and 8 pillars (e.g., "Closing & Sales Skill", "Referral & Visibility", "Personal Growth & Discipline").

### 8.4 Frontend Card (`LyleRecommendationCard`)

Located at `client/src/components/wwld/LyleRecommendationCard.tsx`. Renders below the 6 stat tiles on the Today/WTD/MTD/YTD tabs. Color-coded by state (red = breaking, orange = slipping, yellow = stuck/plateaued, emerald = climbing, gold = momentum). Shows pillar, trigger metric + this week's value, weekly theme, and today's bold action line. 5-minute client-side cache via `staleTime`.

### 8.5 WWLD Login Redirect

`WwldLoginRedirect` (in `App.tsx`) silently redirects users to `/wwld` on first login of the day if no sessions have been logged yet. This ensures stats entry is the first thing users do each morning.

### 8.6 Weekly Backup

`server/wwld-backup.ts` schedules a `node-cron` job (every Sunday at 11 PM server time) that exports all `wwld_sessions` rows as a CSV and emails it to `BACKUP_EMAIL` via Gmail SMTP. Requires `SMTP_USER`, `SMTP_PASS`, and `BACKUP_EMAIL` env vars. Skips silently if not configured.

---

## 9. LLM Abstraction

All AI calls go through `server/_core/llm.ts` via `invokeLLM(messages)`. The function implements a **3-deep fallback chain with retry and timeout**:

1. **Gemini 2.5 Flash** — 2 retries, 1s exponential backoff, 15s timeout
2. **Groq `openai/gpt-oss-120b`** — 15s timeout
3. **Groq `qwen-qwq-32b`** — 15s timeout
4. **Groq `llama-3.1-8b-instant`** — last resort

Auth errors (401/403) are not retried. The response includes a `provider` field indicating which model answered. Features using LLM: AI coaching chat, content studio generation, general chat.

---

## 10. Startup Jobs

On every server start (after the port is bound), three jobs run:

| Job | Function | Behavior |
|---|---|---|
| Coaching seed | `seedCoachingSteps()` | Creates module steps for the 6-module curriculum. Idempotent — skips if rows exist. |
| Lyle seed | `seedLyleAlgorithmContent()` | Inserts 114 content rows into `lyle_content`. Idempotent — skips if rows exist. |
| WWLD backup scheduler | `scheduleWwldBackup()` | Registers the Sunday 11 PM cron job. No-ops if SMTP not configured. |

---

## 11. Environment Variables

All env vars are read through `server/_core/env.ts`. This is the single source of truth — never reference `process.env` directly outside this file.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Railway provides this) |
| `CLERK_SECRET_KEY` | Yes | Clerk server-side auth key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Clerk client-side key (also used server-side for middleware) |
| `GEMINI_API_KEY` | Yes | Primary LLM provider |
| `GROQ_API_KEY` | Yes | LLM fallback provider |
| `ADMIN_EMAIL` | Yes | Auto-promoted to `role: "admin"` on first login |
| `STRIPE_SECRET_KEY` | Optional | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook validation |
| `SMTP_USER` | Optional | Gmail address for WWLD backup emails |
| `SMTP_PASS` | Optional | Gmail App Password |
| `BACKUP_EMAIL` | Optional | Backup destination (defaults to `ADMIN_EMAIL`) |
| `CLIENT_URL` | Optional | Additional CORS origin in production |
| `PORT` | Optional | Server port (Railway sets this automatically) |

---

## 12. Deployment

**Platform:** Railway (Docker-based)  
**Trigger:** Every push to `main` branch on GitHub triggers a Railway build  
**Build process:**
1. `pnpm install --frozen-lockfile` (deps stage)
2. `pnpm build` → `vite build` + `esbuild server/_core/index.ts` (build stage)
3. Copy `dist/` and `node_modules/` into `node:22-slim` production image
4. `CMD ["node", "dist/index.js"]`

**Important:** `pnpm-workspace.yaml` must include `packages: []` and `allowBuilds` set to `true` for `@clerk/shared`, `@tailwindcss/oxide`, and `esbuild`. Without this, `pnpm install` fails in Docker with "packages field missing or empty."

**Database migrations:** Run `pnpm db:push` locally against the Railway DB (using `DATABASE_URL` from Railway env vars). Drizzle Kit generates and applies migrations. Do not run migrations in the Docker build step.

**Health check:** `GET /api/health` returns `{ ok: true, timestamp }` — no auth required. Railway uses this to verify the container is up.

---

## 13. Key Conventions

**Data access:** All database queries live in `server/db.ts` as exported async functions. Routers call these functions — they never write SQL inline. This keeps routers readable and makes DB logic testable in isolation.

**Shared types:** `shared/schema.ts` is the single source of truth for table shapes. Drizzle's `$inferSelect` and `$inferInsert` types are exported and used throughout both server and client.

**No mock data in UI:** If data is unavailable, components show loading states or "—". Hardcoded placeholder numbers are not permitted.

**Idempotent seeds:** All seed functions check for existing rows before inserting. They are safe to run on every server start.

**tRPC procedure levels:** `publicProcedure` for unauthenticated endpoints, `protectedProcedure` for all user-facing features, `adminProcedure` for admin-only operations. Never use `publicProcedure` for anything that touches user data.

**LLM calls:** Always use `invokeLLM()` from `server/_core/llm.ts`. Never call Gemini or Groq SDKs directly from routers.

---

## 14. Feature Map

| Feature | Route | Key Files |
|---|---|---|
| Dashboard / Home | `/` | `pages/Home.tsx` |
| Coaching Curriculum | `/curriculum` | `pages/Curriculum.tsx`, `ModuleDetail.tsx`, `LessonView.tsx`, `ModuleCoaching.tsx` |
| AI Chat Coach | `/chat` | `pages/Chat.tsx`, `routers.ts → aiRouter` |
| Content Studio | `/content` | `pages/ContentStudio.tsx`, `routers.ts → contentRouter` |
| Daily Routine | `/routine` | `pages/DailyRoutine.tsx`, `routers.ts → routineRouter` |
| WWLD Stats | `/wwld` | `pages/WWLD.tsx`, `components/wwld/*`, `routers.ts → wwldRouter` |
| Profile | `/profile` | `pages/Profile.tsx`, `routers.ts → profileRouter` |
| Admin — Modules | `/admin/modules` | `pages/AdminModules.tsx` |
| Admin — Stats | `/admin/stats` | `pages/AdminStats.tsx`, `routers.ts → adminStatsRouter` |
