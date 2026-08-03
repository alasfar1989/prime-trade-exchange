import { Router } from 'express';
import {
  listExpenses, listCategories, createExpense, updateExpense, deleteExpense,
  type ExpenseInput,
} from '../services/expenses.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const round = (n: number) => Math.round(n * 100) / 100;

// Default window when none is given: the current month.
function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
}

// Validate and normalise a create/update body. Returns the parsed input or an
// error string. Amount may be negative — that's how a refund/credit is logged.
function parseBody(body: unknown): { input: ExpenseInput } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const expenseDate = String(b.expenseDate ?? '').slice(0, 10);
  const category = String(b.category ?? '').trim();
  const description = String(b.description ?? '').trim();
  const amount = Number(b.amount);

  if (!DATE_RE.test(expenseDate)) return { error: 'expenseDate must be YYYY-MM-DD.' };
  if (!category) return { error: 'category is required.' };
  if (!description) return { error: 'description is required.' };
  if (!Number.isFinite(amount)) return { error: 'amount must be a number.' };

  const vendorRaw = String(b.vendor ?? '').trim();
  const notesRaw = String(b.notes ?? '').trim();
  return {
    input: {
      expenseDate,
      category,
      description,
      amount: round(amount),
      vendor: vendorRaw || null,
      notes: notesRaw || null,
    },
  };
}

// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
// -> { rows, totals: { amount, count }, byCategory: [...], categories: [...], range }
router.get('/expenses', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const def = defaultRange();
    const from = q.from && DATE_RE.test(q.from) ? q.from : def.from;
    const to = q.to && DATE_RE.test(q.to) ? q.to : def.to;

    const [rows, categories] = await Promise.all([
      listExpenses(from, to),
      listCategories(),
    ]);

    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

    // Category rollup for the breakdown bars, largest first.
    const byCat = new Map<string, { amount: number; count: number }>();
    for (const r of rows) {
      const cur = byCat.get(r.category) ?? { amount: 0, count: 0 };
      cur.amount += r.amount;
      cur.count += 1;
      byCat.set(r.category, cur);
    }
    const byCategory = [...byCat.entries()]
      .map(([category, v]) => ({
        category,
        amount: round(v.amount),
        count: v.count,
        // Share of the total. Meaningless when the total is zero (e.g. an
        // expense fully offset by a refund), so send null rather than NaN.
        pct: totalAmount ? round((v.amount / totalAmount) * 100) : null,
      }))
      .sort((a, b) => b.amount - a.amount);

    res.json({
      data: {
        rows,
        totals: { amount: round(totalAmount), count: rows.length },
        byCategory,
        categories,
        range: { from, to },
      },
      meta: { source: 'db', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses
router.post('/expenses', async (req, res, next) => {
  try {
    const parsed = parseBody(req.body);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const row = await createExpense(parsed.input);
    res.status(201).json({ data: row, meta: { source: 'db', cachedAt: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/expenses/:id
router.put('/expenses/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'A valid expense id is required.' });
      return;
    }
    const parsed = parseBody(req.body);
    if ('error' in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const row = await updateExpense(id, parsed.input);
    if (!row) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }
    res.json({ data: row, meta: { source: 'db', cachedAt: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete('/expenses/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'A valid expense id is required.' });
      return;
    }
    const ok = await deleteExpense(id);
    if (!ok) {
      res.status(404).json({ error: 'Expense not found.' });
      return;
    }
    res.json({ data: { id }, meta: { source: 'db', cachedAt: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

export default router;
