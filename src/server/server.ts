import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDashboard } from "./services/dashboard.js";
import {
  getLinkedInAuthStatus,
  handleLinkedInCallback,
  logoutLinkedInAuth,
  startLinkedInAuth
} from "./services/linkedinAuth.js";
import { getRuntimeDataDirectory } from "./services/storage.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const refreshToken = process.env.REFRESH_TOKEN ?? "";
const isProduction = process.env.NODE_ENV === "production";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, "../../client");

app.set("trust proxy", 1);

function asyncRoute<TRequest = express.Request, TResponse = express.Response>(
  handler: (request: TRequest, response: TResponse) => Promise<void>
) {
  return (request: TRequest, response: TResponse, next: express.NextFunction) => {
    void handler(request, response).catch(next);
  };
}

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    dataDir: getRuntimeDataDirectory()
  });
});

app.get("/api/auth/me", (request, response) => {
  response.json(getLinkedInAuthStatus(request));
});

app.get("/api/auth/linkedin/start", (request, response) => {
  startLinkedInAuth(request, response);
});

app.get("/api/auth/linkedin/callback", asyncRoute(async (request, response) => {
  await handleLinkedInCallback(request, response);
}));

app.post("/api/auth/logout", (request, response) => {
  logoutLinkedInAuth(request, response);
});

app.get("/api/dashboard", asyncRoute(async (_request, response) => {
  const payload = await getDashboard(false);
  response.json(payload);
}));

app.post("/api/dashboard/refresh", asyncRoute(async (_request, response) => {
  const payload = await getDashboard(true);
  response.json(payload);
}));

app.post("/api/internal/refresh", asyncRoute(async (request, response) => {
  const token = request.header("x-refresh-token");

  if (refreshToken && token !== refreshToken) {
    response.status(401).json({ message: "Refresh token mismatch." });
    return;
  }

  const payload = await getDashboard(true);
  response.json({
    ok: true,
    generatedAt: payload.generatedAt
  });
}));

if (isProduction) {
  app.use(express.static(clientDistPath));

  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, "0.0.0.0", async () => {
  try {
    await getDashboard(false);
  } catch (error) {
    console.error("Initial dashboard generation failed.", error);
  }

  console.log(`MAS is glowing on port ${port}`);
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(error);
    response.status(500).json({
      message: "A little sparkle escaped the room. Please try again."
    });
  }
);
