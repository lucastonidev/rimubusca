/**
 * ==============================================================================
 * RIMUBUSCA - HEXYS DEV INTERPRETER - EMPLOYMENT & WORK HISTORY (EMPLOYMENT.JS)
 * Renderizador dedicado para:
 *  - `funcionarios`: Quadro de funcionários e vínculos cadastrais por CNPJ
 *  - `empregos`: Histórico trabalhista (CTPS / RAIS / CAGED) por CPF
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

function cleanEmploymentValue(val) {
  if (val === null || val === undefined) return "";
  const txt = String(val).trim();
  const up = txt.replace(/[()]/g, "").trim().toUpperCase();
  if (
    !up ||
    up === "SEM RESULTADO" ||
    up === "N/I" ||
    up === "N/A" ||
    up === "NULL" ||
    up === "NONE" ||
    up === "UNDEFINED" ||
    up === "NÃO INFORMADO" ||
    up === "NAO INFORMADO" ||
    up === "NÃO INFORMADA" ||
    up === "NAO INFORMADA" ||
    up === "NÃO ESPECIFICADO" ||
    up === "-"
  ) {
    return "";
  }
  return txt;
}

function normalizeEmploymentDate(val) {
  const txt = cleanEmploymentValue(val);
  if (!txt) return { display: "", canonical: "" };

  const isoMatch = txt.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const [, yyyy, mm, dd, hh, min] = isoMatch;
    const brDate = `${dd}/${mm}/${yyyy}`;
    const hasTime = Boolean(hh && min && !(hh === "00" && min === "00"));
    return {
      display: hasTime ? `${brDate} ${hh}:${min}` : brDate,
      canonical: hasTime ? `${yyyy}-${mm}-${dd} ${hh}:${min}` : `${yyyy}-${mm}-${dd}`,
    };
  }

  const brMatch = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (brMatch) {
    const [, dd, mm, yyyy, hh, min] = brMatch;
    const brDate = `${dd}/${mm}/${yyyy}`;
    const hasTime = Boolean(hh && min && !(hh === "00" && min === "00"));
    return {
      display: hasTime ? `${brDate} ${hh}:${min}` : brDate,
      canonical: hasTime ? `${yyyy}-${mm}-${dd} ${hh}:${min}` : `${yyyy}-${mm}-${dd}`,
    };
  }

  return { display: txt, canonical: txt.toUpperCase() };
}

function normalizeRecordsList(responseData, dataPayload, queryType) {
  const rawPayload = dataPayload || responseData?.dados || responseData || {};
  const candidates = Array.isArray(rawPayload)
    ? rawPayload
    : Array.isArray(rawPayload?.[queryType])
      ? rawPayload[queryType]
      : Array.isArray(rawPayload?.funcionarios)
        ? rawPayload.funcionarios
        : Array.isArray(rawPayload?.empregos)
          ? rawPayload.empregos
          : Array.isArray(rawPayload?.resultado)
            ? rawPayload.resultado
            : Array.isArray(rawPayload?.response)
              ? rawPayload.response
              : [];

  const seen = new Map();
  const list = [];

  for (const raw of candidates) {
    if (!raw || typeof raw !== "object" || raw.__notFound) continue;

    const cpfRaw = String(raw.cpf_raw || raw.cpf || raw.CPF || "").replace(/\D/g, "");
    const cnpjRaw = String(raw.cnpj_raw || raw.cnpj || raw.CNPJ || "").replace(/\D/g, "");
    const nome = cleanEmploymentValue(raw.nome || raw.NOME || raw.name).toUpperCase();
    const razaoSocial = cleanEmploymentValue(raw.razaoSocial || raw.RAZAO_SOCIAL || raw.razao_social || raw.empresa).toUpperCase();
    const situacao = cleanEmploymentValue(raw.situacao || raw.SITUACAO).toUpperCase();

    if (!cpfRaw && !cnpjRaw && !nome && !razaoSocial) continue;

    const adm = normalizeEmploymentDate(raw.dataAdmissao || raw.DATA_ADMISSAO || raw.data_admissao);
    const desl = normalizeEmploymentDate(
      raw.dataDesligamento || raw.DATA_DESLIGAMENTO || raw.data_desligamento || raw.dataDemissao || raw.DATA_DEMISSAO
    );
    const ent = normalizeEmploymentDate(raw.dataEntrega || raw.DATA_ENTREGA || raw.data_entrega);
    const cad = normalizeEmploymentDate(raw.dataCadastro || raw.DATA_CADASTRO || raw.data_cadastro);
    const faixaRenda = cleanEmploymentValue(raw.faixaRenda || raw.FAIXA_RENDA || raw.faixa_renda);
    const cargo = cleanEmploymentValue(raw.cargo || raw.CARGO || raw.cbo || raw.CBO);
    const remuneracao = cleanEmploymentValue(raw.remuneracao || raw.REMUNERACAO);

    const record = {
      cpf: cpfRaw.length === 11 ? Formatters.cpf(cpfRaw) : cleanEmploymentValue(raw.cpf || raw.CPF) || "",
      cpfRaw,
      nome,
      cnpj: cnpjRaw.length === 14 ? Formatters.cnpj(cnpjRaw) : cleanEmploymentValue(raw.cnpj || raw.CNPJ) || "",
      cnpjRaw,
      razaoSocial,
      situacao: situacao || "REGISTRADO",
      dataAdmissao: adm.display,
      dataDesligamento: desl.display,
      dataEntrega: ent.display,
      dataCadastro: cad.display,
      faixaRenda,
      cargo,
      remuneracao,
    };

    const dedupKey = [
      cpfRaw || nome,
      cnpjRaw || razaoSocial,
      adm.canonical,
      desl.canonical,
      ent.canonical,
      record.situacao,
    ].join("|");

    if (seen.has(dedupKey)) {
      const existing = seen.get(dedupKey);
      for (const [k, v] of Object.entries(record)) {
        if (v && !existing[k]) existing[k] = v;
      }
      continue;
    }

    seen.set(dedupKey, record);
    list.push(record);
  }

  return {
    records: list,
    rawCount: Number(rawPayload?.totalBruto || candidates.length || list.length),
  };
}

function getSituacaoTone(situacao, hasDesligamento) {
  if (hasDesligamento) return "osint-emp-status-pill--inactive";
  const up = String(situacao || "").toUpperCase();
  if (up.includes("ENTREGUE") || up.includes("ATIV") || up.includes("REGULAR")) {
    return "osint-emp-status-pill--active";
  }
  return "osint-emp-status-pill--neutral";
}

function renderEmptyEmploymentState(queryType, termo) {
  const isFuncionarios = queryType === "funcionarios";
  const cleanDigits = String(termo || "").replace(/\D/g, "");
  const formattedTarget = isFuncionarios
    ? (cleanDigits.length === 14 ? Formatters.cnpj(cleanDigits) : String(termo || "informado"))
    : (cleanDigits.length === 11 ? Formatters.cpf(cleanDigits) : String(termo || "informado"));

  return `
    <div class="card osint-empty-card osint-empty-card--amber">
      <div class="osint-empty-icon osint-empty-icon--amber">
        <i data-lucide="${isFuncionarios ? "users" : "briefcase"}" class="icon-xl"></i>
      </div>
      <h3 class="osint-empty-title">
        ${isFuncionarios ? "Nenhum Funcionário Localizado" : "Nenhum Vínculo Trabalhista Localizado"}
      </h3>
      <p class="osint-empty-desc">
        ${
          isFuncionarios
            ? `Não foram encontrados registros de funcionários ou declarações trabalhistas para o CNPJ <strong>${escapeHtml(formattedTarget)}</strong>.`
            : `Não foram encontrados registros formais de emprego (CTPS / RAIS / CAGED) para o CPF <strong>${escapeHtml(formattedTarget)}</strong>.`
        }
      </p>
    </div>
  `;
}

export const EmploymentInterpreter = {
  render(responseData, dataPayload) {
    const rawPayload = dataPayload || responseData?.dados || responseData || {};
    const queryTypeRaw = String(responseData?.tipo || rawPayload?.tipo || "").toLowerCase().trim();
    const isFuncionarios = queryTypeRaw === "funcionarios" || Boolean(Array.isArray(rawPayload?.funcionarios) && !rawPayload?.empregos);
    const queryType = isFuncionarios ? "funcionarios" : "empregos";

    const isNotFound = Boolean(
      responseData?.notFound ||
      responseData?.isNotFound ||
      rawPayload?.notFound ||
      rawPayload?.isNotFound
    );

    const { records, rawCount } = normalizeRecordsList(responseData, rawPayload, queryType);
    if (isNotFound || records.length === 0) {
      return renderEmptyEmploymentState(queryType, responseData?.termo || rawPayload?.cnpj || rawPayload?.cpf);
    }

    if (isFuncionarios) {
      return this.renderFuncionarios(responseData, rawPayload, records, rawCount);
    }
    return this.renderEmpregos(responseData, rawPayload, records, rawCount);
  },

  renderFuncionarios(responseData, rawPayload, records, rawCount) {
    const cnpjRaw =
      String(
        rawPayload?.cnpj_raw ||
        rawPayload?.empresa?.cnpj_raw ||
        records.find((r) => r.cnpjRaw)?.cnpjRaw ||
        responseData?.termo ||
        ""
      ).replace(/\D/g, "");
    const formattedCnpj = cnpjRaw.length === 14 ? Formatters.cnpj(cnpjRaw) : (rawPayload?.cnpj || "CNPJ não informado");
    const companyName =
      cleanEmploymentValue(
        rawPayload?.razaoSocial ||
        rawPayload?.empresa?.razaoSocial ||
        records.find((r) => r.razaoSocial)?.razaoSocial
      ) || `EMPRESA CNPJ ${formattedCnpj}`;

    const ativosCount = records.filter((r) => !r.dataDesligamento).length;
    const desligadosCount = records.length - ativosCount;
    const showRendaCol = records.some((r) => Boolean(r.faixaRenda || r.cargo || r.remuneracao));
    const uniqueCpfs = [...new Set(records.map((r) => r.cpf).filter(Boolean))].join("\n");

    return `
      <div class="card osint-section-card osint-section-card--purple osint-emp-hero" data-employment-root="funcionarios">
        <div class="osint-emp-header-row">
          <div class="osint-emp-identity">
            <div class="osint-emp-badges">
              <span class="badge badge-purple">QUADRO DE FUNCIONÁRIOS (RAIS / CAGED)</span>
              <span class="badge badge-emerald">${records.length} ${records.length === 1 ? "Funcionário" : "Funcionários"}</span>
              ${
                rawCount > records.length
                  ? `<span class="badge badge-dark">${rawCount} registros consolidados</span>`
                  : ""
              }
            </div>
            <h2 class="osint-emp-title">${escapeHtml(companyName)}</h2>
            <div class="osint-emp-subrow">
              <span class="osint-emp-doc-pill">
                <i data-lucide="building-2" class="icon-xs icon-purple"></i>
                <span class="text-mono">${escapeHtml(formattedCnpj)}</span>
              </span>
              ${
                cnpjRaw.length === 14
                  ? `
                <button type="button" class="btn btn-ghost btn-xs btn-copiar-texto btn-action-copy" data-copy="${escapeHtml(cnpjRaw)}" title="Copiar CNPJ">
                  <i data-lucide="copy" class="icon-xs"></i>
                  <span>Copiar CNPJ</span>
                </button>
                <button type="button" class="btn btn-outline btn-xs btn-puxar-cnpj" data-cnpj="${escapeHtml(cnpjRaw)}" title="Ver Dossiê da Empresa">
                  <i data-lucide="building" class="icon-xs"></i>
                  <span>Ver Dossiê da Empresa</span>
                </button>
              `
                  : ""
              }
            </div>
          </div>

          <div class="osint-emp-actions">
            ${
              uniqueCpfs
                ? `<button type="button" class="btn btn-outline btn-sm btn-copiar-texto" data-copy="${escapeHtml(uniqueCpfs)}" title="Copiar CPFs dos funcionários">
                     <i data-lucide="copy" class="icon-sm"></i>
                     <span>Copiar CPFs</span>
                   </button>`
                : ""
            }
          </div>
        </div>

        <div class="osint-filter-bar mt-4">
          <div class="osint-filter-inputs">
            <input
              type="text"
              id="inputFiltroEmpregos"
              class="input-filter-inline osint-emp-search"
              placeholder="Buscar por nome do funcionário, CPF, admissão ou situação..."
            >
            <div class="osint-chip-row">
              <button type="button" class="btn btn-outline btn-xs btn-filtro-emp active" data-emp-filter="todos">Todos (${records.length})</button>
              <button type="button" class="btn btn-outline btn-xs btn-filtro-emp" data-emp-filter="ativos">Sem desligamento (${ativosCount})</button>
              ${
                desligadosCount > 0
                  ? `<button type="button" class="btn btn-outline btn-xs btn-filtro-emp" data-emp-filter="desligados">Desligados (${desligadosCount})</button>`
                  : ""
              }
            </div>
          </div>
          <span class="osint-filter-counter" id="contadorEmpregosVisiveis">
            Exibindo ${records.length} de ${records.length} vínculos
          </span>
        </div>

        <div class="table-responsive osint-table-scroll osint-emp-table-wrap">
          <table class="osint-table" id="tabelaFuncionariosCnpj">
            <thead>
              <tr>
                <th class="osint-th-index">#</th>
                <th>Funcionário / CPF</th>
                <th>Situação</th>
                <th>Admissão</th>
                <th>Desligamento</th>
                <th>Entrega / Cadastro</th>
                ${showRendaCol ? "<th>Renda / Cargo</th>" : ""}
                <th class="osint-th-action">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${records
                .map((r, idx) => {
                  const hasDesligamento = Boolean(r.dataDesligamento);
                  const toneClass = getSituacaoTone(r.situacao, hasDesligamento);
                  const searchTokens = `${r.nome} ${r.cpf} ${r.cpfRaw} ${r.situacao} ${r.dataAdmissao} ${r.dataDesligamento} ${r.dataEntrega} ${r.faixaRenda}`.toLowerCase();

                  return `
                    <tr
                      class="linha-emprego-item"
                      data-emp-status="${hasDesligamento ? "desligado" : "ativo"}"
                      data-search="${escapeHtml(searchTokens)}"
                    >
                      <td class="osint-td-index">${idx + 1}</td>
                      <td>
                        <div class="osint-td-name">${escapeHtml(r.nome || "Titular não informado")}</div>
                        <div class="osint-td-cpf-wrap mt-1">
                          <span class="osint-td-cpf-val">${escapeHtml(r.cpf || "Não informado")}</span>
                          ${
                            r.cpfRaw
                              ? `<button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-cpf" data-cpf="${escapeHtml(r.cpfRaw)}" title="Copiar CPF">
                                   <i data-lucide="copy" class="icon-xs"></i>
                                 </button>`
                              : ""
                          }
                        </div>
                      </td>
                      <td>
                        <span class="osint-emp-status-pill ${toneClass}">
                          ${escapeHtml(r.situacao)}
                        </span>
                      </td>
                      <td class="osint-td-meta text-mono">${escapeHtml(r.dataAdmissao || "-")}</td>
                      <td class="osint-td-meta">
                        ${
                          hasDesligamento
                            ? `<span class="text-mono">${escapeHtml(r.dataDesligamento)}</span>`
                            : `<span class="osint-emp-active-tag">Sem desligamento</span>`
                        }
                      </td>
                      <td class="osint-td-dim">
                        ${r.dataEntrega ? `<div class="text-mono">Ent: ${escapeHtml(r.dataEntrega)}</div>` : ""}
                        ${r.dataCadastro ? `<div class="text-mono">Cad: ${escapeHtml(r.dataCadastro)}</div>` : ""}
                        ${!r.dataEntrega && !r.dataCadastro ? "-" : ""}
                      </td>
                      ${
                        showRendaCol
                          ? `<td class="osint-td-meta">
                               ${r.cargo ? `<div>${escapeHtml(r.cargo)}</div>` : ""}
                               ${r.faixaRenda || r.remuneracao ? `<div class="text-mono">${escapeHtml(r.remuneracao || r.faixaRenda)}</div>` : ""}
                               ${!r.cargo && !r.faixaRenda && !r.remuneracao ? "-" : ""}
                             </td>`
                          : ""
                      }
                      <td class="osint-td-right">
                        ${
                          r.cpfRaw.length >= 11
                            ? `<button type="button" class="btn btn-primary btn-sm btn-puxar-cpf-item" data-cpf="${escapeHtml(r.cpfRaw)}" title="Consultar Dossiê deste CPF">
                                 <i data-lucide="search" class="icon-xs"></i>
                                 <span>Investigar CPF</span>
                               </button>`
                            : `<span class="osint-td-dim">Parcial</span>`
                        }
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div id="emptyFiltroEmpregos" class="osint-emp-filter-empty is-hidden">
          Nenhum funcionário encontrado para o filtro aplicado.
        </div>
      </div>
    `;
  },

  renderEmpregos(responseData, rawPayload, records, rawCount) {
    const cpfRaw =
      String(
        rawPayload?.cpf_raw ||
        rawPayload?.titular?.cpf_raw ||
        records.find((r) => r.cpfRaw)?.cpfRaw ||
        responseData?.termo ||
        ""
      ).replace(/\D/g, "");
    const formattedCpf = cpfRaw.length === 11 ? Formatters.cpf(cpfRaw) : (rawPayload?.cpf || "CPF não informado");
    const titularNome =
      cleanEmploymentValue(
        rawPayload?.nome ||
        rawPayload?.titular?.nome ||
        records.find((r) => r.nome)?.nome
      ) || `TITULAR CPF ${formattedCpf}`;
    const regiaoCpf = Formatters.cpfRegion(cpfRaw);

    return `
      <div class="card osint-section-card osint-section-card--amber osint-emp-hero" data-employment-root="empregos">
        <div class="osint-emp-header-row">
          <div class="osint-emp-identity">
            <div class="osint-emp-badges">
              <span class="badge badge-warning">HISTÓRICO TRABALHISTA (CTPS / RAIS)</span>
              <span class="badge badge-emerald">${records.length} ${records.length === 1 ? "Vínculo Localizado" : "Vínculos Localizados"}</span>
              ${
                rawCount > records.length
                  ? `<span class="badge badge-dark">${rawCount} registros consolidados</span>`
                  : ""
              }
            </div>
            <h2 class="osint-emp-title">${escapeHtml(titularNome)}</h2>
            <div class="osint-emp-subrow">
              <span class="osint-emp-doc-pill">
                <i data-lucide="fingerprint" class="icon-xs icon-emerald"></i>
                <span class="text-mono">${escapeHtml(formattedCpf)}</span>
              </span>
              ${
                regiaoCpf.regiao !== "N/I"
                  ? `<span class="badge-regiao-fiscal" title="${escapeHtml(regiaoCpf.descricao)}">
                       <i data-lucide="map-pin"></i>
                       <span class="badge-regiao-sigla">${escapeHtml(regiaoCpf.regiao)} &bull;</span>${escapeHtml(regiaoCpf.estados)}
                     </span>`
                  : ""
              }
              ${
                cpfRaw.length === 11
                  ? `
                <button type="button" class="btn btn-ghost btn-xs btn-copiar-cpf" data-cpf="${escapeHtml(cpfRaw)}" title="Copiar CPF">
                  <i data-lucide="copy" class="icon-xs"></i>
                  <span>Copiar CPF</span>
                </button>
                <button type="button" class="btn btn-primary btn-xs btn-puxar-cpf-item" data-cpf="${escapeHtml(cpfRaw)}" title="Abrir Dossiê Completo do CPF">
                  <i data-lucide="user-check" class="icon-xs"></i>
                  <span>Investigar CPF</span>
                </button>
              `
                  : ""
              }
            </div>
          </div>
        </div>

        ${
          records.length > 3
            ? `<div class="osint-filter-bar mt-4">
                 <div class="osint-filter-inputs">
                   <input
                     type="text"
                     id="inputFiltroEmpregos"
                     class="input-filter-inline osint-emp-search"
                     placeholder="Filtrar por empregador, CNPJ, data ou situação..."
                   >
                 </div>
                 <span class="osint-filter-counter" id="contadorEmpregosVisiveis">
                   Exibindo ${records.length} de ${records.length} vínculos
                 </span>
               </div>`
            : ""
        }

        <div class="osint-emp-cards-grid mt-4">
          ${records
            .map((r, idx) => {
              const hasDesligamento = Boolean(r.dataDesligamento);
              const toneClass = getSituacaoTone(r.situacao, hasDesligamento);
              const searchTokens = `${r.razaoSocial} ${r.cnpj} ${r.cnpjRaw} ${r.situacao} ${r.dataAdmissao} ${r.dataDesligamento} ${r.dataEntrega} ${r.faixaRenda}`.toLowerCase();

              return `
                <div class="osint-emp-bond-card linha-emprego-item" data-search="${escapeHtml(searchTokens)}">
                  <div class="osint-emp-bond-top">
                    <div>
                      <div class="osint-emp-bond-index">#${idx + 1} &bull; EMPREGADOR</div>
                      <h3 class="osint-emp-bond-company">${escapeHtml(r.razaoSocial || "Razão Social Não Informada")}</h3>
                      <div class="osint-emp-bond-cnpj">
                        <span class="text-mono">${escapeHtml(r.cnpj || "CNPJ não informado")}</span>
                        ${
                          r.cnpjRaw.length === 14
                            ? `<button type="button" class="btn btn-ghost btn-copy-inline btn-copiar-texto btn-action-copy" data-copy="${escapeHtml(r.cnpjRaw)}" title="Copiar CNPJ">
                                 <i data-lucide="copy" class="icon-xs"></i>
                               </button>`
                            : ""
                        }
                      </div>
                    </div>

                    <div class="osint-chip-row">
                      <span class="osint-emp-status-pill ${toneClass}">${escapeHtml(r.situacao)}</span>
                      ${
                        r.cnpjRaw.length === 14
                          ? `<button type="button" class="btn btn-outline btn-xs btn-puxar-cnpj" data-cnpj="${escapeHtml(r.cnpjRaw)}" title="Investigar Empresa por CNPJ">
                               <i data-lucide="building-2" class="icon-xs"></i>
                               <span>Investigar CNPJ</span>
                             </button>`
                          : ""
                      }
                    </div>
                  </div>

                  <div class="osint-kv-grid mt-3">
                    <div class="osint-kv-box">
                      <span class="osint-kv-label">Data de Admissão</span>
                      <div class="osint-kv-value text-mono">${escapeHtml(r.dataAdmissao || "Não informada")}</div>
                    </div>
                    <div class="osint-kv-box">
                      <span class="osint-kv-label">Desligamento</span>
                      <div class="osint-kv-value">
                        ${
                          hasDesligamento
                            ? `<span class="text-mono">${escapeHtml(r.dataDesligamento)}</span>`
                            : `<span class="osint-emp-active-tag">Sem desligamento registrado</span>`
                        }
                      </div>
                    </div>
                    <div class="osint-kv-box">
                      <span class="osint-kv-label">Data de Entrega</span>
                      <div class="osint-kv-value text-mono">${escapeHtml(r.dataEntrega || "Não informada")}</div>
                    </div>
                    <div class="osint-kv-box">
                      <span class="osint-kv-label">Data de Cadastro</span>
                      <div class="osint-kv-value text-mono">${escapeHtml(r.dataCadastro || "Não informada")}</div>
                    </div>
                    ${
                      r.faixaRenda || r.remuneracao
                        ? `<div class="osint-kv-box">
                             <span class="osint-kv-label">Faixa de Renda / Remuneração</span>
                             <div class="osint-kv-value osint-kv-value--mint text-mono">${escapeHtml(r.remuneracao || r.faixaRenda)}</div>
                           </div>`
                        : ""
                    }
                    ${
                      r.cargo
                        ? `<div class="osint-kv-box">
                             <span class="osint-kv-label">Cargo / CBO</span>
                             <div class="osint-kv-value">${escapeHtml(r.cargo)}</div>
                           </div>`
                        : ""
                    }
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <div id="emptyFiltroEmpregos" class="osint-emp-filter-empty is-hidden">
          Nenhum vínculo encontrado para o termo digitado.
        </div>
      </div>
    `;
  },
};

export function bindEmploymentFilters(container) {
  if (!container) return;
  const root = container.querySelector("[data-employment-root]");
  if (!root) return;

  const input = root.querySelector("#inputFiltroEmpregos");
  const filterBtns = root.querySelectorAll(".btn-filtro-emp");
  const rows = root.querySelectorAll(".linha-emprego-item");
  const counterEl = root.querySelector("#contadorEmpregosVisiveis");
  const emptyEl = root.querySelector("#emptyFiltroEmpregos");

  const applyFilter = () => {
    const query = String(input?.value || "").toLowerCase().trim();
    const activeBtn = root.querySelector(".btn-filtro-emp.active");
    const statusFilter = activeBtn?.getAttribute("data-emp-filter") || "todos";

    let visibleCount = 0;
    rows.forEach((row) => {
      const searchData = row.getAttribute("data-search") || "";
      const rowStatus = row.getAttribute("data-emp-status") || "ativo";
      const matchQuery = !query || searchData.includes(query);
      const matchStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativos" && rowStatus === "ativo") ||
        (statusFilter === "desligados" && rowStatus === "desligado");

      if (matchQuery && matchStatus) {
        row.style.display = "";
        visibleCount += 1;
      } else {
        row.style.display = "none";
      }
    });

    if (counterEl) {
      counterEl.textContent = `Exibindo ${visibleCount} de ${rows.length} vínculos`;
    }
    if (emptyEl) {
      emptyEl.classList.toggle("is-hidden", visibleCount > 0);
    }
  };

  if (input) {
    input.addEventListener("input", applyFilter);
  }
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter();
    });
  });
}

export default EmploymentInterpreter;
