# Synapse Deployment Guide

This guide walks through deploying Synapse to **Vercel** (frontend) and **Railway** (backend + database). The app is fully independent of Manus infrastructure.

## Architecture Overview

| Component | Service | Purpose |
|-----------|---------|---------|
| Frontend | Vercel | React SPA (Vite build) |
| Backend | Railway | Express + tRPC API |
| Database | Railway | PostgreSQL |
| Auth | Clerk | Google OAuth, user management |
| AI | Google Gemini | Coaching, content generation |
| AI Fallback | Groq | Automatic failover |
| Payments | Stripe | Subscriptions, coupons |

## Prerequisites

Before deploying, you need accounts and API keys from:

1. **Clerk** (clerk.com) — Publishable Key + Secret Key
2. **Google AI Studio** (aistudio.google.com) — Gemini API Key (free)
3. **Groq** (console.groq.com) — API Key (free, optional fallback)
4. **Stripe** (stripe.com) — Secret Key + Webhook Secret (when ready for payments)

---

## Step 1: Push to GitHub

```bash
cd synapse
git init
git add .
git commit -m "Initial Synapse commit — Clerk, Gemini, PostgreSQL"
gh repo create synapse --private --push --source .
```

## Step 2: Set Up Railway (Backend + Database)

### 2a. Create PostgreSQL Database

1. Go to [railway.app](https://railway.app) and create a new project
2. Click **"New"** → **"Database"** → **"PostgreSQL"**
3. Once created, go to the database service → **Variables** tab
4. Copy the `DATABASE_URL` value (starts with `postgresql://...`)

### 2b. Deploy the Backend

1. In the same Railway project, click **"New"** → **"GitHub Repo"**
2. Select your `synapse` repository
3. Railway will auto-detect the Dockerfile
4. Go to **Settings** → set the root directory to `/` (default)
5. Go to **Variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | From step 2a |
| `CLERK_SECRET_KEY` | `sk_live_...` | From Clerk dashboard |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From Clerk dashboard |
| `GEMINI_API_KEY` | `AIza...` | From Google AI Studio |
| `GROQ_API_KEY` | `gsk_...` | From Groq console (optional) |
| `ADMIN_EMAIL` | Your email | Gets admin role on first sign-in |
| `CLIENT_URL` | `https://synapse.us` | Your Vercel domain |
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `production` | |

6. Click **"Deploy"**
7. Go to **Settings** → **Networking** → **Generate Domain** (or add custom domain)

### 2c. Run Database Migrations

After the first deploy, open the Railway service shell (or use Railway CLI):

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 2d. Seed the Curriculum

```bash
npx tsx server/seed.ts
```

This populates the Bridge the Gap curriculum (6 modules with all lessons).

## Step 3: Deploy to Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) and import the same GitHub repo
2. Set **Framework Preset** to **Vite**
3. Set **Root Directory** to `client`
4. Set **Build Command** to `cd .. && pnpm build` (builds from project root)
5. Set **Output Directory** to `../dist/public`
6. Add environment variables:

| Variable | Value |
|----------|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` (same as Railway) |
| `VITE_API_URL` | `https://your-railway-domain.up.railway.app` |

7. Deploy

**Alternative:** If you prefer a single Railway deployment (backend serves the frontend too), skip Vercel entirely. The Express server already serves static files in production mode.

## Step 4: Configure Clerk

1. Go to [clerk.com](https://clerk.com) → your application
2. Under **Domains**, add your production domain (e.g., `synapse.us`)
3. Under **Social Connections**, enable Google OAuth
4. Under **Redirect URLs**, add:
   - `https://synapse.us` (or your Vercel domain)
   - `https://your-railway-domain.up.railway.app` (if using Railway-only)

## Step 5: Configure Stripe (When Ready)

1. Get your Stripe Secret Key from the Stripe dashboard
2. Create a webhook endpoint pointing to `https://your-railway-domain.up.railway.app/api/stripe/webhook`
3. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to Railway variables
4. Redeploy

---

## Environment Variables Reference

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `DATABASE_URL` | Yes | Railway | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | Railway | Clerk backend secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes | Both | Clerk frontend key |
| `GEMINI_API_KEY` | Yes | Railway | Google Gemini API key |
| `GROQ_API_KEY` | No | Railway | Groq fallback API key |
| `STRIPE_SECRET_KEY` | No | Railway | Stripe payments (add later) |
| `STRIPE_WEBHOOK_SECRET` | No | Railway | Stripe webhook verification |
| `ADMIN_EMAIL` | Yes | Railway | Your email for admin access |
| `CLIENT_URL` | Yes | Railway | Frontend URL for CORS |
| `PORT` | No | Railway | Server port (default: 3001) |
| `NODE_ENV` | Yes | Railway | Set to `production` |

## Local Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USER/synapse.git
cd synapse

# Copy env template
cp .env.example .env
# Fill in your keys in .env

# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Seed curriculum data
pnpm db:seed

# Start dev server (frontend + backend)
pnpm dev
```

The app runs at `http://localhost:3001` with hot reload for both frontend and backend.

---

## Single-Server Deployment (Railway Only)

If you prefer not to use Vercel, Railway can serve everything:

1. The Express server already serves the Vite build output in production
2. Just deploy to Railway with all env vars
3. The build step (`pnpm build`) compiles both frontend and backend
4. Point your domain to the Railway service

This is the simplest option and avoids CORS configuration entirely.
