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

  // --- Diagnostic endpoint (REMOVE AFTER DEBUGGING) ---
  app.get("/api/auth-debug", async (req: any, res: any) => {
    const result: Record<string, any> = {
      step1_headers: {
        hasAuthHeader: !!req.headers.authorization,
        authHeaderLen: req.headers.authorization?.length || 0,
      },
      step2_envKeys: {
        clerkSecretKeySet: !!ENV.clerkSecretKey,
        clerkSecretKeyPrefix: ENV.clerkSecretKey ? ENV.clerkSecretKey.substring(0, 12) + "..." : "EMPTY",
        clerkSecretKeyLen: ENV.clerkSecretKey?.length || 0,
        publishableKeyUsed: publishableKey ? publishableKey.substring(0, 25) + "..." : "EMPTY",
        publishableKeyLen: publishableKey?.length || 0,
        envClerkPublishable: (process.env.CLERK_PUBLISHABLE_KEY || "").substring(0, 25) || "NOT SET",
        envViteClerkPublishable: (process.env.VITE_CLERK_PUBLISHABLE_KEY || "").substring(0, 25) || "NOT SET",
      },
      step3_reqAuth: "not checked",
      step4_getAuth: "not checked",
      step5_jwtDecode: "not checked",
    };

    // Step 3: Check if clerkMiddleware decorated the request
    result.step3_reqAuth = {
      hasAuthProp: "auth" in req,
      authType: typeof req.auth,
    };

    // Step 4: Try getAuth
    try {
      const auth = getAuth(req);
      result.step4_getAuth = {
        userId: auth?.userId ?? null,
        sessionId: auth?.sessionId ?? null,
      };
    } catch (err: any) {
      result.step4_getAuth = { error: err.message };
    }

    // Step 5: Manually decode JWT payload (no verification) to see claims
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "");
      if (token) {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
          result.step5_jwtDecode = {
            sub: payload.sub,
            iss: payload.iss,
            azp: payload.azp,
            exp: payload.exp,
            iat: payload.iat,
            nbf: payload.nbf,
            now: Math.floor(Date.now() / 1000),
            expired: payload.exp < Math.floor(Date.now() / 1000),
          };
        } else {
          result.step5_jwtDecode = { error: `Token has ${parts.length} parts, expected 3` };
        }
      } else {
        result.step5_jwtDecode = { error: "No token in Authorization header" };
      }
    } catch (err: any) {
      result.step5_jwtDecode = { error: err.message };
    }

    res.json(result);
  });

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
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
