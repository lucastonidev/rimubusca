import { Router } from "express";
import { authController } from "../controllers/auth/auth.controller.js";
import { loginRateLimiter } from "../middlewares/rateLimiter.js";

const router = Router();

// Renderização do formulário de Login
router.get("/login", authController.renderLogin);

// Submissão do formulário de Login
router.post("/login", loginRateLimiter, authController.handleLogin);
router.post("/auth/login", loginRateLimiter, authController.handleLogin);

// Encerramento de Sessão (Logout)
router.get("/logout", authController.handleLogout);
router.post("/logout", authController.handleLogout);
router.get("/auth/logout", authController.handleLogout);
router.post("/auth/logout", authController.handleLogout);

export default router;

