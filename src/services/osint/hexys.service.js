/**
 * ==============================================================================
 * RIMUBUSCA - COMPATIBILITY LAYER: HEXYS -> RIMUAPI
 * src/services/osint/hexys.service.js
 *
 * Módulo de compatibilidade transparente: redireciona todas as chamadas
 * legadas da Hexys API para o novo motor oficial RimuAPI (Sant Buscas Engine).
 * ==============================================================================
 */

import { rimuApi, consultarRimuApi, getRimuApiConfig } from "./rimuapi.service.js";

export function getHexysConfig() {
  return getRimuApiConfig();
}

/**
 * Redireciona chamadas legadas de consultarHexys para a RimuAPI
 */
export async function consultarHexys(rota, parametros = {}) {
  const cleanRota = String(rota || "").toLowerCase().trim();

  // Mapeamento de rotas legadas para os módulos oficiais da RimuAPI
  let tipo = "cpf";
  let chave = "";
  let param2 = null;

  if (cleanRota.includes("cpf")) {
    tipo = "cpf";
    chave = parametros.cpf || parametros.chave || "";
  } else if (cleanRota.includes("foto")) {
    tipo = "fotos";
    chave = parametros.cpf || parametros.chave || "";
  } else if (cleanRota.includes("telefone") || cleanRota.includes("celular")) {
    tipo = "telefone";
    chave = parametros.telefone || parametros.chave || "";
  } else if (cleanRota.includes("operadora")) {
    tipo = "telefone";
    chave = parametros.telefone || parametros.chave || "";
  } else if (cleanRota.includes("nome")) {
    tipo = "nome";
    chave = parametros.nome || parametros.chave || "";
    param2 = parametros.uf || null;
  } else if (cleanRota.includes("cep")) {
    tipo = "cep";
    chave = parametros.cep || parametros.chave || "";
  } else if (cleanRota.includes("placa")) {
    tipo = "placa";
    chave = parametros.placa || parametros.chave || "";
  } else if (cleanRota.includes("email")) {
    tipo = "email";
    chave = parametros.email || parametros.chave || "";
  } else if (cleanRota.includes("titulo")) {
    tipo = "titulo";
    chave = parametros.titulo || parametros.chave || "";
  } else if (cleanRota.includes("vizinhos")) {
    tipo = "cep";
    chave = parametros.cpf || parametros.chave || "";
  } else {
    tipo = cleanRota;
    chave = Object.values(parametros)[0] || "";
  }

  const response = await consultarRimuApi({ tipo, chave, param2 });
  return response;
}

export const hexysApi = {
  isConfigured: () => rimuApi.isConfigured(),
  cpf: (cpf) => rimuApi.cpf(cpf),
  telefone: (telefone) => rimuApi.telefone(telefone),
  nome: (nome) => rimuApi.nome(nome),
  cep: (cep) => rimuApi.cep(cep),
  operadora: (telefone) => rimuApi.telefone(telefone),
  foto: (cpf) => rimuApi.fotos(cpf),
  placa: (placa) => rimuApi.placa(placa),
  email: (email) => rimuApi.email(email),
  vizinhos: (cpf) => rimuApi.parentes(cpf),
  titulo: (titulo) => rimuApi.titulo(titulo),
};

export default hexysApi;
