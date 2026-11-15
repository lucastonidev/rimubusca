/**
 * ==============================================================================
 * BACKEND INTERPRETER - HEXYS VEHICLE (VEHICLE.INTERPRETER.JS)
 * Comprehensive normalizer for vehicle queries (placa, chassi, renavam, proprietario).
 * Extracts vehicle identities, visuals, owner OSINT link, FIPE valuation,
 * complete technical specifications, full national IPVA table, and equipment.
 * Clean Code standards with English identifiers and bilingual aliases.
 * ==============================================================================
 */

export function interpretHexysVehicle(rawData) {
  if (!rawData || typeof rawData !== "object") return rawData;

  const data = { ...rawData };

  // 1. Identification & Plates
  const plate = String(data.plate || data.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const plateMercosul =
    data.placa_nova ||
    data.plate_mercosul ||
    (plate.length === 7 && /[A-Z]{3}[0-9][A-Z][0-9]{2}/.test(plate) ? plate : null);
  const plateOld =
    data.placa_antiga ||
    data.old_plate ||
    (plate.length === 7 && /[A-Z]{3}[0-9]{4}/.test(plate) ? plate : null);

  // 2. Make, Model & Version
  const brand = data.brand || data.marca || "Não informada";
  const model = data.model || data.modelo || "";
  const version = data.versao || data.version || "";
  const modelGroup = data.grupo_modelo || "";
  const segment = data.segmento || data.sub_segmento || "";
  const brandModel = data.marca_modelo || data.brand_model || `${brand} ${model}`.trim();

  // 3. Fabrication & Model Years
  const yearFab = data.year_fab || data.anoFabricacao || data.ano_fabricacao || null;
  const yearModel = data.year_model || data.anoModelo || data.ano_modelo || data.ano || null;
  const yearFormatted =
    yearFab && yearModel ? `${yearFab} / ${yearModel}` : (yearModel || yearFab || "N/A");

  // 4. Critical Technical Identifiers
  const chassis = data.chassis || data.chassi || null;
  const renavam = data.renavam || null;
  const engine = data.engine || data.motor || null;
  const gearboxNumber = data.caixa_cambio || null;

  // 5. Basic Specifications
  const color = data.color || data.cor || "N/A";
  const fuel = data.fuel || data.combustivel || "N/A";
  const bodyType = data.carroceria || data.body_type || null;
  const transmission = data.cambio || data.transmission || null;
  const traction = data.tracao || data.traction || null;
  const steering = data.direcao || data.steering || null;
  const category = data.category || data.categoria || null;
  const type = data.type || data.tipo || null;
  const species = data.species || data.especie || null;
  const doors = data.portas || null;
  const capacity = data.capacidade || data.lotacao || null;
  const origin = data.origem || null;

  // 6. Registration Status & Municipality
  const statusVehicle = data.situacao_veiculo || data.situacao || "EM CIRCULACAO";
  const statusChassis = data.situacao_chassi || "NORMAL";
  const city = data.municipio_emplacamento || data.city || data.municipio || data.cidade || null;
  const state = data.uf_placa || data.state || data.uf || data.estado || null;
  const location = [city, state].filter(Boolean).join(" / ");
  const lastUpdate = data.ultima_atualizacao || null;

  // 7. Invoicing (Faturamento)
  const billedDocType = data.tipo_doc_faturado || null;
  const billedDoc = data.faturado_documento || null;
  const billedState = data.faturado_uf || data.uf_faturado || null;

  // 8. Visual Assets & Media
  const brandLogo = data.logo_marca || null;
  const detranLogo = data.logo_detran || null;
  const stateFlagIcon = data.icone_uf_s3 || data.icone_uf || null;
  const plateImage = data.imagem_placa || data.logo_png || null;
  const plateOldImage = data.imagem_placa_antiga || null;
  const vehiclePhoto =
    data.foto_veiculo ||
    (Array.isArray(data.fotos_modelo) && data.fotos_modelo[0]?.url) ||
    null;
  const modelPhotos = Array.isArray(data.fotos_modelo)
    ? data.fotos_modelo
        .map((f) => (typeof f === "string" ? f : f?.url || f?.src || f?.imagem))
        .filter(Boolean)
    : [];

  // 9. Valuation (FIPE) & Taxes (IPVA)
  const fipeObj = data.fipe || {};
  const fipeValue = fipeObj.valor || (data.fipe_opcoes && data.fipe_opcoes[0]?.valor) || null;
  const fipeCode = fipeObj.codigo || (data.fipe_opcoes && data.fipe_opcoes[0]?.codigo) || null;
  const fipeReference = fipeObj.tabela || null;
  const venalValue = data.valor_venal || null;
  const ipvaRate = data.aliquota_ipva || null;
  const ipvaEstimated = data.ipva_estimado || null;
  const ipvaStates = Array.isArray(data.ipva_estados) ? data.ipva_estados : [];
  const fipeHistory = Array.isArray(data.historico_fipe) ? data.historico_fipe : [];

  // 10. Performance & Full Technical Specs
  const technicalBlocks = Array.isArray(data.ficha_tecnica?.blocos)
    ? data.ficha_tecnica.blocos
    : [];

  const specs = {
    power: data.power || "N/A",
    displacement: data.displacement || "N/A",
    torque: data.torque || "N/A",
    topSpeed: data.velocidade_maxima || "N/A",
    acceleration0to100: data.aceleracao_0_100 || "N/A",
    urbanConsumption: data.consumo_urbano || "N/A",
    highwayConsumption: data.consumo_rodoviario || "N/A",
    trunkCapacity: data.porta_malas || "N/A",
    fuelTank: data.tanque_combustivel || "N/A",
    curbWeight: data.peso || "N/A",
    payload: data.peso_bruto_total || null,
    dimensions: {
      length: data.comprimento || null,
      width: data.largura || null,
      height: data.altura || null,
      wheelbase: data.entre_eixos || null,
    },
    tires: data.pneus || null,
    engineCode: data.codigo_motor || null,
    warranty: data.garantia || null,
    blocks: technicalBlocks,
  };

  // 11. Equipment
  const equipment = Array.isArray(data.equipamentos) ? data.equipamentos : [];

  // 12. Owner & OSINT Link
  const ownerDetails = data.proprietario_detalhes || {};
  const ownerName =
    ownerDetails.nome || data.owner || data.nome_proprietario || null;
  const ownerDoc =
    ownerDetails.cpf ||
    ownerDetails.cpf_cnpj ||
    ownerDetails.documento ||
    data.cpf ||
    data.cpf_titular ||
    null;
  const ownerDocClean = ownerDoc ? String(ownerDoc).replace(/\D/g, "") : null;

  const ownerDocFormatted =
    ownerDocClean && ownerDocClean.length === 11
      ? ownerDocClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
      : ownerDocClean && ownerDocClean.length === 14
        ? ownerDocClean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
        : ownerDocClean;

  const ownerIncome =
    ownerDetails.renda_presumida || ownerDetails.renda || data.owner_income || null;
  const ownerIncomeFormatted = ownerIncome
    ? Number(ownerIncome).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

  const ownerPhones = Array.isArray(ownerDetails.telefones)
    ? ownerDetails.telefones
    : Array.isArray(data.owner_phones)
      ? data.owner_phones
      : [];
  const ownerEmails = Array.isArray(ownerDetails.emails)
    ? ownerDetails.emails
    : data.owner_email
      ? [data.owner_email]
      : [];
  const otherVehicles = Array.isArray(ownerDetails.outros_veiculos)
    ? ownerDetails.outros_veiculos
    : Array.isArray(data.owner_vehicles)
      ? data.owner_vehicles
      : [];
  const ownerHistory = Array.isArray(data.proprietarios_historico?.list)
    ? data.proprietarios_historico.list
    : Array.isArray(ownerDetails.historico)
      ? ownerDetails.historico
      : [];

  const owner = ownerName
    ? {
        name: ownerName,
        document: ownerDocClean,
        documentFormatted: ownerDocFormatted,
        documentType:
          ownerDetails.tipo ||
          data.tipo_documento ||
          (ownerDocClean?.length === 11 ? "CPF" : "CNPJ"),
        birthDate:
          ownerDetails.nascimento ||
          ownerDetails.data_nascimento ||
          data.owner_birth_date ||
          null,
        motherName:
          ownerDetails.mae ||
          ownerDetails.nome_mae ||
          data.owner_mother_name ||
          null,
        gender: ownerDetails.sexo || null,
        voterId: ownerDetails.titulo_eleitor || null,
        pis: ownerDetails.pis || null,
        occupation: ownerDetails.profissao || ownerDetails.ocupacao || null,
        income: ownerIncome,
        incomeFormatted: ownerIncomeFormatted,
        purchasingPower: ownerDetails.poder_aquisitivo || null,
        cnh: ownerDetails.cnh || null,
        scoreCsba: ownerDetails.score_csba || ownerDetails.score || null,
        scoreCsbaRange: ownerDetails.score_faixa || ownerDetails.faixa_risco || null,
        scoreCsb8: ownerDetails.score_csb8 || null,
        revenueStatus: ownerDetails.situacao_receita || "REGULAR",
        isDeceased: ownerDetails.obito === true,
        phones: ownerPhones,
        emails: ownerEmails,
        address:
          ownerDetails.endereco_principal ||
          ownerDetails.endereco ||
          data.address ||
          null,
        addressHistory: Array.isArray(ownerDetails.enderecos)
          ? ownerDetails.enderecos
          : [],
        otherVehicles,
        history: ownerHistory,
      }
    : null;

  return {
    ...data,
    plate,
    placa: plate,
    plateMercosul,
    placaMercosul: plateMercosul,
    plateOld,
    placaAntiga: plateOld,
    brand,
    marca: brand,
    model,
    modelo: model,
    version,
    versao: version,
    modelGroup,
    segment,
    brandModel,
    marcaModelo: brandModel,
    yearFormatted,
    anoFormatado: yearFormatted,
    yearFab,
    anoFabricacao: yearFab,
    yearModel,
    anoModelo: yearModel,
    color,
    cor: color,
    fuel,
    combustivel: fuel,
    chassis,
    chassi: chassis,
    renavam,
    engine,
    motor: engine,
    gearboxNumber,
    bodyType,
    carroceria: bodyType,
    transmission,
    cambio: transmission,
    traction,
    tracao: traction,
    steering,
    direcao: steering,
    category,
    type,
    species,
    doors,
    capacity,
    origin,
    statusVehicle,
    situacaoVeiculo: statusVehicle,
    statusChassis,
    situacaoChassi: statusChassis,
    city,
    municipio: city,
    state,
    uf: state,
    location,
    localizacao: location,
    lastUpdate,
    billedDocType,
    billedDoc,
    billedState,
    brandLogo,
    detranLogo,
    stateFlagIcon,
    plateImage,
    plateOldImage,
    vehiclePhoto,
    modelPhotos,
    fipe: {
      value: fipeValue,
      code: fipeCode,
      reference: fipeReference,
      history: fipeHistory,
      raw: fipeObj,
    },
    ipva: {
      venalValue,
      rate: ipvaRate,
      estimated: ipvaEstimated,
      states: ipvaStates,
    },
    specs,
    fichaTecnica: specs,
    equipment,
    equipamentos: equipment,
    owner,
    proprietario: owner,
    proprietario_detalhes: ownerDetails,
  };
}

export default interpretHexysVehicle;
