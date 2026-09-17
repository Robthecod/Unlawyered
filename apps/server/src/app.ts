/**
 * Express app assembly. All AI calls live behind these routes; the browser
 * never talks to a vendor directly.
 */
import express from "express";
import cors from "cors";
import { healthRouter } from "./http/routes/health.js";
import { settingsRouter } from "./http/routes/settings.js";
import { documentsRouter } from "./http/routes/documents.js";
import { askRouter } from "./http/routes/ask.js";
import { explainLawRouter } from "./http/routes/explain-law.js";
import { reviewDocumentRouter } from "./http/routes/review-document.js";
import { crossCheckRouter } from "./http/routes/cross-check.js";
import { stressTestRouter } from "./http/routes/stress-test.js";
import { errorMiddleware } from "./http/util.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/documents", documentsRouter);

  app.use("/api/ask", askRouter);
  app.use("/api/explain-law", explainLawRouter);
  app.use("/api/review-document", reviewDocumentRouter);
  app.use("/api/cross-check", crossCheckRouter);
  app.use("/api/stress-test", stressTestRouter);

  app.use(errorMiddleware);

  return app;
}
