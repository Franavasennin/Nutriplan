import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/progress
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT client_name, entries FROM client_progress ORDER BY client_name'
    );
    const data = rows.map(r => ({
      clientName: r.client_name,
      entries:    r.entries,
    }));
    res.json(data);
  } catch (err) {
    console.error('[GET /progress]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/progress/:clientName/entry — append one entry
router.post('/:clientName/entry', async (req, res) => {
  const { clientName } = req.params;
  const { entry } = req.body;
  if (!entry) return res.status(400).json({ error: 'Missing entry' });
  try {
    await pool.query(
      `INSERT INTO client_progress (client_name, entries)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (client_name) DO UPDATE
         SET entries = client_progress.entries || $2::jsonb`,
      [clientName, JSON.stringify([entry])]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /progress/:clientName/entry]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/progress/:clientName — replace all entries for a client
router.put('/:clientName', async (req, res) => {
  const { clientName } = req.params;
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Expected { entries: [] }' });
  try {
    await pool.query(
      `INSERT INTO client_progress (client_name, entries)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (client_name) DO UPDATE SET entries = EXCLUDED.entries`,
      [clientName, JSON.stringify(entries)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /progress/:clientName]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/progress/bulk — import all progress records
router.post('/bulk', async (req, res) => {
  const { progress } = req.body;
  if (!Array.isArray(progress)) return res.status(400).json({ error: 'Expected { progress: [] }' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const p of progress) {
      await client.query(
        `INSERT INTO client_progress (client_name, entries)
         VALUES ($1, $2::jsonb)
         ON CONFLICT (client_name) DO NOTHING`,
        [p.clientName, JSON.stringify(p.entries ?? [])]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, imported: progress.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /progress/bulk]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
