# Synapse — Web Application Design Document

## Overview

Synapse is a self-paced professional development platform built exclusively for chiropractors. The first program, **"Bridge the Gap"**, guides practitioners through 6 structured modules that help them differentiate their practice, define their ideal patient, craft compelling messaging, and build daily visibility habits. Each module's answers carry forward into the next, creating a personalized toolkit that grows with the user.

The platform combines structured curriculum with contextual AI coaching (Google Gemini), content generation tools, daily routine tracking, and administrative controls. It is a responsive web application that works on phones, tablets, and desktop computers.

**Domain:** synapse.us  
**Tech Stack:** React 19 + Vite 7 + TypeScript (client), Express + tRPC (server), Drizzle ORM + PostgreSQL (database), Tailwind CSS 4 + shadcn/ui (styling), Clerk (auth), Google Gemini (AI), Stripe (payments)  
**Hosting:** Vercel (frontend) + Railway (backend + database)

---

## Screen List

### Public Screens

| Screen | Purpose | Key Elements |
|--------|---------|--------------|
| **Landing Page** | Convert visitors to sign-ups | Hero section, feature highlights, pricing tiers, testimonials, CTA buttons |
| **Pricing Section** | Show subscription options | Plan cards, coupon code input, Stripe checkout trigger |

### Authenticated Screens (Dashboard Shell)

| Screen | Purpose | Key Elements |
|--------|---------|--------------|
| **Home / Dashboard** | Daily hub — progress at a glance | Streak counter, progress ring, "Continue" card, daily routine preview, quick actions |
| **Curriculum** | Browse all 6 modules | Module cards with progress bars, lesson counts, lock/unlock indicators |
| **Module Detail** | View lessons within a module | Lesson list with completion checkmarks, module description, AI coaching entry |
| **Lesson View** | Core learning experience | Lesson content (markdown), AI coaching chat panel, save/complete button |
| **AI Coach Chat** | General-purpose contextual assistant | Chat interface, suggested prompts, full curriculum context |
| **Content Studio** | Generate marketing materials | Content type selector (6 types), AI generation, copy-to-clipboard |
| **Daily Routine** | Daily visibility tasks | Personalized task checklist, streak calendar, badge display |
| **Progress / Reports** | Weekly summaries | Progress charts, streak history, weekly report cards |
| **Profile / Settings** | Account management | Name, email, avatar, subscription status, notification preferences |

### Admin Screens (Admin role only)

| Screen | Purpose | Key Elements |
|--------|---------|--------------|
| **Admin Dashboard** | Platform overview | User count, active subscriptions, completion rates |
| **Admin Modules** | Curriculum CRUD | Create/edit/reorder modules and lessons, publish/draft toggle |
| **Admin Users** | User management | User list, role assignment, subscription status, progress overview |
| **Admin Coupons** | Coupon management | Create codes (free trial 100% off, % discount), usage tracking, enable/disable |

---

## Primary Content and Functionality

### Dashboard (Home)

The dashboard is the user's daily starting point. It displays the current streak count with a flame icon, an overall progress ring showing lessons completed out of total, and a prominent "Continue where you left off" card that links directly to the next incomplete lesson. Below that, a condensed view of today's daily routine tasks appears, along with quick-action buttons for Content Studio and AI Coach. A weekly progress summary card rounds out the page.

### Curriculum Browser

The curriculum page presents the 6 "Bridge the Gap" modules in a vertical card layout. Each card shows the module's emoji icon, title, description, lesson count, and a progress bar. Modules are self-paced with no time gates. A module is "available" once the previous module is fully completed (all lessons marked done). The first module is always unlocked. Admin users see all modules regardless of status.

### Lesson View (Core Learning Experience)

This is the most important screen. On desktop, it uses a split layout: lesson content on the left (60%) and AI coaching chat on the right (40%). On mobile, the chat appears below the content in a collapsible panel.

The lesson content is rendered from markdown and includes the coaching question for that step. The AI chat panel is contextual — it knows the current lesson's content, the user's previous answers from all prior modules, and the user's practice type. The AI coach uses the same "never reject, always build on the answer" philosophy from the Doctor Differentiator app. Users type their answers, the AI refines and coaches, and when satisfied, the user clicks "Save & Complete" to lock in their answer and mark the lesson done.

Previous answers are visible when revisiting completed lessons, with an option to edit/redo.

### AI Coach Chat (General)

A standalone chat screen where users can ask questions about any curriculum topic. The AI has full context of the user's completed answers across all modules, their practice type, and their positioning. It helps users apply concepts to their specific clinic situation. Chat history is persisted in the database.

### Content Studio

Six content types available: Social Posts, Video Scripts, Story Captions, Email Templates, Text Messages, and Referral Scripts. Each generation uses the user's curriculum answers as context — their ideal patient, one-sentence difference, table talk bank, and positioning. Output is plain text with a single "Copy" button. No PDF generation needed.

### Daily Routine

AI-generated daily tasks personalized to the user's curriculum answers. Tasks are organized into categories: Table Talk (using their one-liners), Referral Conversations (using their referral triggers), Community Outreach (using their community lane), plus Video, Post, and Message tasks. Tasks regenerate fresh each day. Streak tracking counts consecutive days with all tasks completed. Badges awarded at milestones (7, 14, 30, 60, 90 days).

### Weekly Progress Reports

