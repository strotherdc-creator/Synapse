import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { clerkMiddleware } from "@clerk/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { seedCoachingSteps } from "../seed-coaching";
import { seedLyleAlgorithmContent } from "../seed-lyle";
import { scheduleWwldBackup } from "../wwld-backup";
import { runMigrations } from "../db";
import { ENGAGEMENT_MIGRATIONS } from "../engagement/migrations";
import { scheduleEngagementEmails } from "../engagement/email-reminders";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3001): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=()");
    next();
  });

  // Body parser
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // CORS — Railway serves both frontend and backend from the same origin.
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : "https://synapse-production-daae.up.railway.app";

  const allowedOrigins = ENV.isProduction
    ? [railwayUrl, process.env.CLIENT_URL].filter(Boolean) as string[]
    : ["http://localhost:5173", "http://localhost:3001"];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // Health check — no auth needed
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // --- API routes: Clerk middleware + tRPC ---
  // Clerk middleware is ONLY applied to /api/* routes.
  // This is correct for a React SPA architecture where:
  //   - Static files (HTML/JS/CSS) need no server-side auth
  //   - ClerkProvider on the client handles auth UI
  //   - The server only verifies tokens on API calls
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "";

  if (ENV.clerkSecretKey && publishableKey) {
    // Apply Clerk middleware ONLY to /api routes, with handshake disabled.
    // Handshake is a server-rendering feature (Next.js); not needed for SPA.
    app.use(
      "/api",
      clerkMiddleware({
        publishableKey,
        secretKey: ENV.clerkSecretKey,
      })
    );
    console.log("[Auth] Clerk middleware enabled on /api routes");
  } else {
    console.warn(
      "[Auth] Clerk keys not fully configured — auth middleware disabled",
      { hasSecret: !!ENV.clerkSecretKey, hasPublishable: !!publishableKey }
    );
  }

  // Communication Coach is authenticated like every other user-facing API.
  app.use("/api/communication", communicationRouter);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // --- Static files: served WITHOUT auth middleware ---
  // In dev, Vite handles serving. In production, serve the built client files.
  // No Clerk middleware here — the SPA shell loads for everyone,
  // and ClerkProvider on the client handles auth state.
  if (!ENV.isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Global error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error("[Server] Unhandled error:", err?.message ?? err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const preferredPort = ENV.port;
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
    console.log(`Environment: ${ENV.isProduction ? "production" : "development"}`);
    console.log(`Clerk: ${ENV.clerkSecretKey && publishableKey ? "configured (/api only)" : "NOT configured"}`);
    console.log(`Database: ${ENV.databaseUrl ? "configured" : "NOT configured"}`);
    console.log(`Gemini: ${ENV.geminiApiKey ? "configured" : "NOT configured"}`);

    // Run schema migrations (idempotent — safe on every startup)
    runMigrations(ENGAGEMENT_MIGRATIONS).catch((err) => console.error("[Migrations] Failed:", err));
    // Seed coaching steps (idempotent — only runs if tables are empty)
    seedCoachingSteps().catch((err) => console.error("[Seed] Failed:", err));
    seedLyleAlgorithmContent().catch((err) => console.error("[Lyle Seed] Failed:", err));
    // Schedule weekly WWLD data backup (production only, requires SMTP_USER + SMTP_PASS)
    scheduleWwldBackup();
    // Schedule engagement email reminders (daily + weekly review)
    scheduleEngagementEmails();
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
import { communicationRouter } from "../communication/router";
