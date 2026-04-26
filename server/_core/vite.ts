import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    configFile: path.resolve(import.meta.dirname, "../../vite.config.ts"),
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production Docker, dist/index.js is at /app/dist/index.js
  // and client build is at /app/dist/public/
  // import.meta.dirname in esbuild output resolves to the dist folder
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.warn(
      `[Static] Client build not found at: ${distPath}. API-only mode.`
    );
    // Still serve API — just no frontend
    app.use("*", (_req, res, next) => {
      // Let API routes pass through, catch-all returns a simple message
      if (_req.originalUrl.startsWith("/api")) {
        return next();
      }
      res.status(200).json({
        message: "Synapse API is running. Frontend is served separately via Vercel.",
        health: "/api/health",
      });
    });
    return;
  }

  app.use(express.static(distPath));

  // SPA fallback — serve index.html for non-API routes
  app.use("*", (_req, res, next) => {
    if (_req.originalUrl.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
