import cors from "cors";
import { config } from "../config/index.js";

const allowedOrigins = config.CLIENT_ORIGINS;

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // no Origin = curl / server-to-server
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key",
    "X-Requested-With",
  ],
  exposedHeaders: ["Retry-After", "RateLimit-Limit", "RateLimit-Remaining"],
  optionsSuccessStatus: 204,
});