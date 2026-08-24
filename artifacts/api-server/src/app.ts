import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import router from "./routes/index.js";

const app: Express = express();
app.set("trust proxy", 1);

const allowedOrigins = process.env["ALLOWED_ORIGINS"]
  ? process.env["ALLOWED_ORIGINS"].split(",").map(o => o.trim())
  : undefined;

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, cb) => {
          if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
            cb(null, true);
          } else {
            cb(new Error("Not allowed by CORS"));
          }
        }
      : true,
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// Assessment surveys carry several base64-encoded JPEG photos (each up to
// ~500 KB after client-side downscaling to 1200px @ 0.75 quality), so the
// JSON body easily exceeds the old 50 KB limit and was returning
// PayloadTooLargeError → silent retry forever in the offline queue.
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);
app.use("/api/stalkers/login", loginLimiter);

app.use("/api", router);

export default app;
