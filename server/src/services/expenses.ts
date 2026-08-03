import { pool } from '../db.js';

// Operating expenses the user logs by hand (shipping supplies, software, prep
// services, storage overages...). Standalone bookkeeping — these do NOT feed
// /api/profit, which stays revenue - Amazon fees - COGS.

export interface Expense {
  id: number;
  expenseDate: string;   // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  vendor: string | null;
  notes: string | null;
}

export interface ExpenseInput {
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  vendor?: string | null;
  notes?: string | null;
}

interface Row {
  id: string;
  expense_date: Date | string;
  category: string;
  description: string;
  amount: string;
  vendor: string | null;
  notes: string | null;
}

function noDb(): never {
  throw new Error('Expense storage is not configured (no DATABASE_URL).');
}

// node-postgres returns DATE as a local-midnight Date object, and calling
// toISOString() on that shifts the day backwards west of UTC. Format from the
// local parts instead so the date stays the one that was stored.
function toDateString(v: Date | string): string {
  if (typeof v === 'string') return v.slice(0, 10);
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, '0');
  const d = String(v.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapRow(r: Row): Expense {
  return {
    id: Number(r.id),
    expenseDate: toDateString(r.expense_date),
    category: r.category,
    description: r.description,
    amount: parseFloat(r.amount),
    vendor: r.vendor,
    notes: r.notes,
  };
}

// Expenses within [from, to] inclusive (both YYYY-MM-DD), newest first.
export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT id, expense_date, category, description, amount, vendor, notes
       FROM expenses
      WHERE expense_date >= $1 AND expense_date <= $2
      ORDER BY expense_date DESC, id DESC`,
    [from, to]
  );
  return r.rows.map(mapRow);
}

// Every distinct category ever used, for the add/edit autocomplete.
export async function listCategories(): Promise<string[]> {
  if (!pool) return [];
  const r = await pool.query('SELECT DISTINCT category FROM expenses ORDER BY category');
  return r.rows.map((row: { category: string }) => row.category);
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  if (!pool) noDb();
  const r = await pool.query(
    `INSERT INTO expenses (expense_date, category, description, amount, vendor, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, expense_date, category, description, amount, vendor, notes`,
    [input.expenseDate, input.category, input.description, input.amount,
     input.vendor ?? null, input.notes ?? null]
  );
  return mapRow(r.rows[0]);
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<Expense | null> {
  if (!pool) noDb();
  const r = await pool.query(
    `UPDATE expenses
        SET expense_date = $2, category = $3, description = $4, amount = $5,
            vendor = $6, notes = $7, updated_at = NOW()
      WHERE id = $1
      RETURNING id, expense_date, category, description, amount, vendor, notes`,
    [id, input.expenseDate, input.category, input.description, input.amount,
     input.vendor ?? null, input.notes ?? null]
  );
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

export async function deleteExpense(id: number): Promise<boolean> {
  if (!pool) noDb();
  const r = await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}
