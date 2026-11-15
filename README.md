# 🌐 RimuBusca — Intelligence Engine & Forensic OSINT

<p align="center">
  <img src="https://img.shields.io/badge/Platform-RimuBusca%20OSINT-7C3AED?style=for-the-badge&logo=shield&logoColor=white" alt="RimuBusca Platform">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Module-ESM%20Pure-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="ESM Pure">
  <img src="https://img.shields.io/badge/Database-Supabase%20%7C%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Security-RBAC%20%2B%20RLS%20%2B%20SHA--256-EF4444?style=for-the-badge&logo=auth0&logoColor=white" alt="Security">
</p>

---

## 🎯 Sobre o Projeto

O **RimuBusca** é uma plataforma interna, corporativa e de alta performance voltada para **Inteligência em Fontes Abertas (OSINT)**, investigação forense digital e análise de pegada na internet (*Digital Footprinting*). 

Projetada com arquitetura **100% nativa em Node.js ESM** (zero dependências de Python ou compiladores intermediários), a solução consolida motores de inteligência modernos que investigam presenças digitais em centenas de serviços em milissegundos, gerando dossiês estruturados com integridade criptográfica.

---

## 🚀 Motores Proprietários e Especializados de OSINT

O núcleo de inteligência do RimuBusca utiliza três motores especializados em JavaScript puro:

```
                  ┌────────────────────────────────────────┐
                  │       RimuBusca Core Controller        │
                  └───────────────────┬────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
  ☕ PatrickUser               ⚡ Diablinda                 🦅 rimuhunt
  Username & Handles           Email Reconnaissance         Google Ecosystem
  80+ Plataformas              55+ Serviços Passivos        Gaia ID, Maps & GeoJSON
  (Sherlock Successor)         (Holehe Successor)           (GHunt Successor)
```

### ☕ 1. `patrickuser` — The Mentalist OSINT Username Hunter
> *"Sherlock procurava pegadas físicas. Patrick Jane lê o que as pessoas deixam à vista de todos."*

* **Sucessor moderno do Sherlock e WhatsMyName** em 100% JavaScript Nativo (Node.js ESM).
* **Varredura concorrente em 80+ plataformas**: Redes sociais (Twitter/X, Instagram, TikTok, Reddit), hubs de desenvolvedores (GitHub, GitLab, HackerOne), comunidades técnicas (Dev.to, Medium) e plataformas gamer (Steam, Twitch, Chess.com).
* **Extração de metadados ricos**: Ao invés de checar apenas status HTTP `200/404`, extrai nome real, biografia completa, contagem de seguidores, avatar original em alta definição e ofensivas/streaks.
* **Permutador heurístico de handles**: Gera e analisa combinações inteligentes de nomes (variações fonéticas, prefixos profissionais e inversões de sobrenomes).

### ⚡ 2. `diablinda` — Email OSINT Reconnaissance Engine
* **Sucessor turbinado do Holehe** em JavaScript puro, sem subprocessos ou ambientes virtuais Python.
* **Reconhecimento passivo em 55+ plataformas**: Verifica presença em serviços como Spotify, Twitter, GitHub, Gravatar, Duolingo, Jusbrasil, Apoia.se, Vakinha, entre outros.
* **Técnicas 100% seguras**: Não envia emails, não solicita redefinição de senhas nem notifica o alvo investigado.
* **Vetorização visual oficial**: Entrega logos SVG limpos e cores de marca oficiais para renderização imediata na interface.

### 🦅 3. `rimuhunt` — Google Deep Footprint & Workspace Intelligence
* **Sucessor do GHunt em Node.js ESM** com tempo de inicialização inferior a 25ms.
* **Resolução de Gaia ID**: Identificador numérico interno único de 64 bits de contas Google.
* **Avatar original sem compressão (`=s0`)**: Extrai a foto de alta resolução sem corte ou miniatura comprimida.
* **Google Maps & Local Guides**: Mapeia contribuições públicas com histórico de avaliações e **exportação em GeoJSON padrão (RFC 7946)**, pronto para visualização em QGIS, Leaflet e Keplr.gl.
* **Verificação de Calendário & YouTube**: Identifica fusos horários configurados, eventos públicos e canais associados.

---

## 🧩 Módulos Analíticos da Plataforma

Além dos motores de identidade, o RimuBusca disponibiliza uma suíte forense unificada:

| Módulo | Descrição Técnica |
| :--- | :--- |
| **🕸️ Grafo de Vínculos (Link Analysis)** | Mapeamento topológico interativo com física de nós via Vis.js. Correlaciona contatos, endereços, empresas, parentescos e identificadores, permitindo filtragem por categoria e exportação em PNG de alta resolução. |
| **⚖️ Processos Judiciais** | Consulta unificada e rastreamento de litígios no **DataJud CNJ** (cobrindo 91 tribunais estaduais, federais, trabalhistas e militares) e Diários Oficiais via BuscaProcessos API. |
| **📞 Telecom & Telefonia OSINT** | Identificação da operadora original, portabilidade numérica em tempo real, DDD/região Anatel e formatação internacional (E.164). |
| **🌐 Domínio, DNS & Infraestrutura** | Consulta WHOIS, extração de registros DNS (A, AAAA, MX, TXT, NS, CNAME), diagnóstico de autenticação de emails (SPF, DKIM, DMARC) e subdomínios. |
| **⛓️ Blockchain & Bitcoin OSINT** | Inspeção de endereços na mempool pública, contagem de transações, saldo em tempo real, saídas não gastas (UTXO) e menções indexadas. |
| **🏛️ Transparência Pública & Servidores** | Cruzamento com dados abertos governamentais (Portal da Transparência / SIAPE, CEIS, CNEP, CEPIM e PEP). |

