import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/requireAuth";
import preferencesRouter from "./routes/preferences";
import categoriesRouter from "./routes/categories";
import receiptsRouter from "./routes/receipts";
import analyticsRouter from "./routes/analytics";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.use("/api/preferences", requireAuth, preferencesRouter);
app.use("/api/categories", requireAuth, categoriesRouter);
app.use("/api/receipts", requireAuth, receiptsRouter);
app.use("/api/analytics", requireAuth, analyticsRouter);

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
