import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { initDb } from './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import shipmentRoutes from './routes/shipments.js';
import inventoryRoutes from './routes/inventory.js';
import orderRoutes from './routes/orders.js';
import costRoutes from './routes/costs.js';
import profitRoutes from './routes/profit.js';
import expenseRoutes from './routes/expenses.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from the custom domain, Vercel previews, and no-origin (curl, etc.)
    if (!origin
      || origin === 'https://primetradeexchange.net'
      || origin === 'https://primetradingexchange.net'
      || origin === 'https://www.primetradingexchange.net'
      || origin.endsWith('.vercel.app')
      || origin === 'http://localhost:5173') {
      callback(null, origin || '*');
    } else {
      callback(null, false);
    }
  },
}));
app.use(morgan('short'));
app.use(express.json());

// API key check (skip for health)
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (env.API_KEY && req.headers['x-api-key'] !== env.API_KEY) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  next();
});

// Public routes (no login required)
app.use('/api', healthRoutes);
app.use('/api', authRoutes);

// Protected routes — require a valid login token
app.use('/api', requireAuth, shipmentRoutes);
app.use('/api', requireAuth, inventoryRoutes);
app.use('/api', requireAuth, orderRoutes);
app.use('/api', requireAuth, costRoutes);
app.use('/api', requireAuth, profitRoutes);
app.use('/api', requireAuth, expenseRoutes);

// Error handler
app.use(errorHandler);

// Ensure the cost table exists, then start listening (DB failure is non-fatal).
initDb()
  .catch((err) => console.error('Database init error:', err.message))
  .finally(() => {
    app.listen(env.PORT, () => {
      console.log(`Prime Trade Exchange API running on port ${env.PORT}`);
    });
  });
