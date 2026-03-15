import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import healthRouter from './routes/health.js';
import asteroidsRouter from './routes/asteroids.js';
import analystRouter from './routes/analyst.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────────────────────────────────────
const CORS_ALLOWLIST = [
  'http://localhost:4200', // Angular dev server
];
if (process.env['FRONTEND_URL']) {
  CORS_ALLOWLIST.push(process.env['FRONTEND_URL']);
}
app.use(cors({ origin: CORS_ALLOWLIST, credentials: false }));

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', healthRouter);
app.use('/api/asteroids', asteroidsRouter);
app.use('/api/analyst', analystRouter);

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

export default app;
