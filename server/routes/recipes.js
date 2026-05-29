/**
 * server/routes/recipes.js
 * REST endpoints for the recipes table.
 *
 * GET    /api/recipes       — list all recipes
 * POST   /api/recipes       — upsert one recipe
 * POST   /api/recipes/bulk  — upsert many recipes (seed / sync)
 * DELETE /api/recipes/:id   — delete by id
 */

import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// ── Ensure the table exists on first use (idempotent) ────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS recipes (
    id           TEXT    PRIMARY KEY,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    prep_time    INTEGER NOT NULL DEFAULT 0,
    calories     REAL    NOT NULL DEFAULT 0,
    protein      REAL    NOT NULL DEFAULT 0,
    carbs        REAL    NOT NULL DEFAULT 0,
    fats         REAL    NOT NULL DEFAULT 0,
    ingredients  JSONB   NOT NULL DEFAULT '[]',
    instructions JSONB   NOT NULL DEFAULT '[]',
    tags         JSONB   NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING gin(tags);
`).catch(err => console.error('[recipes] table init error:', err.message));

// ── GET /api/recipes ──────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, description,
              prep_time    AS "prepTime",
              calories, protein, carbs, fats,
              ingredients, instructions, tags
       FROM   recipes
       ORDER  BY title`
    );
    res.json(rows);
  } catch (err) {
    console.error('[recipes] GET /', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// ── POST /api/recipes — upsert one ───────────────────────────────────────────
router.post('/', async (req, res) => {
  const r = req.body;
  if (!r?.id || !r?.title) return res.status(400).json({ error: 'id and title required' });
  try {
    await upsertOne(r);
    res.json({ ok: true });
  } catch (err) {
    console.error('[recipes] POST /', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// ── POST /api/recipes/bulk ────────────────────────────────────────────────────
router.post('/bulk', async (req, res) => {
  const { recipes } = req.body ?? {};
  if (!Array.isArray(recipes)) return res.status(400).json({ error: 'recipes array required' });
  try {
    await Promise.all(recipes.map(upsertOne));
    res.json({ ok: true, count: recipes.length });
  } catch (err) {
    console.error('[recipes] POST /bulk', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// ── DELETE /api/recipes/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[recipes] DELETE /:id', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});

// ── Upsert helper ─────────────────────────────────────────────────────────────
async function upsertOne(r) {
  await pool.query(
    `INSERT INTO recipes
       (id, title, description, prep_time, calories, protein, carbs, fats,
        ingredients, instructions, tags)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       title        = EXCLUDED.title,
       description  = EXCLUDED.description,
       prep_time    = EXCLUDED.prep_time,
       calories     = EXCLUDED.calories,
       protein      = EXCLUDED.protein,
       carbs        = EXCLUDED.carbs,
       fats         = EXCLUDED.fats,
       ingredients  = EXCLUDED.ingredients,
       instructions = EXCLUDED.instructions,
       tags         = EXCLUDED.tags`,
    [
      r.id,
      r.title,
      r.description  ?? '',
      r.prepTime     ?? 0,
      r.calories     ?? 0,
      r.protein      ?? 0,
      r.carbs        ?? 0,
      r.fats         ?? 0,
      JSON.stringify(r.ingredients  ?? []),
      JSON.stringify(r.instructions ?? []),
      JSON.stringify(r.tags         ?? []),
    ]
  );
}

export default router;
