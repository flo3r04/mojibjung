import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import {
  assertJwtSecretConfigured,
  buildCorsOptions,
  logCorsStatus,
  logSmtpStatus,
} from "./env";

// Port availability check removed as cloud providers assign a strict PORT

async function startServer() {
  // ─── 부트업 안전 검사 ────────────────────────────────────────────────────
  // 운영에서 누락된 필수 환경변수가 있으면 즉시 종료한다.
  assertJwtSecretConfigured();
  logSmtpStatus();
  logCorsStatus();

  const app = express();
  // 프록시(Render, Nginx 등) 뒤에서 client IP 와 secure cookie 가 정상 동작하도록
  app.set("trust proxy", 1);

  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // CORS — env 의 화이트리스트 정책 적용
  app.use(cors(buildCorsOptions()));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development" && !process.env.SKIP_VITE) {
    await setupVite(app, server);
  } else if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);

  server.listen(port, "0.0.0.0", () => {
    console.log(`[server] running on port ${port} (NODE_ENV=${process.env.NODE_ENV})`);
  });
}

startServer().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
