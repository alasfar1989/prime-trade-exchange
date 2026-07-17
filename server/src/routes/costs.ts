import { Router } from 'express';
import { getAllCosts, setCost } from '../services/costs.js';

const router = Router();

// GET /api/costs -> { [sku]: cost }
router.get('/costs', async (_req, res, next) => {
  try {
    const costs = await getAllCosts();
    res.json({
      data: Object.fromEntries(costs),
      meta: { source: 'db', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/costs/:sku  body: { cost: number }
router.put('/costs/:sku', async (req, res, next) => {
  try {
    const sku = req.params.sku;
    const cost = Number(req.body?.cost);
    if (!sku || Number.isNaN(cost) || cost < 0) {
      res.status(400).json({ error: 'A valid sku and a non-negative cost are required.' });
      return;
    }
    await setCost(sku, cost);
    res.json({
      data: { sku, cost },
      meta: { source: 'db', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
