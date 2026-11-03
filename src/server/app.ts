import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import trackingRoutes from './routes/trackingRoutes.js';
import webhookAdminRoutes from './routes/webhookAdminRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import { sessionAuth } from './middleware/sessionAuth.js';

/** App Express com middlewares e rotas da API (sem subir porta nem Vite): usado pelo server.ts e pelos testes. */
export function createApp() {
  const app = express();

  // Atrás do proxy reverso do Coolify (Traefik) fora da Vercel — necessário
  // pra req.ip e req.secure (proto real) ficarem corretos.
  app.set('trust proxy', 1);

  // Configurações básicas
  // A colagem da coleta assistida (JSON de até 20 objetos) passa de 100kb: limite maior SÓ nessa rota,
  // declarado antes do parser global (o primeiro que lê o corpo vence).
  app.use('/api/track/import', express.json({ limit: '2mb' }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(sessionAuth);

  // Registro SÍNCRONO das rotas da API (Crítico para Vercel)
  app.use('/api/auth', authRoutes);
  app.use('/api/track', trackingRoutes);
  app.use('/api/webhooks', webhookAdminRoutes);
  app.use('/api/tracking-subscriptions', subscriptionRoutes);
  app.use('/api/cron', cronRoutes);

  // Health check para debug na Vercel
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      simulation: process.env.SIMULATION_MODE === 'true',
      provider: (process.env.TRACKING_PROVIDER || 'crnn').toLowerCase(),
      node_env: process.env.NODE_ENV,
    });
  });

  return app;
}