Auto-generated weekly summaries that include lessons completed, streak status, tasks completed, and AI coaching highlights. These are viewable in-app and also pushed via email to the user's registered address.

---

## Key User Flows

### New User Onboarding

The new user visits synapse.us and sees the landing page. They click "Get Started," which takes them to the pricing section. They can optionally enter a coupon code (free trial or discount). After selecting a plan, they proceed to Stripe checkout. Upon successful payment, they are redirected to Clerk's Google OAuth sign-in. After authentication, they land on the Dashboard in a welcome state with Module 1 highlighted and a brief orientation message.

### Daily Learning Session

The user opens the Dashboard and sees their current streak and daily routine. They tap "Continue" to resume their next lesson. They read the lesson content, interact with the AI coach to refine their answers, and save their work. The lesson is marked complete, and they return to the curriculum to see their progress update. They then check off daily routine items to maintain their streak.

### Content Generation

The user navigates to Content Studio, selects a content type (e.g., Social Post), and optionally provides a topic or tone preference. The AI generates content using their curriculum answers as context — their positioning, ideal patient language, and one-liners. The user copies the text with one click.

### Admin Curriculum Management

An admin logs in and sees additional navigation items. They go to Admin Modules to create or edit modules and lessons. They can set sort order, write lesson content in markdown, add AI coaching summaries, and toggle publish/draft status. Changes are reflected immediately for users.

---

## Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `#10B981` (emerald-500) | `#34D399` (emerald-400) | Buttons, links, accents — health/growth feel |
| `background` | `#FAFAFA` | `#0F172A` (slate-900) | Page background |
| `surface` | `#FFFFFF` | `#1E293B` (slate-800) | Cards, panels, modals |
| `foreground` | `#0F172A` (slate-900) | `#F1F5F9` (slate-100) | Primary text |
| `muted` | `#64748B` (slate-500) | `#94A3B8` (slate-400) | Secondary text, placeholders |
| `border` | `#E2E8F0` (slate-200) | `#334155` (slate-700) | Borders, dividers |
| `success` | `#22C55E` | `#4ADE80` | Completed states, streaks |
| `warning` | `#F59E0B` | `#FBBF24` | Attention states |
| `error` | `#EF4444` | `#F87171` | Error states, destructive actions |
| `accent` | `#6366F1` (indigo-500) | `#818CF8` (indigo-400) | Badges, highlights, secondary accent |

The brand feel is clean, professional, and growth-oriented. Emerald green as the primary color conveys health and wellness, appropriate for a chiropractic audience. Dark mode is the default for comfortable extended use.

---

## Responsive Layout Strategy

**Mobile (< 768px):** Single-column layout. Bottom navigation bar with 4 tabs (Home, Learn, Studio, Profile). Lesson view stacks content above chat. Hamburger menu for admin screens.

**Tablet (768px–1024px):** Two-column layout where appropriate. Side navigation rail (icons only, expandable). Lesson view uses a 55/45 split.

**Desktop (> 1024px):** Full sidebar navigation with labels. Lesson view uses a 60/40 split for content and chat. Dashboard uses a 2-column grid for cards. Max content width of 1280px, centered.

---

## LLM Integration Architecture

The app uses a multi-provider LLM abstraction layer with automatic failover:

| Priority | Provider | Model | Cost | Rate Limits |
|----------|----------|-------|------|-------------|
| Primary | Google Gemini | gemini-2.0-flash | Free | 15 req/min, 1M tokens/day |
| Fallback 1 | Groq | llama-3.1-70b | Free | 30 req/min, 14,400/day |
| Fallback 2 | OpenRouter | Various free models | Free | Varies |

If the primary provider returns a 429 (rate limit) or 5xx error, the system automatically retries with the next provider. All providers receive the same contextual prompt, ensuring consistent coaching quality regardless of which model responds.

---

## Authentication (Clerk)

Clerk handles all authentication. Google OAuth is the primary (and initially only) sign-in method. Clerk provides user management dashboard (clerk.com), session tokens (JWT), webhook events for user creation/deletion, React components for sign-in UI, and server-side middleware for protecting API routes. The app owner controls all user data through their own Clerk account — completely independent of any build platform.

---

## Database Schema (PostgreSQL on Railway)

Tables: `users`, `modules`, `lessons`, `user_progress`, `user_answers`, `chat_messages`, `daily_tasks`, `streaks`, `coupons`, `subscribers`, `weekly_reports`

Key relationships: Users have many progress records, answers, chat messages, and streaks. Modules have many lessons (ordered by sortOrder). User answers are scoped to user + lesson, carrying forward across modules. Chat messages are scoped to user + optional lesson (null = general chat). Coupons track usage count and can be free-trial (100% off) or percentage discount.

---

## Features Carried Forward from Doctor Differentiator

| Feature | Status in Synapse |
|---------|-------------------|
| 6-module "Bridge the Gap" curriculum | Active — self-paced, no time gates |
| AI coaching (never-reject, contextual) | Active — Gemini primary, with failover |
| Daily Routine with AI-generated tasks | Active — personalized to curriculum answers |
| Content Studio (6 types, copy button) | Active — social, video, story, email, text, referral |
| Streak tracking + badges | Active — daily completion tracking |
| Weekly progress reports | Active — in-app + email push |
| Coupon system (free trial + % discount) | Active — admin-configurable |
| Subscriber management | Active — admin panel |
| GHL Lead Tracker | Built but disabled — for future activation |
| Stripe payments | Active — subscription model |
