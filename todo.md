# Synapse TODO

## Manus Dependency Removal
- [x] Remove vite-plugin-manus-runtime from vite.config.ts and package.json
- [x] Remove @builder.io/vite-plugin-jsx-loc from vite.config.ts and package.json
- [x] Remove Manus debug collector plugin from vite.config.ts
- [x] Remove Manus OAuth (server/_core/oauth.ts, cookies, session)
- [x] Remove Manus LLM wrapper — replaced with Gemini+Groq abstraction
- [x] Remove Manus SDK references (server/_core/sdk.ts)
- [x] Clean package.json of all Manus-only dependencies
- [x] Remove Manus analytics from index.html
- [x] Remove __manus__ debug collector directory

## Auth: Manus OAuth → Clerk
- [x] Add @clerk/clerk-react and @clerk/express
- [x] Create Clerk provider wrapper in client (main.tsx)
- [x] Replace useAuth hook with Clerk hooks
- [x] Replace server auth middleware with Clerk express middleware
- [x] Update user table to use Clerk user IDs (clerkId column)
- [x] Update Landing page sign-in to use Clerk SignInButton
- [x] Update protected routes to use Clerk session
- [x] Auto-create user on first Clerk sign-in

## Database: MySQL → PostgreSQL
- [x] Switch drizzle config from mysql to postgresql
- [x] Rewrite schema from mysqlTable to pgTable (shared/schema.ts)
- [x] Replace mysql2 with pg in dependencies
- [x] Update db.ts queries for PostgreSQL
- [x] Add user_answers table for curriculum answer persistence
- [x] Add daily_tasks and streaks tables
- [x] Add content_history table
- [x] Add coupons table

## AI: Manus LLM → Gemini with fallback
- [x] Add @google/generative-ai dependency
- [x] Create LLM abstraction layer with provider interface (server/_core/llm.ts)
- [x] Implement Gemini provider (primary)
- [x] Implement Groq provider (fallback)
- [x] Add automatic failover on 429/5xx errors
- [x] Update AI chat router to use new LLM layer

## Build Config Cleanup
- [x] Clean vite.config.ts — remove all Manus plugins, add API proxy
- [x] Update package.json scripts for standalone dev/build
- [x] Add .env.example with all required env vars
- [x] Create Dockerfile for Railway deployment
- [x] CORS restricted to known origins in production
- [x] Remove unused UI components with missing dependencies

## Port Curriculum Data
- [x] Create seed script to populate Bridge the Gap curriculum in database (server/seed.ts)
- [x] AI coaching system prompt includes full curriculum context
- [x] Answer carry-forward logic — all previous answers injected into AI context

## New Features: Content Studio
- [x] Create Content Studio page with 6 content types (server route + client page)
- [x] AI generation using curriculum context (user answers injected into prompts)
- [x] Content history persistence

## New Features: Daily Routine + Streaks
- [x] Create Daily Routine page with task checklist (server route + client page)
- [x] Implement streak tracking logic (current + longest streak)
- [x] Streak display with badge milestones

## New Features: Coupons
- [x] Coupon validation (public endpoint)
- [x] Admin coupon CRUD (create, list, update)
- [x] Discount percent and free trial support

## Existing Features (kept as-is)
- [x] Landing page with hero, features, CTA
- [x] Dashboard — progress overview, continue card
- [x] Curriculum page — module list with progress indicators
- [x] Lesson view — content display + AI coaching chat panel
- [x] AI coaching — contextual to lesson material + answer carry-forward
- [x] Save & complete lesson flow
- [x] Self-paced progression (no time gates)
- [x] Admin module CRUD
- [x] Admin lesson CRUD
- [x] Profile page
- [x] Chat history persistence
- [x] Dark mode support
- [x] Responsive design

## Build Verification
- [x] TypeScript check — zero errors
- [x] Production build — Vite + esbuild both succeed
- [x] All 15 tests passing
- [x] No Manus references remaining in codebase

## Still Needed (requires your credentials)
- [x] Clerk keys — to enable auth
- [x] Gemini API key — to enable AI coaching
- [x] Railway PostgreSQL — to enable database
- [ ] Stripe keys — to enable payments (last step)
- [x] Deploy to Railway (full-stack)

## Bug Fixes (April 2026)
- [x] Fix mobile coaching layout: font sizes too small, description truncated, keyboard covers input
- [x] Remove unnecessary 'Let's get started' button — auto-start coaching conversation
- [x] Hide auto-start trigger message from chat display
- [x] Add onError handler to chat mutation — surface LLM failures visibly
- [x] Prevent race condition: block send while mutation is pending
- [x] Fix Groq fallback: llama-3.1-70b-versatile decommissioned → llama-3.3-70b-versatile
- [x] Fix Confirm My Answer button: add onError, use last user message as answer, only show when AI has responded
- [x] Add Groq API key to Railway environment

## New Feature: Voice Dictation
- [x] Add mic button to coaching chat input — Web Speech API speech-to-text

## UX Improvements (April 27, 2026)
- [x] Make confirm button orange/gold with more readable text
- [x] Add next-module navigation when all steps in a module are complete

