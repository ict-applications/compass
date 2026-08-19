import dotenv from 'dotenv';
import path from 'path';
// Load .env from the monorepo root (parent of server/)
dotenv.config({ path: path.join(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './routes/auth';
import sopsRouter from './routes/sops';
import compareRouter from './routes/compare';
import settingsRouter from './routes/settings';
import adminRouter from './routes/admin';
import { startQueueWorker } from './services/queueWorker';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3080',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRouter);
app.use('/api/sops', sopsRouter);
app.use('/api/compare', compareRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`SOP Compass server running on http://localhost:${PORT}`);
  startQueueWorker();
});

export default app;
