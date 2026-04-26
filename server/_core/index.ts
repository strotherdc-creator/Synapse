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

  // Body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS — Railway serves both frontend and backend from the same origin.
  // Allow the Railway URL plus any CLIENT_URL override, and localhost for dev.
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

  // Health check — BEFORE any auth middleware so it always works
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Clerk authentication middleware — attaches auth to req
  // @clerk/express reads CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from env.
  // We also pass them explicitly from VITE_CLERK_PUBLISHABLE_KEY as a fallback.
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY || "";

  if (ENV.clerkSecretKey && publishableKey) {
    app.use(
      clerkMiddleware({
        publishableKey,
        secretKey: ENV.clerkSecretKey,
      })
    );
    console.log("[Auth] Clerk middleware enabled");
  } else {
    console.warn(
      "[Auth] Clerk keys not fully configured — auth middleware disabled",
      { hasSecret: !!ENV.clerkSecretKey, hasPublishable: !!publishableKey }
    );
  }

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Development mode uses Vite, production mode uses static files
  if (!ENV.isProduction) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Global error handler — prevents unhandled errors from crashing the process
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
    console.log(`Clerk: ${ENV.clerkSecretKey && publishableKey ? "configured" : "NOT configured"}`);
    console.log(`Database: ${ENV.databaseUrl ? "configured" : "NOT configured"}`);
    console.log(`Gemini: ${ENV.geminiApiKey ? "configured" : "NOT configured"}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
