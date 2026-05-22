import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import shipmentRoutes from './routes/shipments.js';
import inventoryRoutes from './routes/inventory.js';
import orderRoutes from './routes/orders.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
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

// Routes
app.use('/api', healthRoutes);
app.use('/api', shipmentRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', orderRoutes);

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Prime Trade Exchange API running on port ${env.PORT}`);
});
