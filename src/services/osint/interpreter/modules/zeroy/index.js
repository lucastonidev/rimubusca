/**
 * ==============================================================================
 * BACKEND INTERPRETER - ZEROY MODULES INDEX (INDEX.JS)
 * Standardizes raw responses from Zeroy API endpoints before caching or rendering.
 * ==============================================================================
 */

function cleanPhotoBase64(val) {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return trimmed.replace(/^base64,/i, "").replace(/\s+/g, "");
}

function parseBrDateIso(val) {
  const s = String(val || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

function normalizeCpf2Payload(raw) {
  const inner = raw?.data && typeof raw.data === "object" ? raw.data : raw;
  if (!inner || typeof inner !== "object" || inner.dadosBasicos) return raw;
  if (!inner.cpf && !inner.nome && !inner.data_nascimento && !inner.telefones && !inner.enderecos) {
    return raw;
  }

  const cpfDigits = String(inner.cpf || "").replace(/\D/g, "");
  const telefones = Array.isArray(inner.telefones)
    ? inner.telefones.map((t) =>
        typeof t === "object" && t !== null
          ? {
              ddd: t.ddd || String(t.numero || t.telefone || "").replace(/\D/g, "").slice(0, 2),
              telefone: t.telefone || t.numero || "",
              tipo: t.tipo || "TELEFONE",
              operadora: t.operadora || null,
              whatsapp: t.whatsapp || null,
            }
          : {
              ddd: String(t).replace(/\D/g, "").slice(0, 2),
              telefone: String(t).replace(/\D/g, "").slice(2),
              tipo: "TELEFONE",
            }
      )
    : [];

  const enderecos = Array.isArray(inner.enderecos)
    ? inner.enderecos.map((e) => ({
        tipo_logradouro: e.tipo_logradouro || "",
        logradouro: [e.tipo_logradouro, e.logradouro].filter(Boolean).join(" ").trim(),
        numero: e.logradouro_numero || e.numero || "S/N",
        complemento: e.complemento || "",
        bairro: e.bairro || "",
        cidade: e.cidade || "",
        siglaUf: e.uf || e.siglaUf || "",
        cep: String(e.cep || "").replace(/\D/g, ""),
      }))
    : [];

  const emails = Array.isArray(inner.emails)
    ? inner.emails.map((e) => (typeof e === "object" && e !== null ? e : { email: String(e) }))
    : [];

  return {
    ...(raw.info_token ? { info_token: raw.info_token } : {}),
    data: {
      cpf: cpfDigits || inner.cpf || "",
      dadosBasicos: {
        cpf: inner.cpf || cpfDigits || "",
        cleanCpf: cpfDigits,
        nome: inner.nome || "Nome não informado",
        dataNasc: parseBrDateIso(inner.data_nascimento || inner.nascimento),
        sexo: inner.sexo || "",
        estCivil: inner.estado_civil || inner.estCivil || "Não Informado",
        rendaAtual: inner.renda ? Number(String(inner.renda).replace(/[^\d.,]/g, "").replace(",", ".")) || null : null,
        cbo: inner.cbo || null,
        filiacao: {
          nomeMae: inner.nome_mae || inner.mae || "",
          nomePai: inner.nome_pai || inner.pai || "",
        },
        situacaoCadastral: {
          descricaoSit: inner.situacao_receita || inner.situacao || "REGULAR",
        },
      },
      telefonesHistorico: telefones,
      enderecos,
      emails,
    },
  };
}

function normalizeReconncPayload(raw) {
  const inner = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;
  const list = Array.isArray(inner?.matches)
    ? inner.matches
    : Array.isArray(inner?.resultados)
      ? inner.resultados
      : Array.isArray(inner)
        ? inner
        : [];

  const matches = list
    .filter((m) => m && typeof m === "object")
    .map((m, idx) => {
      const detalhes = m.detalhes && typeof m.detalhes === "object" ? m.detalhes : {};
      const cpfClean = String(m.cpf || detalhes.cpf || "").replace(/\D/g, "");
      const simRaw = m.similaridade ?? m.similarity ?? m.score ?? "";
      const simNum = typeof simRaw === "number" ? (simRaw <= 1 ? simRaw * 100 : simRaw) : Number(String(simRaw).replace(/[^0-9.,]/g, "").replace(",", "."));
      const similaridade = Number.isFinite(simNum) && simNum > 0
        ? `${simNum.toFixed(1)}%`
        : (typeof simRaw === "string" && simRaw.trim() ? simRaw.trim() : "N/I");

      return {
        ordem: idx + 1,
        estado: m.estado || m.uf || detalhes.estado || "N/I",
        cpf: cpfClean || m.cpf || "Não informado",
        similaridade,
        similaridadeScore: Number.isFinite(simNum) ? Number(simNum.toFixed(2)) : null,
        foto: cleanPhotoBase64(m.foto || m.base64 || m.imagem),
        nome: m.nome || detalhes.nome || null,
        detalhes: {
          nascimento: detalhes.nascimento || detalhes.data_nascimento || m.nascimento || null,
          mae: detalhes.mae || detalhes.nome_mae || m.mae || null,
          sexo: detalhes.sexo || m.sexo || null,
          telefones: Array.isArray(detalhes.telefones) ? detalhes.telefones.filter(Boolean) : [],
        },
      };
    });

  return {
    tipo: "reconnc",
    total: Number(inner?.total ?? matches.length) || matches.length,
    matches,
  };
}

export function interpretZeroy(moduleId, rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;

  const idLower = String(moduleId || "").toLowerCase();

  if (idLower === "reconnc" || Array.isArray(rawData.matches) || Array.isArray(rawData.data?.matches)) {
    return normalizeReconncPayload(rawData);
  }

  let data = { ...rawData };

  // Normaliza resposta de /api/v1/cpf2 ou fallback de cpf-zeroy
  if (idLower === "cpf-2" || idLower === "cpf-zeroy" || idLower.includes("cpf")) {
    data = normalizeCpf2Payload(data);
  }

  // Basic normalization for vehicles
  if (idLower.includes("placa") || idLower.includes("chassi") || idLower.includes("veiculo")) {
    if (data.dados_veiculo) {
      data.dados_veiculo.placa = String(data.dados_veiculo.placa || "").toUpperCase();
    }
  }

  // Basic normalization for CPF / individuals
  if (idLower.includes("cpf") || idLower.includes("nome")) {
    if (data.dadosBasicos && data.dadosBasicos.cpf) {
      data.dadosBasicos.cleanCpf = String(data.dadosBasicos.cpf).replace(/\D/g, "");
    } else if (data.data?.dadosBasicos?.cpf) {
      data.data.dadosBasicos.cleanCpf = String(data.data.dadosBasicos.cpf).replace(/\D/g, "");
    }
  }

  return data;
}

export default interpretZeroy;

