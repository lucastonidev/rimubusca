/**
 * ==============================================================================
 * HEXYS API INTERPRETER - VEHICLE & FLEET DOSSIER (VEHICLE.JS)
 * Comprehensive visual renderer for vehicle queries (Placa, Chassi, Renavam).
 * Displays full visual identities, Mercosul & old plates, brand/detran logos,
 * vehicle photos & gallery, complete technical specs, FIPE valuation,
 * full national IPVA comparison (27 states), 70+ equipment tags, and
 * complete Owner OSINT cross-referencing dossier.
 * Clean Code standards with English identifiers and strict null-safety.
 * ==============================================================================
 */

import { Formatters, escapeHtml } from "../../utils.js";

export const VehicleInterpreter = {
  /**
   * Renders comprehensive vehicle dossier from Hexys API payload
   * @param {Object} responseData - Root query response metadata
   * @param {Object} dataPayload - Extracted data payload
   * @returns {string} HTML markup
   */
  render(responseData, dataPayload) {
    const data = dataPayload || {};

    // 1. Identification & Plate Variations
    const plate = String(data.plate || data.placa || responseData?.termo || "PLACA")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const plateMercosul =
      data.plateMercosul ||
      data.placa_nova ||
      data.plate_mercosul ||
      (plate.length === 7 && /[A-Z]{3}[0-9][A-Z][0-9]{2}/.test(plate) ? plate : null);
    const plateOld =
      data.plateOld ||
      data.placa_antiga ||
      data.old_plate ||
      (plate.length === 7 && /[A-Z]{3}[0-9]{4}/.test(plate) ? plate : null);

    // 2. Make, Model & Version
    const brand = data.brand || data.marca || "Marca não informada";
    const model = data.model || data.modelo || "";
    const version = data.version || data.versao || "";
    const brandModel =
      data.brandModel || data.marca_modelo || `${brand} ${model}`.trim();
    const segment = data.segment || data.sub_segmento || data.segmento || "Automóvel";
    const bodyType = data.bodyType || data.carroceria || "Sedã";

    // 3. Years & Specs
    const yearFab = data.yearFab || data.year_fab || data.anoFabricacao || data.ano_fabricacao || "N/A";
    const yearModel = data.yearModel || data.year_model || data.anoModelo || data.ano_modelo || data.ano || "N/A";
    const yearFormatted = data.yearFormatted || `${yearFab} / ${yearModel}`;
    const color = data.color || data.cor || "N/A";
    const fuel = data.fuel || data.combustivel || "N/A";
    const chassis = data.chassis || data.chassi || "N/A";
    const renavam = data.renavam || "N/A";
    const engine = data.engine || data.motor || "N/A";
    const gearboxNumber = data.gearboxNumber || data.caixa_cambio || "N/A";
    const transmission = data.transmission || data.cambio || "N/A";
    const traction = data.traction || data.tracao || "N/A";
    const steering = data.steering || data.direcao || "N/A";
    const doors = data.doors || data.portas || "4";
    const capacity = data.capacity || data.capacidade || "5";
    const origin = data.origin || data.origem || "Nacional";

    // 4. Registration & Status
    const statusVehicle = data.statusVehicle || data.situacao_veiculo || data.situacao || "EM CIRCULACAO";
    const statusChassis = data.statusChassis || data.situacao_chassi || "NORMAL";
    const isRegular =
      statusVehicle.toUpperCase().includes("CIRCULACAO") ||
      statusVehicle.toUpperCase().includes("REGULAR");

    const city = data.city || data.municipio_emplacamento || data.municipio || data.cidade || "";
    const state = data.state || data.uf_placa || data.uf || data.estado || "";
    const location = [city, state].filter(Boolean).join(" / ") || "Brasil";
    const billedDoc = data.billedDoc || data.faturado_documento || null;
    const billedState = data.billedState || data.faturado_uf || data.uf_faturado || null;
    const billedType = data.billedDocType || data.tipo_doc_faturado || "PJ";

    // 5. Visual Assets & Media
    const brandLogo = data.brandLogo || data.logo_marca || null;
    const detranLogo = data.detranLogo || data.logo_detran || null;
    const stateFlagIcon = data.stateFlagIcon || data.icone_uf_s3 || data.icone_uf || null;
    const plateImage = data.plateImage || data.imagem_placa || data.logo_png || null;
    const plateOldImage = data.plateOldImage || data.imagem_placa_antiga || null;
    const vehiclePhoto =
      data.vehiclePhoto ||
      data.foto_veiculo ||
      (Array.isArray(data.fotos_modelo) && (data.fotos_modelo[0]?.url || data.fotos_modelo[0]?.src || data.fotos_modelo[0]?.imagem)) ||
      null;

    const rawPhotos = data.modelPhotos || data.fotos_modelo || [];
    const modelPhotos = Array.isArray(rawPhotos)
      ? rawPhotos
          .map((f) => (typeof f === "string" ? f : f?.url || f?.src || f?.imagem))
          .filter(Boolean)
      : [];

    // 6. FIPE Valuation & IPVA
    const fipeObj = data.fipe || {};
    const fipeValue =
      fipeObj.value ||
      fipeObj.valor ||
      (Array.isArray(data.fipe_opcoes) && data.fipe_opcoes[0]?.valor) ||
      null;
    const fipeCode =
      fipeObj.code ||
      fipeObj.codigo ||
      (Array.isArray(data.fipe_opcoes) && data.fipe_opcoes[0]?.codigo) ||
      null;
    const fipeRef = fipeObj.reference || fipeObj.tabela || null;
    const fipeHistory = fipeObj.history || data.historico_fipe || [];

    const ipvaObj = data.ipva || {};
    const venalValue = ipvaObj.venalValue || data.valor_venal || null;
    const ipvaRate = ipvaObj.rate || data.aliquota_ipva || null;
    const ipvaEstimated = ipvaObj.estimated || data.ipva_estimado || null;
    const ipvaStates = ipvaObj.states || data.ipva_estados || [];

    // 7. Full Technical Specs
    const specs = data.specs || data.fichaTecnica || {};
    const power = specs.power || data.power || "N/A";
    const torque = specs.torque || data.torque || "N/A";
    const displacement = specs.displacement || data.displacement || "N/A";
    const topSpeed = specs.topSpeed || data.velocidade_maxima || "N/A";
    const acceleration = specs.acceleration0to100 || data.aceleracao_0_100 || "N/A";
    const urbanConsumption = specs.urbanConsumption || data.consumo_urbano || "N/A";
    const highwayConsumption = specs.highwayConsumption || data.consumo_rodoviario || "N/A";
    const trunk = specs.trunkCapacity || data.porta_malas || "N/A";
    const tank = specs.fuelTank || data.tanque_combustivel || "N/A";
    const weight = specs.curbWeight || data.peso || "N/A";
    const payload = specs.payload || data.peso_bruto_total || "N/A";
    const tires = specs.tires || data.pneus || "N/A";
    const engineCode = specs.engineCode || data.codigo_motor || "N/A";
    const warranty = specs.warranty || data.garantia || "N/A";
    const dimensions = specs.dimensions || {
      length: data.comprimento,
      width: data.largura,
      height: data.altura,
      wheelbase: data.entre_eixos,
    };
    const technicalBlocks = specs.blocks || data.ficha_tecnica?.blocos || [];

    // 8. Equipment List
    const equipment = data.equipment || data.equipamentos || [];

    // 9. Owner & OSINT Link
    const owner = data.owner || data.proprietario || null;
    const ownerDetails = data.proprietario_detalhes || {};
    const ownerName =
      owner?.name ||
      ownerDetails.nome ||
      data.owner_name ||
      data.owner ||
      data.nome_proprietario ||
      null;

    const ownerDocRaw =
      owner?.document ||
      ownerDetails.cpf ||
      ownerDetails.cpf_cnpj ||
      data.cpf ||
      data.cpf_titular ||
      null;
    const ownerDocClean = ownerDocRaw ? String(ownerDocRaw).replace(/\D/g, "") : null;
    const ownerDocFormatted =
      owner?.documentFormatted ||
      (ownerDocClean?.length === 11
        ? Formatters.cpf(ownerDocClean)
        : ownerDocClean?.length === 14
          ? Formatters.cnpj(ownerDocClean)
          : ownerDocRaw);

    const ownerIncome =
      owner?.incomeFormatted ||
      (ownerDetails.renda_presumida
        ? Number(ownerDetails.renda_presumida).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : null);
    const ownerScore =
      owner?.scoreCsba || ownerDetails.score_csba || ownerDetails.score || null;
    const ownerScoreRange =
      owner?.scoreCsbaRange || ownerDetails.score_faixa || ownerDetails.faixa_risco || null;
    const ownerCnh =
      owner?.cnh?.numero ||
      ownerDetails.cnh?.numero_cnh ||
      ownerDetails.cnh?.numero ||
      null;
    const ownerMother =
      owner?.motherName || ownerDetails.mae || ownerDetails.nome_mae || data.owner_mother_name || null;
    const ownerBirthDate =
      owner?.birthDate || ownerDetails.nascimento || ownerDetails.data_nascimento || data.owner_birth_date || null;
    const ownerOccupation =
      owner?.occupation || ownerDetails.profissao || ownerDetails.ocupacao || null;
    const ownerPhones =
      owner?.phones || ownerDetails.telefones || data.owner_phones || [];
    const ownerEmails =
      owner?.emails || ownerDetails.emails || (data.owner_email ? [data.owner_email] : []);
    const otherVehicles =
      owner?.otherVehicles || ownerDetails.outros_veiculos || data.owner_vehicles || [];
    const ownerAddress =
      owner?.address || ownerDetails.endereco_principal || ownerDetails.endereco || data.address || null;

    return `
      <div class="vehicle-dossier-wrapper" style="margin-bottom: var(--space-5);">

        <!-- ============================================================== -->
        <!-- 1. HERO BANNER: PLACAS, IDENTIDADE VISUAL & AÇÕES RÁPIDAS      -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom: var(--space-4); border-top: 4px solid #3B82F6; background: radial-gradient(circle at 95% 5%, rgba(59, 130, 246, 0.12) 0%, transparent 60%), var(--color-surface);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            
            <div style="display: flex; align-items: center; gap: 18px; flex-wrap: wrap;">
              
              <!-- Placa Mercosul Estilizada ou Imagem Oficial KePlaca -->
              <div style="display: flex; flex-direction: column; gap: 6px; align-items: center;">
                ${
                  plateImage
                    ? `
                  <div style="position: relative; display: inline-block;">
                    <img src="${plateImage}" alt="Placa ${plate}" style="height: 48px; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.5); border: 1px solid #1E2538; background: #FFF;" onerror="this.style.display='none'; document.getElementById('css-plate-${plate}').style.display='block';">
                    <div id="css-plate-${plate}" style="display: none; background: #FFFFFF; border: 3px solid #000000; border-radius: 6px; padding: 2px 12px; text-align: center; color: #000000; min-width: 140px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
                      <div style="background: #003399; color: #FFFFFF; font-size: 0.65rem; font-weight: 800; letter-spacing: 1px; padding: 1px 0; border-radius: 2px; text-transform: uppercase;">BRASIL</div>
                      <div style="font-family: var(--font-mono); font-size: 1.45rem; font-weight: 900; letter-spacing: 2px; line-height: 1.2;">${plateMercosul || plate}</div>
                    </div>
                  </div>
                `
                    : `
                  <div style="background: #FFFFFF; border: 3px solid #000000; border-radius: 6px; padding: 2px 12px; text-align: center; color: #000000; min-width: 140px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
                    <div style="background: #003399; color: #FFFFFF; font-size: 0.65rem; font-weight: 800; letter-spacing: 1px; padding: 1px 0; border-radius: 2px; text-transform: uppercase;">BRASIL</div>
                    <div style="font-family: var(--font-mono); font-size: 1.45rem; font-weight: 900; letter-spacing: 2px; line-height: 1.2;">${plateMercosul || plate}</div>
                  </div>
                `
                }

                ${
                  plateOld && plateOld !== (plateMercosul || plate)
                    ? `
                  <div style="display: flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-text-muted); background: var(--color-surface-2); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--color-border);">
                    <span>Antiga:</span>
                    <strong style="color: #94A3B8;">${plateOld}</strong>
                  </div>
                `
                    : ""
                }
              </div>

              <!-- Informações de Cabeçalho do Veículo -->
              <div>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;">
                  ${
                    brandLogo
                      ? `<img src="${brandLogo}" alt="${escapeHtml(brand)}" style="height: 24px; max-width: 65px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">`
                      : ""
                  }
                  <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-weight: 700;">
                    <i data-lucide="car" style="width: 12px; height: 12px;"></i> VEÍCULO / FROTA
                  </span>
                  <span class="badge" style="background: ${isRegular ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}; color: ${isRegular ? "#10B981" : "#EF4444"}; font-weight: 700;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${isRegular ? "#10B981" : "#EF4444"}; margin-right: 5px;"></span>
                    ${escapeHtml(statusVehicle)}
                  </span>
                  <span class="badge badge-dark" style="font-size: 0.72rem;">
                    <i data-lucide="map-pin" style="width: 11px; height: 11px; margin-right: 3px;"></i> ${escapeHtml(location)}
                  </span>
                  ${
                    stateFlagIcon
                      ? `<img src="${stateFlagIcon}" alt="${state}" style="width: 20px; height: 14px; border-radius: 2px; vertical-align: middle;">`
                      : ""
                  }
                  ${
                    detranLogo
                      ? `<img src="${detranLogo}" alt="Detran" style="height: 20px; object-fit: contain; opacity: 0.85;">`
                      : ""
                  }
                </div>

                <h1 style="font-size: 1.55rem; font-weight: 800; color: var(--color-text); margin: 0; line-height: 1.25;">
                  ${escapeHtml(brandModel)}
                </h1>

                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 6px; font-size: 0.8rem; color: var(--color-text-muted);">
                  ${version ? `<span style="color: #93C5FD; font-weight: 600;">${escapeHtml(version)}</span> &bull;` : ""}
                  <span>${escapeHtml(segment)}</span> &bull;
                  <span>${escapeHtml(bodyType)}</span> &bull;
                  <span>Chassi: <strong style="color: ${statusChassis === "NORMAL" ? "#34D399" : "#F87171"};">${escapeHtml(statusChassis)}</strong></span>
                  ${billedState ? `&bull; <span>Faturado: <strong style="color: #C4B5FD;">${escapeHtml(billedType)} (${escapeHtml(billedState)})</strong></span>` : ""}
                </div>
              </div>
            </div>

            <!-- Botões de Ação Rápida -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              ${
                chassis && chassis !== "N/A"
                  ? `
                <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(chassis)}" title="Copiar Chassi Completo">
                  <i data-lucide="copy" style="width: 13px; height: 13px;"></i> Chassi
                </button>
              `
                  : ""
              }
              ${
                renavam && renavam !== "N/A"
                  ? `
                <button type="button" class="btn btn-ghost btn-sm btn-copiar-texto" data-copy="${escapeHtml(renavam)}" title="Copiar Renavam">
                  <i data-lucide="copy" style="width: 13px; height: 13px;"></i> Renavam
                </button>
              `
                  : ""
              }
              ${
                ownerDocClean
                  ? `
                <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf" data-cpf="${ownerDocClean}" title="Investigar Titular no RimuBusca">
                  <i data-lucide="user-search" style="width: 14px; height: 14px;"></i> Investigar Titular
                </button>
              `
                  : ""
              }
            </div>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- 2. GALERIA FOTOGRÁFICA & REGISTRO VISUAL DO MODELO            -->
        <!-- ============================================================== -->
        ${
          vehiclePhoto || modelPhotos.length > 0
            ? `
          <div class="card" style="margin-bottom: var(--space-4); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 0.95rem; font-weight: 800; color: #60A5FA; margin: 0; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                <i data-lucide="image" style="width: 16px; height: 16px;"></i> Registro Fotográfico do Modelo
              </h3>
              <span class="badge" style="background: rgba(59, 130, 246, 0.12); color: #93C5FD; font-size: 0.72rem;">
                Espelho Validado por Cor & Configuração
              </span>
            </div>

            <!-- Imagem Principal em Destaque -->
            <div style="position: relative; border-radius: var(--radius-md); overflow: hidden; background: #080B11; border: 1px solid var(--color-border); max-height: 380px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 30px rgba(0,0,0,0.8);">
              <img id="vehicle-main-photo-${plate}" src="${vehiclePhoto || modelPhotos[0]}" alt="${escapeHtml(brandModel)}" style="width: 100%; height: 380px; object-fit: cover; object-position: center; transition: all 0.3s ease;">
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(8,11,17,0.95), transparent); padding: 14px 18px; display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                  <div style="font-size: 0.95rem; font-weight: 800; color: #FFFFFF;">${escapeHtml(brandModel)} &bull; Cor ${escapeHtml(color)}</div>
                  <div style="font-size: 0.75rem; color: #94A3B8;">Ano ${escapeHtml(yearFormatted)} &bull; ${escapeHtml(transmission)}</div>
                </div>
                <a href="${vehiclePhoto || modelPhotos[0]}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost btn-sm" style="background: rgba(255,255,255,0.1); color: #FFF; font-size: 0.72rem;">
                  <i data-lucide="external-link" style="width: 12px; height: 12px;"></i> Abrir Imagem HD
                </a>
              </div>
            </div>

            <!-- Miniaturas Clicáveis da Galeria -->
            ${
              modelPhotos.length > 1
                ? `
              <div style="display: flex; gap: 10px; overflow-x: auto; padding: 12px 2px 4px 2px; scrollbar-width: thin;">
                ${modelPhotos
                  .map(
                    (photoUrl, idx) => `
                  <img src="${photoUrl}" alt="Foto ${idx + 1}" class="vehicle-gallery-thumb" style="width: 90px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid ${idx === 0 ? "#3B82F6" : "transparent"}; opacity: ${idx === 0 ? "1" : "0.7"}; transition: all 0.2s ease;" onclick="document.getElementById('vehicle-main-photo-${plate}').src='${photoUrl}'; document.querySelectorAll('.vehicle-gallery-thumb').forEach(el => { el.style.borderColor='transparent'; el.style.opacity='0.7'; }); this.style.borderColor='#3B82F6'; this.style.opacity='1';">
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>
        `
            : ""
        }

        <!-- ============================================================== -->
        <!-- 3. IDENTIFICAÇÃO CADASTRAL & ESPECIFICAÇÕES DO REGISTRO       -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <h3 style="font-size: 0.95rem; font-weight: 800; color: #38BDF8; margin-top: 0; margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            <i data-lucide="file-badge" style="width: 16px; height: 16px;"></i> Identificação Cadastral & Detran
          </h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
            
            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Ano Fabricação / Modelo</span>
              <div style="font-weight: 800; color: var(--color-text); font-size: 1.05rem; margin-top: 2px;">${escapeHtml(yearFormatted)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Cor Predominante</span>
              <div style="font-weight: 800; color: var(--color-text); font-size: 1.05rem; margin-top: 2px;">${escapeHtml(color)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Combustível</span>
              <div style="font-weight: 800; color: var(--color-text); font-size: 1.05rem; margin-top: 2px;">${escapeHtml(fuel)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase;">Chassi (VIN)</span>
                ${chassis && chassis !== "N/A" ? `<button type="button" class="btn btn-ghost btn-xs btn-copiar-texto" data-copy="${escapeHtml(chassis)}" style="padding: 1px 5px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
              </div>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #60A5FA; font-size: 0.95rem; margin-top: 2px; word-break: break-all;">${escapeHtml(chassis)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase;">Renavam</span>
                ${renavam && renavam !== "N/A" ? `<button type="button" class="btn btn-ghost btn-xs btn-copiar-texto" data-copy="${escapeHtml(renavam)}" style="padding: 1px 5px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
              </div>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #34D399; font-size: 1.05rem; margin-top: 2px;">${escapeHtml(renavam)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase;">Número do Motor</span>
                ${engine && engine !== "N/A" ? `<button type="button" class="btn btn-ghost btn-xs btn-copiar-texto" data-copy="${escapeHtml(engine)}" style="padding: 1px 5px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
              </div>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #F59E0B; font-size: 0.95rem; margin-top: 2px;">${escapeHtml(engine)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Transmissão / Câmbio</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(transmission)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Tração / Direção</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(traction)} &bull; ${escapeHtml(steering)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Carroceria & Lotação</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(bodyType)} &bull; ${escapeHtml(doors)}P &bull; ${escapeHtml(capacity)} Lugares</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Município de Emplacamento</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(location)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Origem & Procedência</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(origin)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Caixa de Câmbio</span>
              <div style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(gearboxNumber)}</div>
            </div>

          </div>
        </div>

        <!-- ============================================================== -->
        <!-- 4. PROPRIETÁRIO ATUAL & VÍNCULO CADASTRAL OSINT                -->
        <!-- ============================================================== -->
        ${
          ownerName
            ? `
          <div class="card" style="margin-bottom: var(--space-4); border: 1px solid rgba(139, 92, 246, 0.35); background: radial-gradient(circle at 98% 5%, rgba(139, 92, 246, 0.08) 0%, transparent 55%), var(--color-surface);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px;">
              <div>
                <span style="background: rgba(139, 92, 246, 0.15); color: #C4B5FD; font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.6px; display: inline-block; margin-bottom: 4px;">
                  Vínculo Cadastral OSINT
                </span>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; margin: 0; display: flex; align-items: center; gap: 8px;">
                  <i data-lucide="user-check" style="width: 18px; height: 18px; color: #A78BFA;"></i> Proprietário Registrado
                </h3>
              </div>

              ${
                ownerDocClean
                  ? `
                <button type="button" class="btn btn-primary btn-sm btn-puxar-cpf" data-cpf="${ownerDocClean}">
                  <i data-lucide="search" style="width: 14px; height: 14px;"></i> Investigar Dossiê do Titular
                </button>
              `
                  : ""
              }
            </div>

            <!-- Dados Pessoais do Titular -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px;">
              
              <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Nome Completo</span>
                <div style="font-weight: 800; color: #FFFFFF; font-size: 1rem; margin-top: 2px;">${escapeHtml(ownerName)}</div>
              </div>

              <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Documento (CPF)</span>
                  ${ownerDocClean ? `<button type="button" class="btn btn-ghost btn-xs btn-copiar-cpf" data-cpf="${ownerDocClean}" style="padding: 1px 5px;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>` : ""}
                </div>
                <div style="font-family: var(--font-mono); font-weight: 800; color: #6EE7B7; font-size: 1.05rem; margin-top: 2px;">${escapeHtml(ownerDocFormatted || "N/I")}</div>
              </div>

              ${
                ownerBirthDate
                  ? `
                <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Data de Nascimento</span>
                  <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${escapeHtml(ownerBirthDate)}</div>
                </div>
              `
                  : ""
              }

              ${
                ownerMother
                  ? `
                <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Nome da Mãe</span>
                  <div style="font-weight: 700; color: #F1F5F9; margin-top: 2px;">${escapeHtml(ownerMother)}</div>
                </div>
              `
                  : ""
              }

              ${
                ownerIncome
                  ? `
                <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Renda Presumida</span>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: #34D399; font-size: 1.05rem; margin-top: 2px;">${escapeHtml(ownerIncome)}</div>
                </div>
              `
                  : ""
              }

              ${
                ownerScore
                  ? `
                <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Score de Crédito (Serasa)</span>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: #60A5FA; font-size: 1.05rem; margin-top: 2px;">
                    ${escapeHtml(ownerScore)} ${ownerScoreRange ? `<span style="font-size: 0.75rem; color: #94A3B8; font-weight: normal;">(${escapeHtml(ownerScoreRange)})</span>` : ""}
                  </div>
                </div>
              `
                  : ""
              }

              ${
                ownerCnh
                  ? `
                <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Carteira de Habilitação (CNH)</span>
                  <div style="font-family: var(--font-mono); font-weight: 800; color: #F59E0B; font-size: 1rem; margin-top: 2px;">${escapeHtml(ownerCnh)}</div>
                </div>
              `
                  : ""
              }

              ${
                ownerOccupation
                  ? `
                <div style="background: #080B11; padding: 12px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                  <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase;">Ocupação / Cargo</span>
                  <div style="font-weight: 600; color: #F1F5F9; font-size: 0.85rem; margin-top: 2px;">${escapeHtml(ownerOccupation)}</div>
                </div>
              `
                  : ""
              }
            </div>

            <!-- Telefones Vinculados -->
            ${
              ownerPhones && ownerPhones.length > 0
                ? `
              <div style="margin-top: 14px; background: #080B11; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 8px;">Telefones Vinculados ao Titular</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${ownerPhones
                    .map((phone) => {
                      const cleanPhone = String(phone).replace(/\D/g, "");
                      const formattedPhone = Formatters.phone(cleanPhone);
                      return `
                      <div style="display: flex; align-items: center; gap: 4px; background: #131A29; border: 1px solid #23304A; padding: 4px 10px; border-radius: 6px;">
                        <i data-lucide="phone" style="width: 12px; height: 12px; color: #60A5FA;"></i>
                        <span style="font-family: var(--font-mono); font-size: 0.85rem; color: #F1F5F9;">${formattedPhone}</span>
                        <button type="button" class="btn btn-ghost btn-xs btn-copiar-texto" data-copy="${cleanPhone}" title="Copiar Telefone" style="padding: 1px 4px; color: #94A3B8;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>
                        <button type="button" class="btn btn-ghost btn-xs btn-puxar-operadora" data-tel="${cleanPhone}" title="Checar Operadora" style="padding: 1px 4px; color: #F59E0B;"><i data-lucide="radio" style="width: 11px; height: 11px;"></i></button>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- E-mails Vinculados -->
            ${
              ownerEmails && ownerEmails.length > 0
                ? `
              <div style="margin-top: 10px; background: #080B11; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid #1E2538;">
                <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; display: block; margin-bottom: 8px;">E-mails Cadastrais</span>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  ${ownerEmails
                    .map((email) => `
                    <div style="display: flex; align-items: center; gap: 6px; background: #131A29; border: 1px solid #23304A; padding: 4px 10px; border-radius: 6px;">
                      <i data-lucide="mail" style="width: 12px; height: 12px; color: #F472B6;"></i>
                      <span style="font-family: var(--font-mono); font-size: 0.82rem; color: #F1F5F9;">${escapeHtml(email)}</span>
                      <button type="button" class="btn btn-ghost btn-xs btn-copiar-texto" data-copy="${escapeHtml(email)}" title="Copiar E-mail" style="padding: 1px 4px; color: #94A3B8;"><i data-lucide="copy" style="width: 11px; height: 11px;"></i></button>
                    </div>
                  `)
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

            <!-- Endereço do Proprietário -->
            ${
              ownerAddress
                ? `
              <div style="margin-top: 10px; background: #080B11; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid #1E2538; display: flex; align-items: center; gap: 10px;">
                <i data-lucide="home" style="width: 18px; height: 18px; color: #A78BFA; flex-shrink: 0;"></i>
                <div style="font-size: 0.85rem; color: #E2E8F0;">
                  <strong style="color: #FFFFFF;">${escapeHtml([ownerAddress.logradouro || ownerAddress.street, ownerAddress.numero || ownerAddress.number].filter(Boolean).join(", "))}</strong>
                  ${ownerAddress.bairro || ownerAddress.neighborhood ? `&bull; ${escapeHtml(ownerAddress.bairro || ownerAddress.neighborhood)}` : ""}
                  ${ownerAddress.cidade || ownerAddress.city ? `&bull; ${escapeHtml(ownerAddress.cidade || ownerAddress.city)}/${escapeHtml(ownerAddress.uf || ownerAddress.state)}` : ""}
                  ${ownerAddress.cep || ownerAddress.zip_code ? `&bull; CEP: <span style="font-family: var(--font-mono); color: #6EE7B7;">${Formatters.cep(ownerAddress.cep || ownerAddress.zip_code)}</span>` : ""}
                </div>
              </div>
            `
                : ""
            }

            <!-- Outros Veículos do Proprietário -->
            ${
              otherVehicles && otherVehicles.length > 0
                ? `
              <div style="margin-top: 14px; border-top: 1px dashed #1E2538; padding-top: 14px;">
                <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 8px;">
                  <i data-lucide="layers" style="width: 12px; height: 12px; margin-right: 4px;"></i> Outros Veículos Registrados para este Titular (${otherVehicles.length})
                </span>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;">
                  ${otherVehicles
                    .map((v) => {
                      const vPlaca = String(v.plate || v.placa || "").toUpperCase();
                      const vModelo = v.marca_modelo || v.modelo || "Veículo";
                      const vAno = v.ano_modelo || v.ano || "";
                      const vCor = v.cor || "";
                      const isCurrent = vPlaca === plate || vPlaca === plateMercosul || vPlaca === plateOld;
                      return `
                      <div style="background: #080B11; border: 1px solid ${isCurrent ? "#3B82F6" : "#1E2538"}; padding: 10px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-family: var(--font-mono); font-weight: 800; color: #6EE7B7; font-size: 0.95rem;">${vPlaca}</span>
                            ${isCurrent ? `<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #93C5FD; font-size: 0.65rem;">Veículo Atual</span>` : ""}
                          </div>
                          <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">${escapeHtml(vModelo)} ${vCor ? `&bull; ${escapeHtml(vCor)}` : ""} ${vAno ? `&bull; ${escapeHtml(vAno)}` : ""}</div>
                        </div>
                        ${
                          !isCurrent && vPlaca
                            ? `
                          <button type="button" class="btn btn-outline btn-xs btn-puxar-placa" data-placa="${vPlaca}">
                            <i data-lucide="search" style="width: 11px; height: 11px;"></i> Puxar
                          </button>
                        `
                            : ""
                        }
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </div>
            `
                : ""
            }

          </div>
        `
            : ""
        }

        <!-- ============================================================== -->
        <!-- 5. AVALIAÇÃO DE MERCADO (FIPE) & IPVA NACIONAL (27 ESTADOS)    -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
            <h3 style="font-size: 0.95rem; font-weight: 800; color: #10B981; margin: 0; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
              <i data-lucide="dollar-sign" style="width: 16px; height: 16px;"></i> Avaliação FIPE & Estimativas de IPVA
            </h3>
            ${fipeRef ? `<span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #34D399;">Referência FIPE: ${escapeHtml(fipeRef)}</span>` : ""}
          </div>

          <!-- Destaques FIPE & IPVA Principal -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(16, 185, 129, 0.25);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Valor Tabela FIPE</span>
              <div style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: 900; color: #10B981; margin-top: 2px;">
                ${escapeHtml(fipeValue || "N/A")}
              </div>
              ${fipeCode ? `<div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">Código: ${escapeHtml(fipeCode)}</div>` : ""}
            </div>

            <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Valor Venal (Base IPVA)</span>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: var(--color-text); margin-top: 2px;">
                ${escapeHtml(venalValue || "N/A")}
              </div>
              <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">Detran de Origem</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Alíquota Estadual</span>
              <div style="font-family: var(--font-mono); font-size: 1.25rem; font-weight: 800; color: #60A5FA; margin-top: 2px;">
                ${escapeHtml(ipvaRate || "N/A")}
              </div>
              <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">Alíquota oficial de IPVA</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 14px; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.25);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">IPVA Anual Estimado</span>
              <div style="font-family: var(--font-mono); font-size: 1.35rem; font-weight: 900; color: #F59E0B; margin-top: 2px;">
                ${escapeHtml(ipvaEstimated || "N/A")}
              </div>
              <div style="font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">Cálculo Venal &times; Alíquota</div>
            </div>
          </div>

          <!-- Tabela Comparativa de IPVA em Todos os Estados -->
          ${
            ipvaStates && ipvaStates.length > 0
              ? `
            <div style="margin-top: 18px; border-top: 1px solid var(--color-border); padding-top: 16px;">
              <details style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
                <summary style="padding: 12px 16px; font-weight: 700; color: #F1F5F9; font-size: 0.88rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                  <span>
                    <i data-lucide="table" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle; color: #38BDF8;"></i>
                    Comparativo Nacional de IPVA em Todos os Estados (${ipvaStates.length} UFs)
                  </span>
                  <span style="font-size: 0.75rem; color: #94A3B8; font-weight: normal;">Clique para expandir / recolher</span>
                </summary>
                
                <div style="overflow-x: auto; max-height: 380px; padding: 4px 12px 12px 12px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
                    <thead>
                      <tr style="border-bottom: 2px solid var(--color-border); color: #94A3B8; text-transform: uppercase; font-size: 0.72rem;">
                        <th style="padding: 8px 10px;">UF</th>
                        <th style="padding: 8px 10px;">Valor Venal</th>
                        <th style="padding: 8px 10px;">Alíquota</th>
                        <th style="padding: 8px 10px;">IPVA Estimado</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ipvaStates
                        .map((st) => {
                          const isRegState = state && st.estado === state;
                          return `
                        <tr style="border-bottom: 1px solid var(--color-border); background: ${isRegState ? "rgba(59, 130, 246, 0.12)" : "transparent"};">
                          <td style="padding: 8px 10px; font-weight: 800; font-family: var(--font-mono); color: ${isRegState ? "#60A5FA" : "#F1F5F9"};">
                            ${escapeHtml(st.estado)} ${isRegState ? `<span class="badge" style="background: #3B82F6; color: #FFF; font-size: 0.65rem; padding: 1px 4px; margin-left: 4px;">Origem</span>` : ""}
                          </td>
                          <td style="padding: 8px 10px; font-family: var(--font-mono); color: #94A3B8;">${escapeHtml(st.valor_venal)}</td>
                          <td style="padding: 8px 10px; font-family: var(--font-mono); color: #38BDF8;">${escapeHtml(st.aliquota)}</td>
                          <td style="padding: 8px 10px; font-family: var(--font-mono); font-weight: 800; color: #34D399;">${escapeHtml(st.valor_ipva)}</td>
                        </tr>
                      `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          `
              : ""
          }

          <!-- Histórico FIPE Recente -->
          ${
            fipeHistory && fipeHistory.length > 0
              ? `
            <div style="margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block; margin-bottom: 8px;">
                Histórico Recente de Cotações FIPE (${fipeHistory.length} meses auditados)
              </span>
              <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin;">
                ${fipeHistory
                  .slice(0, 10)
                  .map((h) => {
                    const price = h.priceInCents
                      ? Number(h.priceInCents).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "N/A";
                    return `
                    <div style="background: var(--color-surface-2); border: 1px solid var(--color-border); padding: 6px 10px; border-radius: 6px; text-align: center; flex-shrink: 0;">
                      <div style="font-size: 0.7rem; color: var(--color-text-muted); font-family: var(--font-mono);">${h.month}/${h.year}</div>
                      <div style="font-weight: 800; font-family: var(--font-mono); color: #34D399; font-size: 0.85rem; margin-top: 2px;">${price}</div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

        </div>

        <!-- ============================================================== -->
        <!-- 6. FICHA TÉCNICA, DESEMPENHO & CONSUMO                         -->
        <!-- ============================================================== -->
        <div class="card" style="margin-bottom: var(--space-4);">
          <h3 style="font-size: 0.95rem; font-weight: 800; color: #F59E0B; margin-top: 0; margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
            <i data-lucide="gauge" style="width: 16px; height: 16px;"></i> Ficha Técnica & Indicadores de Performance
          </h3>

          <!-- Grid de Métricas de Performance -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Potência Máxima</span>
              <div style="font-weight: 800; color: #F59E0B; font-size: 1rem; margin-top: 2px;">${escapeHtml(power)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Torque Máximo</span>
              <div style="font-weight: 800; color: var(--color-text); font-size: 1rem; margin-top: 2px;">${escapeHtml(torque)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Aceleração (0 a 100 km/h)</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #38BDF8; font-size: 1.1rem; margin-top: 2px;">${escapeHtml(acceleration)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Velocidade Máxima</span>
              <div style="font-family: var(--font-mono); font-weight: 800; color: #EF4444; font-size: 1.1rem; margin-top: 2px;">${escapeHtml(topSpeed)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Consumo Urbano</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(urbanConsumption)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Consumo Rodoviário</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(highwayConsumption)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Porta-Malas</span>
              <div style="font-weight: 800; color: #6EE7B7; font-size: 1.05rem; margin-top: 2px;">${escapeHtml(trunk)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Tanque de Combustível</span>
              <div style="font-weight: 800; color: var(--color-text); font-size: 1.05rem; margin-top: 2px;">${escapeHtml(tank)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Peso em Ordem de Marcha</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(weight)} ${payload && payload !== "N/A" ? `(Carga: ${escapeHtml(payload)})` : ""}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Especificação dos Pneus</span>
              <div style="font-family: var(--font-mono); font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(tires)}</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Código & Cilindrada Motor</span>
              <div style="font-family: var(--font-mono); font-weight: 700; color: #A78BFA; margin-top: 2px;">${escapeHtml(engineCode)} (${escapeHtml(displacement)})</div>
            </div>

            <div style="background: var(--color-surface-2); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--color-border);">
              <span style="font-size: 0.72rem; color: var(--color-text-muted); text-transform: uppercase; display: block;">Garantia de Fábrica</span>
              <div style="font-weight: 700; color: var(--color-text); margin-top: 2px;">${escapeHtml(warranty)}</div>
            </div>
          </div>

          <!-- Acordeão Expansível de Blocos Técnicos Completos -->
          ${
            technicalBlocks && technicalBlocks.length > 0
              ? `
            <div style="margin-top: 18px; border-top: 1px solid var(--color-border); padding-top: 16px;">
              <details style="background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
                <summary style="padding: 12px 16px; font-weight: 700; color: #F1F5F9; font-size: 0.88rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                  <span>
                    <i data-lucide="wrench" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle; color: #F59E0B;"></i>
                    Especificações de Engenharia Detalhadas (${technicalBlocks.length} Blocos)
                  </span>
                  <span style="font-size: 0.75rem; color: #94A3B8; font-weight: normal;">Clique para expandir / recolher</span>
                </summary>

                <div style="padding: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;">
                  ${technicalBlocks
                    .map((block) => {
                      if (!block.items || block.items.length === 0) return "";
                      return `
                      <div style="background: #080B11; border: 1px solid #1E2538; padding: 12px; border-radius: 6px;">
                        <div style="font-size: 0.8rem; font-weight: 800; color: #60A5FA; text-transform: uppercase; border-bottom: 1px solid #1E2538; padding-bottom: 6px; margin-bottom: 8px;">
                          ${escapeHtml(block.key)}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem;">
                          ${block.items
                            .map((item) => `
                            <div style="display: flex; justify-content: space-between; gap: 8px;">
                              <span style="color: #94A3B8;">${escapeHtml(item.key)}</span>
                              <strong style="color: #F1F5F9; text-align: right;">${escapeHtml(item.value || "Sim")}</strong>
                            </div>
                          `)
                            .join("")}
                        </div>
                      </div>
                    `;
                    })
                    .join("")}
                </div>
              </details>
            </div>
          `
              : ""
          }

        </div>

        <!-- ============================================================== -->
        <!-- 7. EQUIPAMENTOS DE SÉRIE & OPCIONAIS (70+ ITENS)               -->
        <!-- ============================================================== -->
        ${
          equipment && equipment.length > 0
            ? `
          <div class="card" style="margin-bottom: var(--space-4);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
              <h3 style="font-size: 0.95rem; font-weight: 800; color: #C4B5FD; margin: 0; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                <i data-lucide="check-circle-2" style="width: 16px; height: 16px;"></i> Equipamentos de Série & Conforto (${equipment.length} Itens)
              </h3>
              <span class="badge" style="background: rgba(139, 92, 246, 0.12); color: #C4B5FD; font-size: 0.72rem;">
                Segurança, Conforto & Infotenimento
              </span>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 240px; overflow-y: auto; padding-right: 4px; scrollbar-width: thin;">
              ${equipment
                .map((eq) => {
                  const eqName = typeof eq === "string" ? eq : eq?.key || eq?.name || "";
                  return `
                  <span style="background: var(--color-surface-2); border: 1px solid var(--color-border); color: #E2E8F0; font-size: 0.75rem; padding: 4px 10px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
                    <i data-lucide="check" style="width: 11px; height: 11px; color: #34D399;"></i>
                    ${escapeHtml(eqName)}
                  </span>
                `;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }

      </div>
    `;
  },
};

export default VehicleInterpreter;
