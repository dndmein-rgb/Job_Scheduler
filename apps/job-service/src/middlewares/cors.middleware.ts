import cors from "cors";
import { config } from "../config/index.js";

const allowedOrigins = config.CLIENT_ORIGINS


export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Requests without an Origin header include curl, Postman,
    // and server-to-server requests.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],

  optionsSuccessStatus: 204,
});