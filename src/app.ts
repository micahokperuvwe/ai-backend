import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));

// Routes
import authRoutes from './routes/auth.routes';
import aiRoutes from './routes/ai.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', msg: 'Server is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

export const initApp = async () => {
    await connectDB();
    await connectRedis();
    return app;
}

export default app;