## Bug Fix (April 27, 2026)
- [x] Fix module completion dead end: next-module button not appearing after completing all steps
- [x] Ensure state resets properly when navigating between modules

## Bug Fix (May 2, 2026)
- [x] Fix speech-to-text: microphone repeats/duplicates text endlessly in continuous mode

## Feature (May 26, 2026)
- [x] Enforce sequential module progression: lock modules until previous one is complete
- [x] Show locked state on module cards (lock icon, dimmed, "Complete X first")
- [x] Prevent direct URL navigation to locked modules (redirect to curriculum)

## Bug Fix (May 27, 2026)
- [x] Fix Overall Progress not updating on dashboard/curriculum
- [x] Fix Lessons Learned not updating on dashboard/curriculum

## Landing Page (Sales Funnel) - June 2026
- [x] Build new high-converting landing/sales page (front-end only)
- [x] Section 1: Hero — headline, sub-headline, CTA anchoring to pricing
- [x] Section 2: Agitation — pain points (agencies, social media, overwhelm)
- [x] Section 3: Solution — 3 pillars with icons (Targeting, Daily Steps, Accountability)
- [x] Section 4: Inside the App — UI mockup/screenshot visual proof
- [x] Section 5: Pricing — Monthly $74.99 vs Annual $749 (highlight annual "Best Value")
- [x] Section 6: Guarantee — 14-Day "Full Waiting Room" Guarantee
- [x] Remove global nav on landing page; keep only small Login button top-right
- [x] TypeScript check passes, commit, push to GitHub

## Admin User Analytics - June 2026
- [x] Add read-only admin stats endpoint (total users, active 7d/30d, steps completed, module breakdown)
- [x] Build /admin/stats page with metric cards and user activity table
- [x] Add "User Analytics" link to admin sidebar menu

## Profile Completion Gate - June 2026
- [x] Require name before app access (full-screen gate)
- [x] Existing users without name see prompt once, then never again
- [x] New users see it immediately after first sign-in
- [x] Shows email (read-only from Google) + required name field

## PWA Support - June 2026
- [x] Add manifest.json with Synapse branding (gold theme, dark background)
- [x] Add service worker (cache-first static, network-first API)
- [x] Generate PWA icons (192px, 512px, apple-touch-icon)
- [x] Build PWAInstallPrompt component (Android/Desktop native prompt)
- [x] iOS detection with Share → Add to Home Screen hint
- [x] Dismissible banner (remembers 7 days, doesn't show if installed)
- [x] Add apple-mobile-web-app meta tags to index.html
- [x] TypeScript check passes
- [x] Push to GitHub

## Celebrations - July 2026
- [x] Fireworks/confetti animation when a module is completed

## WWLD Analytics Upgrade (July 2026)
- [ ] Add getWwldAnalytics tRPC procedure (30-day daily data, day-of-week aggregates, week-over-week)
- [ ] Build TrendLineChart component (30-day line chart with Recharts)
- [ ] Build WeekComparisonChart component (this week vs last week bars)
- [ ] Build DayOfWeekChart component (average by day heatmap bars)
- [ ] Build MonthComparisonChart component (current vs prior month)
- [ ] Build TrendInsightCards component (rule-based plain-English observations)
- [ ] Upgrade WWLD.tsx analytics tab with all new charts and insights
- [ ] Make WWLD the first screen after login (redirect from / to /wwld if stats not logged today)

## Lyle Algorithm (July 2026)
- [x] Add lyle_content and lyle_served_log tables to schema.ts
- [x] Seed lyle_content from CSV on server startup
- [x] Add DB functions for content lookup and served log
- [x] Build diagnostic engine (6-state: Breaking/Slipping/Stuck/Plateaued/Climbing/Momentum)
- [x] Build getDailyAction tRPC procedure with deduplication
- [x] Build WWLD recommendation card on frontend
- [x] Run DB migrations on Railway

## Coaching UI Redesign (August 2026)
- [x] Move text input above Confirm & Next Step button
- [x] Rename green send button to "Send" (green color, Send icon)
- [x] Add step-by-step instruction labels (Step 1 / Step 2)
- [x] Visually separate the two actions so users understand the flow
- [x] Rename "Confirm & Next Step" to "Save & Continue"

## Isolated Engagement Build and Staged Rollout (August 2026)
- [x] Validate GitHub repository access and clone the current production source into an isolated workspace
- [x] Create a dedicated engagement implementation branch
- [x] Correct the stale Gemini API test configuration and replace the decommissioned Groq 8B fallback in the isolated baseline
- [x] Record passing TypeScript, 23-test, and production-build baseline results
- [ ] Write the staging, data-migration, feature-flag, rollback, and acceptance-criteria plan
- [ ] Build the Today’s Growth Plan, action tracking, content activation, and outcome capture behind feature flags
- [ ] Build contextual cues, weekly review, re-entry flow, and campaign framework behind feature flags
- [ ] Run automated tests, staging smoke tests, pilot validation, and production-promotion review
