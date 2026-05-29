import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/diets — all diets ordered by timestamp desc
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, timestamp, patient_data, metrics, plan FROM saved_diets ORDER BY timestamp DESC'
    );
    const diets = rows.map(r => ({
      id:          r.id,
      timestamp:   Number(r.timestamp),
      patientData: r.patient_data,
      metrics:     r.metrics,
      plan:        r.plan,
    }));
    res.json(diets);
  } catch (err) {
    console.error('[GET /diets]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/diets — create or replace a diet
router.post('/', async (req, res) => {
  const { id, timestamp, patientData, metrics, plan } = req.body;
  if (!id || !patientData || !metrics || !plan) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await pool.query(
      `INSERT INTO saved_diets (id, timestamp, patient_data, metrics, plan)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         timestamp    = EXCLUDED.timestamp,
         patient_data = EXCLUDED.patient_data,
         metrics      = EXCLUDED.metrics,
         plan         = EXCLUDED.plan`,
      [id, timestamp ?? Date.now(), patientData, metrics, plan]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /diets]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/diets/:id/plan — update only the plan field
router.patch('/:id/plan', async (req, res) => {
  const { plan } = req.body;
  if (!plan) return res.status(400).json({ error: 'Missing plan' });
  try {
    const result = await pool.query(
      'UPDATE saved_diets SET plan = $1 WHERE id = $2',
      [plan, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Diet not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /diets/:id/plan]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/diets/:id/patient — update patient data
router.patch('/:id/patient', async (req, res) => {
  const { patientData } = req.body;
  if (!patientData) return res.status(400).json({ error: 'Missing patientData' });
  try {
    const result = await pool.query(
      'UPDATE saved_diets SET patient_data = patient_data || $1::jsonb WHERE id = $2',
      [JSON.stringify(patientData), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Diet not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /diets/:id/patient]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/diets/:id/full — update patient data + metrics + plan (regenerate)
router.patch('/:id/full', async (req, res) => {
  const { patientData, metrics, plan } = req.body;
  if (!patientData || !metrics || !plan) return res.status(400).json({ error: 'Missing fields' });
  try {
    const result = await pool.query(
      'UPDATE saved_diets SET patient_data=$1, metrics=$2, plan=$3, timestamp=$4 WHERE id=$5',
      [patientData, metrics, plan, Date.now(), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Diet not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /diets/:id/full]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/diets/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM saved_diets WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /diets/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/diets/bulk — import many diets at once
router.post('/bulk', async (req, res) => {
  const { diets } = req.body;
  if (!Array.isArray(diets)) return res.status(400).json({ error: 'Expected { diets: [] }' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const d of diets) {
      await client.query(
        `INSERT INTO saved_diets (id, timestamp, patient_data, metrics, plan)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [d.id, d.timestamp ?? Date.now(), d.patientData, d.metrics, d.plan]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, imported: diets.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /diets/bulk]', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
