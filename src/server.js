import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { env, assertRequiredEnv } from "./config/env.js";
import { connectDb } from "./lib/mongoose.js";
import registrationRoutes from "./routes/registration.routes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import ownerRoutes from "./routes/owner.routes.js";

assertRequiredEnv();

const app = express();
app.set("trust proxy", 1);

const allowedOrigins = new Set([
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
try {
  const frontendOrigin = new URL(env.FRONTEND_URL).origin;
  allowedOrigins.add(frontendOrigin);
} catch {
  // ignored
}

app.use(
  "/api/webhooks",
  rateLimit({ windowMs: 60 * 1000, max: 120 }),
  webhookRoutes,
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 250 }));

app.get("/", (req, res) => {
  res.json({ message: "AutoVault backend running", timestamp: Date.now() });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/registrations", registrationRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/owner", ownerRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    message: "Internal server error",
    error: env.NODE_ENV === "development" ? error.message : undefined,
  });
});

export async function startServer() {
  await connectDb();
  const port = env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`[server] running on port ${port}`);
  });
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  startServer().catch((error) => {
    console.error("[server] failed to start:", error);
    process.exit(1);
  });
}

export default app;
