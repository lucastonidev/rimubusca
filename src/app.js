import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

// Rotas
import AuthRouter from "./routes/auth.js";
import WebSiteRouter from "./routes/website.js";
import AdminRouter from "./routes/admin.js";
import ApiRouter from "./routes/api.js";

// Middlewares
import { globalRateLimiter } from "./middlewares/rateLimiter.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();

// 1. Confiança em proxies reversos (imprescindível para Vercel e rate-limiting por IP)
app.set("trust proxy", 1);

// 2. View Engine: EJS
app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "views"));

// 4. Segurança de Cabeçalhos HTTP com Helmet (CSP Rigoroso e Flexível para CDN/OSINT)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://unpkg.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        // Permite inline event handlers (onclick, onsubmit, etc.) nas views EJS
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://unpkg.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https:",
          "https://*.tile.openstreetmap.org",
        ],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "https://unpkg.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "data:",
          "blob:",
        ],
        workerSrc: ["'self'", "blob:", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
        frameSrc: ["'self'", "https://www.openstreetmap.org"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// 3. Arquivos Estáticos públicos (após Helmet para receber headers de segurança)
app.use(express.static(path.join(rootDir, "public")));

// 5. CORS e Parsing
app.use(cors());
app.use(
  cookieParser(process.env.SESSION_SECRET),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// 6. Rate Limiting Global
app.use(globalRateLimiter);

// 7. Variáveis Globais de Template
app.use((req, res, next) => {
  res.locals.appName = "RimuBusca";
  res.locals.appVersion = "1.0.0";
  res.locals.currentYear = new Date().getFullYear();
  res.locals.user = null;
  res.locals.profile = null;
  res.locals.isAdmin = false;
  res.locals.currentPath = req.originalUrl ? req.originalUrl.split("?")[0] : req.path;
  next();
});

// 8. Healthcheck da API (público, leve e útil para Uptime/Monitoramento)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    plataforma: "RimuBusca OSINT Core",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 9. Rotas com separação de responsabilidade
app.use("/", AuthRouter);       // Autenticação (Login / Logout)
app.use("/", AdminRouter);      // Painel Administrativo (/admin, /admin/usuarios, etc.)
app.use("/", WebSiteRouter);    // Páginas Web SSR (Dashboard, Módulos, etc.)
app.use("/api", ApiRouter);     // API REST JSON (/api/modules, /api/processos/consultar, etc.)

// 11. Tratamento de Rotas Inexistentes (404) e Erros (500)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