---

## 🔒 Forense, Auditoria & Cadeia de Custódia

1. **Hash Criptográfico SHA-256**: Cada dossiê ou relatório gerado recebe um hash de integridade imutável baseado em seu conteúdo canônico e carimbo de tempo (ISO-8601), assegurando que o laudo não foi adulterado após a emissão.
2. **Smart Flags & Detecção de Anomalias**: O motor analisa correlações e dispara alertas automáticos em caso de registros contraditórios, históricos inconsistentes ou indicadores de risco.
3. **Auditoria Imutável em Banco**: Toda consulta, alteração ou exportação é registrada na tabela `auditoria_logs` com endereço IP real, User-Agent, carimbo de data/hora e identificador do operador responsável.
4. **Exportação Profissional**: Relatórios estruturados prontos para impressão ou arquivo em formato **PDF** e **HTML** independente em padrão Dark Mode corporativo.

---

## 🏛️ Arquitetura & Stack Tecnológica

* **Runtime:** Node.js 18+ LTS (`"type": "module"`)
* **Framework Web:** Express 4.x com middlewares de proteção (`helmet`, `cors`, `cookie-parser`, `express-rate-limit`)
* **Interface & Templates:** EJS (Embedded JavaScript) com arquitetura Dark Theme responsiva e ícones Lucide
* **Autenticação & Banco de Dados:** [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security - RLS, Auth)
* **Validação de Dados:** Zod Schema Validation
* **Criptografia:** AES-256-GCM / pgcrypto para segredos em repouso e HMAC SHA-256 para sessões

```
rimubuscas/
├── api/                  # Handlers de inicialização de API
├── public/               # Assets estáticos (CSS customizado, JS cliente, ícones)
├── scripts/              # Utilitários administrativos (criar admin, seeders)
├── src/
│   ├── config/           # Configuração de clientes (Supabase, bancos)
│   ├── controllers/      # Controladores divididos por domínio (OSINT, Admin, Core)
│   ├── middlewares/      # Autenticação, RBAC, auditoria e tratamento de erros
│   ├── routes/           # Mapeamento de rotas e APIs REST
│   └── services/         # Motores de negócio (redes, email, compliance, auditoria)
├── views/                # Templates EJS (Painéis, Dossiês, Módulos, Autenticação)
├── .env.example          # Modelo de configuração de variáveis
└── package.json          # Metadados e dependências do projeto
```

---

## ⚙️ Instalação & Inicialização

### Pré-requisitos
* **Node.js** >= 18.0.0
* **NPM** >= 9.0.0
* Projeto ativo no **Supabase** (URL e chaves Service Role / Anon)

### 1. Clonar o repositório
```bash
git clone https://github.com/seu-usuario/rimubuscas.git
cd rimubuscas
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as variáveis de ambiente
Copie o modelo de ambiente e preencha suas configurações:
```bash
cp .env.example .env
```

Abra o arquivo `.env` e configure:
* `SESSION_SECRET`: Chave secreta de no mínimo 32 caracteres (`openssl rand -hex 32`).
* `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: Credenciais do projeto Supabase.
* Chaves opcionais de adapters externos caso deseje integrar serviços em tempo real.

### 4. Criar o primeiro Operador Administrador
Execute o script interativo de provisionamento seguro:
```bash
npm run create-admin
```
Siga as instruções no terminal para definir o nome, e-mail e senha de acesso.

### 5. Iniciar a plataforma
Para ambiente de desenvolvimento (com auto-reload via Nodemon):
```bash
npm run start:dev
```

Para ambiente de execução direta:
```bash
npm run start:start
```

Acesse no navegador:
👉 `http://localhost:3000`

---

## 👥 Controle de Acesso & Perfis (RBAC)

A plataforma conta com separação estrita de privilégios:

* **Administrador (`admin`)**: Acesso irrestrito a todos os módulos analíticos, métricas do sistema, gestão de operadores, concessão de limites de uso e trilhas de auditoria completa.
* **Operador Analista (`user`)**: Acesso restrito aos módulos analíticos autorizados, com quota diária de operações, isolamento de histórico próprio e registro obrigatório de atividades.

---

## ⚖️ Aviso Legal, Ética e Conformidade

> **IMPORTANTE**: O RimuBusca foi concebido estritamente para fins de investigação legítima, inteligência de segurança cibernética, resposta a incidentes, proteção de ativos corporativos e auditorias autorizadas de superfície pública (*self-OSINT*).
> 
> Todas as coletas executadas pelos módulos passivos utilizam exclusivamente **fontes de dados publicamente disponíveis** na internet. O uso desta ferramenta deve obedecer rigorosamente à legislação aplicável, incluindo a **Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)** e o **Art. 154-A do Código Penal Brasileiro**. A responsabilidade legal pela utilização dos dados e pelas consultas efetuadas é exclusiva do operador autenticado.

---

<p align="center">
  <b>RimuBusca Intelligence Engine</b> • Plataforma Interna de Inteligência Forense
</p>
