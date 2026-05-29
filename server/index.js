import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';
import dietsRouter    from './routes/diets.js';
import foodsRouter    from './routes/foods.js';
import progressRouter from './routes/progress.js';
import recipesRouter  from './routes/recipes.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'error', message: err.message });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/diets',    dietsRouter);
app.use('/api/foods',    foodsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/recipes',  recipesRouter);

// ─── 404 catch-all ────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[NutriPlan] Server running on http://localhost:${PORT}`);
});
