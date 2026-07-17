import 'dotenv/config';
import path from 'node:path';
import express from "express";
import cookieParser from 'cookie-parser';
import authRoutes from './src/server/routes/authRoutes.js';
import trackingRoutes from './src/server/routes/trackingRoutes.js';
import webhookAdminRoutes from './src/server/routes/webhookAdminRoutes.js';
import subscriptionRoutes from './src/server/routes/subscriptionRoutes.js';
import cronRoutes from './src/server/routes/cronRoutes.js';
import { sessionAuth } from './src/server/middleware/sessionAuth.js';

const app = express();

// Atrás do proxy reverso do Coolify (Traefik) fora da Vercel — necessário
// pra req.ip e req.secure (proto real) ficarem corretos.
app.set('trust proxy', 1);

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
  // Em produção, servimos os arquivos estáticos da pasta dist
  app.use(express.static("dist"));

  // Fallback de SPA: qualquer rota que não seja /api/* devolve o index.html
  // pra o React Router assumir client-side. Na Vercel isso é feito pelo
  // `routes` do vercel.json; fora dela (Docker/VPS) precisa ser aqui.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
  });

  // Na Vercel o handler exportado é invocado diretamente (sem .listen()).
  // Rodando standalone (Docker/VPS), precisa subir o servidor de verdade.
  if (!process.env.VERCEL) {
    const PORT = parseInt(process.env.PORT || '3000', 10);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

// Exportamos o app para a Vercel (e para os testes de integração, se houver)
export default app;

