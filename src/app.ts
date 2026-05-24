import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes";
import mapRoutes from "./routes/mapRoutes";
import tripRoutes from "./routes/tripRoutes";
import driverRoutes from "./routes/driverRoutes";
import { notFound, errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});
app.use("/api", limiter);

app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.use("/api/auth", authRoutes);
app.use("/api/map", mapRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/driver", driverRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
