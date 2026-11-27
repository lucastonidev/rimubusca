/**
 * ==============================================================================
 * ZEROY API INTERPRETER - CPF / INDIVIDUAL DOSSIER (CPF-DOSSIER.JS)
 * Decodes basicData, parentage, driver license, SUS/CNS, phones,
 * addresses, income tax, bank relations, occupations, and geographic neighbors.
 * Standardized with Clean Code principles and English naming.
 * ==============================================================================
 */

import { Formatters } from "../../utils.js";

export const CpfDossierInterpreter = {
  /**
   * Renders complete individual investigation dossier from Zeroy API response
   * @param {Object} dataRoot Raw or normalized response payload
   * @returns {string} HTML markup
   */
  render(dataRoot) {
    const payload = dataRoot?.data || dataRoot || {};
    const basicData = payload.dadosBasicos || {};
    const isEmptyBasic =
      Boolean(dataRoot?.notFound || payload?.notFound) ||
      (!basicData.nome && !payload.nome && !basicData.cpf && !payload.cpf);

    if (isEmptyBasic) {
      return `
        <div class="card osint-empty-card osint-empty-card--purple">
          <div class="osint-empty-icon osint-empty-icon--warning">
            <i data-lucide="user-x" class="icon-xl"></i>
          </div>
          <h3 class="osint-empty-title">Nenhum Registro Localizado</h3>
          <p class="osint-empty-desc">
            Não encontramos dados cadastrais para o CPF consultado na Zeroy API.
          </p>
        </div>
      `;
    }

    const parents = basicData.filiacao || {};
    const driverLicense = payload.carteriaHabilitacao || {};
    const phones = payload.telefonesHistorico || [];
    const emails = payload.emails || [];
    const addresses = payload.enderecos || [];
    const jobs = payload.empregos || [];
    const banks = payload.contasBancarias || [];
    const incomeTax = payload.irpf || [];
    const cnsList = payload.cnsHistorico || [];
    const neighbors = payload.vizinhos || [];
    const relatives = payload.parentes || [];
    const newRelatives = payload.parentesNovos || [];
    const purchasingPower = payload.poderAquisitivo || {};
    const serasaMosaic = payload.serasaMosaic || {};
    const photos = payload.fotos || basicData.biometria || [];

    // Biometric Photo / Base64 resolution
    let photoUrl = null;
    if (Array.isArray(photos) && photos.length > 0) {
      photoUrl = Formatters.base64Image(photos[0]);
    } else if (typeof photos === "string") {
      photoUrl = Formatters.base64Image(photos);
    }

    const fullName = basicData.nome || payload.nome || "Nome não informado";
    const formattedCpf = Formatters.cpf(basicData.cpf || payload.cpf);
    const cleanCpf = String(basicData.cpf || payload.cpf || "").replace(/\D/g, "");
    const birthDate = Formatters.date(basicData.dataNasc || basicData.nascimento);
    const age = Formatters.age(basicData.dataNasc || basicData.nascimento);
    const registrationStatus = basicData.situacaoCadastral?.descricaoSit || "REGULAR";
    const isRegular = registrationStatus.toUpperCase().includes("REGULAR");

    const rawGender = String(basicData.sexo || "").trim().toUpperCase();
    const gender = rawGender.startsWith("M")
      ? "Masculino"
      : rawGender.startsWith("F")
        ? "Feminino"
        : (basicData.sexo || "Não informado");

    const maritalStatus =
      basicData.estCivil && basicData.estCivil !== "Não Informado"
        ? basicData.estCivil
        : null;

    // Plain text investigative summary for 1-click clipboard copy
    const dossierSummaryText = [
      `=== DOSSIÊ CADASTRAL - RIMUBUSCA OSINT ===`,
      `NOME: ${fullName}`,
      `CPF: ${formattedCpf}`,
      `SITUAÇÃO: ${registrationStatus}`,
      `NASCIMENTO: ${birthDate} ${age !== null ? `(${age} anos)` : ""}`,
      `SEXO: ${gender}`,
      parents.nomeMae ? `MÃE: ${parents.nomeMae}` : null,
      parents.nomePai ? `PAI: ${parents.nomePai}` : null,
      driverLicense.registro
        ? `CNH: ${driverLicense.registro} (UF: ${driverLicense.uf || "N/A"} - Val: ${Formatters.date(driverLicense.validade)})`
        : null,
      phones.length > 0
        ? `TELEFONES: ${phones.map((t) => `${Formatters.phone(t.ddd, t.telefone)}${String(t.whatsapp).toUpperCase() === "SIM" ? " [WhatsApp]" : ""}`).join(", ")}`
        : null,
      emails.length > 0
        ? `EMAILS: ${emails.map((e) => e.email || e).join(", ")}`
        : null,
      addresses.length > 0
        ? `ENDEREÇO: ${addresses[0].logradouro || ""}, ${addresses[0].numero || "S/N"} - ${addresses[0].bairro || ""}, ${addresses[0].cidade || ""}/${addresses[0].siglaUf || ""} (CEP: ${Formatters.cep(addresses[0].cep)})`
        : null,
      basicData.rendaAtual
        ? `RENDA ESTIMADA: ${Formatters.currency(basicData.rendaAtual)}`
        : null,
      `DATA CONSULTA: ${new Date().toLocaleString("pt-BR")}`,
    ]
      .filter(Boolean)
      .join("\n");

    return `
      <!-- BARRA SUPERIOR DE AÇÕES INVESTIGATIVAS -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: var(--space-4); background: rgba(255, 255, 255, 0.02); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 8px #10B981;"></span>
          <span style="font-size: 0.8rem; font-weight: 700; color: #10B981; letter-spacing: 0.5px; text-transform: uppercase;">Dossiê Completo de Pessoa Física</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn-action-copy btn-copiar-resumo-dossie" data-resumo="${encodeURIComponent(dossierSummaryText)}" title="Copiar resumo textual para bloco de notas">
            <i data-lucide="clipboard-copy" style="width: 13px; height: 13px;"></i>
            <span>Copiar Resumo OSINT</span>
          </button>
          <button type="button" class="btn-action-copy btn-imprimir-dossie" title="Imprimir ou gerar PDF deste dossiê">
            <i data-lucide="printer" style="width: 13px; height: 13px;"></i>
            <span>Imprimir / PDF</span>
          </button>
          <button type="button" class="btn-action-copy btn-scroll-json" title="Visualizar JSON bruto no rodapé">
            <i data-lucide="code" style="width: 13px; height: 13px;"></i>
            <span>Ver JSON</span>
          </button>
        </div>
      </div>

      <!-- CABEÇALHO DO DOSSIÊ (PERFIL DO ALVO) -->
      <div class="card" style="margin-bottom: var(--space-4); border-left: 4px solid #10B981; background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(24, 24, 27, 0.95) 100%);">
        <div style="display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap;">
          
          <!-- Foto Biométrica / Avatar com suporte a Lightbox Modal -->
          <div style="position: relative; flex-shrink: 0;">
            ${
              photoUrl
                ? `
              <div style="position: relative; cursor: pointer;" class="btn-abrir-foto-modal" data-foto="${photoUrl}" data-nome="${fullName}" title="Clique para ampliar a foto biométrica">
                <img src="${photoUrl}" alt="Foto Biométrica de ${fullName}" style="width: 84px; height: 84px; border-radius: var(--radius-md); object-fit: cover; border: 2px solid #10B981; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.35); transition: transform 0.2s;">
                <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
                  <i data-lucide="maximize-2" style="color: #FFFFFF; width: 18px; height: 18px;"></i>
                </div>
              </div>
            `
                : `
              <div style="width: 84px; height: 84px; border-radius: var(--radius-md); background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); color: #10B981; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid rgba(16, 185, 129, 0.4);">
                <span style="font-size: 2rem; font-weight: 800; line-height: 1;">${fullName.charAt(0).toUpperCase()}</span>
                <i data-lucide="user" style="width: 14px; height: 14px; opacity: 0.6; margin-top: 2px;"></i>
              </div>
            `
            }
            <span class="badge" style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); font-size: 0.65rem; background: ${isRegular ? "#10B981" : "#EF4444"}; color: #000; font-weight: 800; padding: 2px 7px; white-space: nowrap;">
              ${registrationStatus}
            </span>
          </div>

          <!-- Informações Primárias de Identificação -->
          <div style="flex: 1; min-width: 260px;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h2 style="font-size: 1.4rem; font-weight: 800; color: #FFFFFF; margin: 0;">${fullName}</h2>
              <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${fullName}" title="Copiar Nome">
                <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                <span>Copiar</span>
              </button>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; font-size: 0.875rem;">
              <div>
                <span style="color: var(--color-text-muted);">CPF:</span>
                <strong style="font-family: var(--font-mono); color: #10B981; margin-left: 4px;">${formattedCpf}</strong>
                <button type="button" class="btn-action-copy btn-copiar-cpf" data-cpf="${cleanCpf}" title="Copiar CPF limpo">
                  <i data-lucide="copy" style="width: 11px; height: 11px;"></i>
                </button>
              </div>
              <span>&bull;</span>
              <div>
                <span style="color: var(--color-text-muted);">Nascimento:</span>
                <strong style="color: #FFFFFF; margin-left: 4px;">${birthDate}</strong>
                ${age !== null ? `<span style="color: #A78BFA; font-weight: 600; margin-left: 2px;">(${age} anos)</span>` : ""}
              </div>
              <span>&bull;</span>
              <div>
                <span style="color: var(--color-text-muted);">Sexo:</span>
                <strong style="color: #FFFFFF; margin-left: 4px;">${gender}</strong>
              </div>
              ${
                maritalStatus
                  ? `
                <span>&bull;</span>
                <div>
                  <span style="color: var(--color-text-muted);">Estado Civil:</span>
                  <strong style="color: #FFFFFF; margin-left: 4px;">${maritalStatus}</strong>
                </div>
              `
                  : ""
              }
            </div>

            ${
              basicData.desaparecido
                ? `
              <div style="margin-top: 8px;">
                <span class="badge" style="background: #EF4444; color: #FFF; font-weight: 800; padding: 3px 8px;">
                  <i data-lucide="alert-triangle" style="width: 12px; height: 12px;"></i> PESSOA CONSTA COMO DESAPARECIDA
                </span>
              </div>
            `
                : ""
            }
          </div>

          <!-- Indicadores Rápidos de Score / Renda / Poder Aquisitivo -->
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${
              basicData.rendaAtual
                ? `
              <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 8px 14px; text-align: right;">
                <span style="font-size: 0.68rem; color: #10B981; text-transform: uppercase; font-weight: 700;">Renda Estimada</span>
                <div style="font-size: 1.15rem; font-weight: 800; color: #10B981; font-family: var(--font-mono);">${Formatters.currency(basicData.rendaAtual)}</div>
              </div>
            `
                : ""
            }
            ${
              basicData.faixaScore
                ? `
              <div style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: var(--radius-md); padding: 8px 14px; text-align: right;">
                <span style="font-size: 0.68rem; color: #A78BFA; text-transform: uppercase; font-weight: 700;">Faixa Score Serasa</span>
                <div style="font-size: 0.95rem; font-weight: 800; color: #A78BFA;">${basicData.faixaScore}</div>
              </div>
            `
                : ""
            }
            ${
              purchasingPower.PODER_AQUISITIVO
                ? `
              <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: var(--radius-md); padding: 8px 14px; text-align: right;">
                <span style="font-size: 0.68rem; color: #60A5FA; text-transform: uppercase; font-weight: 700;">Poder Aquisitivo</span>
                <div style="font-size: 0.95rem; font-weight: 800; color: #60A5FA;">${purchasingPower.PODER_AQUISITIVO}</div>
              </div>
            `
                : ""
            }
            ${
              serasaMosaic.codMosaic
                ? `
              <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 8px 14px; text-align: right;">
                <span style="font-size: 0.68rem; color: #F59E0B; text-transform: uppercase; font-weight: 700;">Mosaic Serasa</span>
                <div style="font-size: 0.95rem; font-weight: 800; color: #F59E0B; font-family: var(--font-mono);">${serasaMosaic.codMosaic}</div>
              </div>
            `
                : ""
            }
          </div>
        </div>
      </div>

      <!-- FILIAÇÃO & VÍNCULOS FAMILIARES -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- Filiação (Mãe e Pai) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="users" style="color: #F43F5E; width: 18px; height: 18px;"></i>
              <span>Filiação Direta</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.875rem;">
            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Mãe</span>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                <strong style="color: var(--color-text);">${parents.nomeMae || "Não informada"}</strong>
                ${
                  parents.nomeMae
                    ? `
                  <button type="button" class="btn-action-puxar btn-buscar-nome-alvo" data-nome="${parents.nomeMae}" title="Buscar homônimos e CPF da mãe">
                    <i data-lucide="search" style="width: 11px; height: 11px;"></i>
                    <span>Pesquisar</span>
                  </button>
                `
                    : ""
                }
              </div>
            </div>

            <div>
              <span style="color: var(--color-text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 600;">Pai</span>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                <strong style="color: var(--color-text);">${parents.nomePai || "Não informado"}</strong>
                ${
                  parents.nomePai
                    ? `
                  <button type="button" class="btn-action-puxar btn-buscar-nome-alvo" data-nome="${parents.nomePai}" title="Buscar homônimos e CPF do pai">
                    <i data-lucide="search" style="width: 11px; height: 11px;"></i>
                    <span>Pesquisar</span>
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Parentes & Vínculos Declarados -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="git-branch" style="color: #EC4899; width: 18px; height: 18px;"></i>
              <span>Parentes & Vínculos Identificados</span>
            </h3>
          </div>
          <div style="font-size: 0.875rem; max-height: 220px; overflow-y: auto;">
            ${
              newRelatives.length > 0 || relatives.length > 0
                ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${newRelatives
                  .map((p) => {
                    const relativeCpfClean = String(p.cpf || "").replace(/\D/g, "");
                    return `
                    <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span class="badge" style="background: rgba(236, 72, 153, 0.15); color: #F472B6; font-size: 0.7rem;">${p.tipoRelacao || "PARENTESCO"}</span>
                          <strong style="color: #FFFFFF;">${p.nome}</strong>
                        </div>
                        ${p.cpf ? `<div style="font-family: var(--font-mono); font-size: 0.75rem; color: #10B981; margin-top: 2px;">CPF: ${Formatters.cpf(p.cpf)}</div>` : ""}
                      </div>
                      <div style="display: flex; gap: 4px;">
                        ${
                          relativeCpfClean
                            ? `
                          <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${relativeCpfClean}" title="Consultar dados deste parente">
                            <span>Puxar</span>
                          </button>
                        `
                            : `
                          <button type="button" class="btn-action-puxar btn-buscar-nome-alvo" data-nome="${p.nome}" title="Pesquisar este nome">
                            <i data-lucide="search" style="width: 11px; height: 11px;"></i>
                          </button>
                        `
                        }
                      </div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            `
                : `
              <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum parente secundário mapeado no registro.</div>
            `
            }
          </div>
        </div>
      </div>

      <!-- DOCUMENTOS OFICIAIS: CNH & CARTÃO DO SUS (CNS) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- CNH Detalhada -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="id-card" style="color: #60A5FA; width: 18px; height: 18px;"></i>
              <span>Carteira Nacional de Habilitação (CNH)</span>
            </h3>
          </div>
          ${
            driverLicense.registro
              ? `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.85rem;">
              <div>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">Nº Registro CNH</span>
                <div style="font-family: var(--font-mono); font-weight: 700; color: #60A5FA;">${driverLicense.registro}</div>
              </div>
              <div>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">UF Habilitação</span>
                <div style="font-weight: 700;">${driverLicense.uf || "N/A"}</div>
              </div>
              <div>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">Validade da CNH</span>
                <div style="font-weight: 700; color: #10B981;">${Formatters.date(driverLicense.validade)}</div>
              </div>
              <div>
                <span style="color: var(--color-text-muted); font-size: 0.75rem;">1ª Habilitação</span>
                <div style="font-weight: 700;">${Formatters.date(driverLicense.primeiracnh)}</div>
              </div>
              ${
                driverLicense.cursos_resumo
                  ? `
                <div style="grid-column: span 2; margin-top: 4px; padding-top: 6px; border-top: 1px dashed var(--color-border);">
                  <span style="color: var(--color-text-muted); font-size: 0.725rem;">Cursos & Reciclagens:</span>
                  <div style="font-size: 0.8rem; color: #C4B5FD; line-height: 1.3;">${driverLicense.cursos_resumo}</div>
                </div>
              `
                  : ""
              }
            </div>
          `
              : `
            <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum registro ativo de CNH localizado.</div>
          `
          }
        </div>

        <!-- Cartão SUS / CNS -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="activity" style="color: #10B981; width: 18px; height: 18px;"></i>
              <span>Cartão Nacional de Saúde (SUS / CNS)</span>
            </h3>
          </div>
          ${
            cnsList.length > 0
              ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${cnsList
                .map(
                  (c) => `
                <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span style="font-family: var(--font-mono); font-weight: 700; color: #10B981; font-size: 0.95rem;">${c.cns}</span>
                      <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.65rem;">${c.tipo || "DEFINITIVO"}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--color-text-dim); margin-top: 2px;">${c.origem || "Sistema Único de Saúde"}</div>
                  </div>
                  <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${c.cns}" title="Copiar Nº do CNS">
                    <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                  </button>
                </div>
              `,
                )
                .join("")}
            </div>
          `
              : `
            <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum cadastro de CNS identificado.</div>
          `
          }
        </div>
      </div>

      <!-- CONTATOS: TELEFONES (COM WHATSAPP) & E-MAILS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- Telefones com WhatsApp -->
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="phone" style="color: #F59E0B; width: 18px; height: 18px;"></i>
              <span>Telefones Localizados (${phones.length})</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
            ${
              phones.length > 0
                ? phones
                    .map((tel) => {
                      const formattedPhone = Formatters.phone(tel.ddd, tel.telefone);
                      const isWhatsApp = String(tel.whatsapp || "").toUpperCase() === "SIM";
                      const rawPhone = `${tel.ddd || ""}${tel.telefone || ""}`.replace(/\D/g, "");

                      return `
                <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <strong style="font-family: var(--font-mono); font-size: 0.95rem; color: #FFFFFF;">${formattedPhone}</strong>
                      ${
                        isWhatsApp
                          ? `
                        <span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10B981; font-size: 0.65rem; padding: 2px 6px; font-weight: 700;">
                          WHATSAPP
                        </span>
                      `
                          : ""
                      }
                    </div>
                    <div style="font-size: 0.75rem; color: var(--color-text-dim); margin-top: 2px;">
                      ${tel.tipo || "Telefone"} ${tel.ano && tel.ano !== "Não Informado" ? `&bull; Base: ${tel.ano}` : ""}
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px;">
                    ${
                      isWhatsApp
                        ? `
                      <a href="https://wa.me/55${rawPhone}" target="_blank" rel="noopener noreferrer" class="btn-action-puxar" style="color: #10B981; border-color: rgba(16, 185, 129, 0.4);" title="Abrir conversa no WhatsApp Web">
                        <i data-lucide="message-circle" style="width: 12px; height: 12px;"></i>
                        <span>Conversar</span>
                      </a>
                    `
                        : ""
                    }
                    <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${rawPhone}" title="Copiar Telefone">
                      <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                    </button>
                  </div>
                </div>
              `;
                    })
                    .join("")
                : `
              <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum telefone registrado.</div>
            `
            }
          </div>
        </div>

        <!-- E-mails Identificados -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="mail" style="color: #A855F7; width: 18px; height: 18px;"></i>
              <span>E-mails Identificados (${emails.length})</span>
            </h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto;">
            ${
              emails.length > 0
                ? emails
                    .map((em) => {
                      const emailStr = em.email || em.endereco || String(em);
                      const isConfirmed = String(em.statusVt || "").toUpperCase() === "CONFIRMADO";

                      return `
                <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div style="overflow: hidden; text-overflow: ellipsis; margin-right: 8px;">
                    <div style="font-weight: 600; font-size: 0.875rem; color: #FFFFFF; font-family: var(--font-mono);">${emailStr}</div>
                    ${
                      isConfirmed
                        ? `
                      <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.65rem; padding: 1px 5px;">CONFIRMADO</span>
                    `
                        : ""
                    }
                  </div>
                  <div style="display: flex; gap: 6px;">
                    <a href="mailto:${emailStr}" class="btn-action-copy" title="Enviar e-mail">
                      <i data-lucide="send" style="width: 12px; height: 12px;"></i>
                    </a>
                    <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${emailStr}" title="Copiar E-mail">
                      <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                    </button>
                  </div>
                </div>
              `;
                    })
                    .join("")
                : `
              <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum e-mail registrado.</div>
            `
            }
          </div>
        </div>
      </div>

      <!-- HISTÓRICO DE ENDEREÇOS -->
      <div class="card" style="margin-bottom: var(--space-4);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="map-pin" style="color: #10B981; width: 18px; height: 18px;"></i>
            <span>Histórico de Endereços Registrados (${addresses.length})</span>
          </h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; max-height: 380px; overflow-y: auto;">
          ${
            addresses.length > 0
              ? addresses
                  .map((addr, idx) => {
                    const formattedCep = Formatters.cep(addr.cep);
                    const cleanCep = String(addr.cep || "").replace(/\D/g, "");
                    const fullAddress = `${addr.logradouro || ""} ${addr.numero && addr.numero !== "Não Informado" ? ", " + addr.numero : ""} ${addr.complemento && addr.complemento !== "Não Informado" ? "- " + addr.complemento : ""} - ${addr.bairro || ""}, ${addr.cidade || ""}/${addr.siglaUf || addr.uf || ""}`;

                    return `
              <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <span class="badge" style="background: rgba(255, 255, 255, 0.06); font-size: 0.7rem;">Endereço #${idx + 1}</span>
                    <span style="font-family: var(--font-mono); font-weight: 700; color: #10B981; font-size: 0.8rem;">${formattedCep}</span>
                  </div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: #FFFFFF; line-height: 1.4;">
                    ${addr.logradouro || "Logradouro não informado"} ${addr.numero && addr.numero !== "Não Informado" ? ", Nº " + addr.numero : ""}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 4px;">
                    ${addr.bairro || ""} &bull; ${addr.cidade || ""}/${addr.siglaUf || addr.uf || ""}
                  </div>
                </div>
                <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap;">
                  ${
                    cleanCep
                      ? `
                    <button type="button" class="btn-action-puxar btn-buscar-cep-vizinhos" data-cep="${cleanCep}" title="Buscar vizinhos deste CEP">
                      <i data-lucide="users" style="width: 11px; height: 11px;"></i>
                      <span>Vizinhos</span>
                    </button>
                  `
                      : ""
                  }
                  <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}" target="_blank" rel="noopener noreferrer" class="btn-action-copy" title="Ver no Google Maps">
                    <i data-lucide="external-link" style="width: 12px; height: 12px;"></i>
                    <span>Maps</span>
                  </a>
                  <button type="button" class="btn-action-copy btn-copiar-texto" data-copy="${fullAddress}" title="Copiar Endereço">
                    <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                  </button>
                </div>
              </div>
            `;
                  })
                  .join("")
              : `
            <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum endereço registrado.</div>
          `
          }
        </div>
      </div>

      <!-- PROFISSÃO, BANCOS & RESTITUIÇÃO IRPF -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-4);">
        <!-- Ocupação e Empregos -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="briefcase" style="color: #D97706; width: 18px; height: 18px;"></i>
              <span>Ocupação Profissional</span>
            </h3>
          </div>
          <div style="font-size: 0.875rem;">
            ${
              jobs.length > 0
                ? jobs
                    .map(
                      (emp) => `
              <div style="background: var(--color-surface-2); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-border); margin-bottom: 8px;">
                <strong style="color: #FFFFFF; font-size: 0.9rem;">${emp.descricao || "Profissão"}</strong>
                <div style="font-size: 0.75rem; color: var(--color-text-dim); margin-top: 2px;">CBO: ${emp.cbo || "N/A"}</div>
              </div>
            `,
                    )
                    .join("")
                : `
              <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum vínculo empregatício informado.</div>
            `
            }
          </div>
        </div>

        <!-- Vínculos Bancários & Contas -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="landmark" style="color: #8B5CF6; width: 18px; height: 18px;"></i>
              <span>Instituições Bancárias (${banks.length})</span>
            </h3>
          </div>
          <div style="font-size: 0.85rem; max-height: 200px; overflow-y: auto;">
            ${
              banks.length > 0
                ? banks
                    .map(
                      (bc) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="building" style="width: 14px; height: 14px; color: #A78BFA;"></i>
                  <span style="font-weight: 600; color: #FFFFFF;">${bc.instituicao}</span>
                </div>
                <span style="color: var(--color-text-muted); font-family: var(--font-mono); font-size: 0.8rem;">
                  ${bc.agencia ? "Ag: " + bc.agencia : ""} ${bc.numero ? "- Conta: " + bc.numero : ""}
                </span>
              </div>
            `,
                    )
                    .join("")
                : `
              <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 12px 0;">Nenhum banco identificado.</div>
            `
            }
          </div>
        </div>
      </div>

      <!-- RESTITUIÇÃO DO IRPF -->
      ${
        incomeTax.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="receipt" style="color: #10B981; width: 18px; height: 18px;"></i>
              <span>Restituição do Imposto de Renda (IRPF) (${incomeTax.length} Exercícios)</span>
            </h3>
          </div>
          <div style="overflow-x: auto;">
            <table class="zeroy-data-table">
              <thead>
                <tr>
                  <th>Ano Exercício</th>
                  <th>Lote</th>
                  <th>Banco / Agência</th>
                  <th>Situação na Receita</th>
                  <th style="text-align: right;">Data da Consulta</th>
                </tr>
              </thead>
              <tbody>
                ${incomeTax
                  .map(
                    (item) => `
                  <tr>
                    <td style="font-weight: 700; color: #10B981; font-family: var(--font-mono);">${item.anoReferencia || "N/A"}</td>
                    <td>Lote ${item.lote || "Único"}</td>
                    <td>${item.instituicao || "Banco"} ${item.codAgencia ? "(Ag: " + item.codAgencia + ")" : ""}</td>
                    <td>
                      <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10B981; font-weight: 700;">
                        ${item.situacaoReceita || "CREDITADA"}
                      </span>
                    </td>
                    <td style="text-align: right; color: var(--color-text-dim); font-size: 0.8rem; font-family: var(--font-mono);">
                      ${Formatters.date(item.dataConsulta)}
                    </td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }

      <!-- VIZINHOS DO MESMO RAIO GEOGRÁFICO -->
      ${
        neighbors.length > 0
          ? `
        <div class="card" style="margin-bottom: var(--space-4);">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <h3 class="card-title" style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="users" style="color: #10B981; width: 18px; height: 18px;"></i>
              <span>Vizinhos Mapeados no Local (${neighbors.length})</span>
            </h3>

            <div class="zeroy-table-search" style="max-width: 280px; min-width: 220px;">
              <i data-lucide="search"></i>
              <input type="text" id="filtroVizinhosInput" placeholder="Filtrar vizinhos..." autocomplete="off">
            </div>
          </div>
          <div style="overflow-x: auto; max-height: 420px;">
            <table class="zeroy-data-table" id="tabelaVizinhosZeroy">
              <thead>
                <tr>
                  <th>Nome do Vizinho</th>
                  <th>CPF</th>
                  <th>Nascimento</th>
                  <th>Endereço Completo</th>
                  <th style="text-align: right; width: 100px;">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${neighbors
                  .map((vz) => {
                    const neighborCpfClean = String(vz.cpf || "").replace(/\D/g, "");
                    const fullNeighborAddress = vz.endereco?.endereco_completo || "";

                    return `
                    <tr class="linha-vizinho-zeroy" data-search="${String(vz.nome || "").toLowerCase()} ${neighborCpfClean} ${fullNeighborAddress.toLowerCase()}">
                      <td style="font-weight: 700; color: #FFFFFF;">${vz.nome}</td>
                      <td style="font-family: var(--font-mono); color: #10B981;">${Formatters.cpf(vz.cpf)}</td>
                      <td>${vz.data_nascimento || "N/A"}</td>
                      <td style="font-size: 0.8rem; color: var(--color-text-muted);">${fullNeighborAddress}</td>
                      <td style="text-align: right;">
                        <button type="button" class="btn-action-puxar btn-puxar-cpf" data-cpf="${neighborCpfClean}" title="Investigar este vizinho">
                          <span>Puxar</span>
                        </button>
                      </td>
                    </tr>
                  `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      `
          : ""
      }
    `;
  },
};

// Backward compatibility alias
export const CpfDossieInterpreter = CpfDossierInterpreter;

