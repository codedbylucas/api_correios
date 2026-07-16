import 'dotenv/config';
import express from "express";
import cookieParser from 'cookie-parser';
import authRoutes from './src/server/routes/authRoutes.js';
import trackingRoutes from './src/server/routes/trackingRoutes.js';
import webhookAdminRoutes from './src/server/routes/webhookAdminRoutes.js';
import subscriptionRoutes from './src/server/routes/subscriptionRoutes.js';
import cronRoutes from './src/server/routes/cronRoutes.js';
import { sessionAuth } from './src/server/middleware/sessionAuth.js';

const app = express();

// Configurações básicas
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
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    simulation: process.env.SIMULATION_MODE === 'true',
    node_env: process.env.NODE_ENV
  });
});

// Lógica de Inicialização
if (process.env.NODE_ENV !== "production") {
  // Em desenvolvimento, carregamos o Vite dinamicamente
  import("vite").then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Dev server running on http://localhost:${PORT}`);
    });
  });
} else {
  // Em produção (Vercel), servimos os arquivos estáticos da pasta dist
  app.use(express.static("dist"));
}

// Exportamos o app para a Vercel
export default app;

