import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/foods
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, brand, calories, protein, carbs, fats, portion_size FROM custom_foods ORDER BY name'
    );
    const foods = rows.map(r => ({
      id:          r.id,
      name:        r.name,
      brand:       r.brand ?? '',
      calories:    Number(r.calories),
      protein:     Number(r.protein),
      carbs:       Number(r.carbs),
      fats:        Number(r.fats),
      portionSize: Number(r.portion_size),
    }));
    res.json(foods);
  } catch (err) {
    console.error('[GET /foods]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/foods — upsert
router.post('/', async (req, res) => {
  const { id, name, brand, calories, protein, carbs, fats, portionSize } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'Missing id or name' });
  try {
    await pool.query(
      `INSERT INTO custom_foods (id, name, brand, calories, protein, carbs, fats, portion_size)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name=$2, brand=$3, calories=$4, protein=$5, carbs=$6, fats=$7, portion_size=$8`,
      [id, name, brand ?? '', calories ?? 0, protein ?? 0, carbs ?? 0, fats ?? 0, portionSize ?? 100]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /foods]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/foods/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM custom_foods WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /foods/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/foods/bulk — import many foods at once
router.post('/bulk', async (req, res) => {
  const { foods } = req.body;
  if (!Array.isArray(foods)) return res.status(400).json({ error: 'Expected { foods: [] }' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const f of foods) {
      await client.query(
        `INSERT INTO custom_foods (id, name, brand, calories, protein, carbs, fats, portion_size)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.name, f.brand ?? '', f.calories ?? 0, f.protein ?? 0, f.carbs ?? 0, f.fats ?? 0, f.portionSize ?? 100]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, imported: foods.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /foods/bulk]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
