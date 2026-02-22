import express from "express";
import trackingRoutes from './src/server/routes/trackingRoutes';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Configurações básicas
app.use(express.json());

// Registro SÍNCRONO das rotas da API (Crítico para Vercel)
app.use('/api/track', trackingRoutes);

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
