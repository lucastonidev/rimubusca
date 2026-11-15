import { getModulesService } from "../../services/core/modules.service.js";

/**
 * Retorna a lista de módulos configurados no sistema
 */
export const getModules = async (req, res, next) => {
  try {
    const modules = await getModulesService();
    return res.status(200).json({
      success: true,
      data: modules,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: error.message || "Erro interno ao carregar módulos",
    });
  }
};
