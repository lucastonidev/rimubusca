import { AppError } from "./AppError.js";
export { AppError };

export const parseSupabaseError = (error) => {
  switch (error.code) {
    case "23505": // Unique violation (ex: tentando cadastrar email repetido)
      return new AppError("Este registro já existe no sistema.", 409);

    case "PGRST116": // Nenhuma linha retornada quando se esperava um elemento único (.single())
      return new AppError("Nenhum dado encontrado.", 404);

    case "23503": // Foreign key violation (tentando apagar algo que está vinculado a outra tabela)
      return new AppError(
        "Não é possível remover este item pois ele está em uso.",
        400,
      );

    default:
      // Se for um erro desconhecido, loga no console para você debugar depois
      console.error("[Supabase Raw Error]:", error);
      return new AppError("Ocorreu um erro inesperado no banco de dados.", 500);
  }
};
