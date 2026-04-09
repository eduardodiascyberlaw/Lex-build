# CLAUDE.md — Lex Build

## Identidade do projeto

Lex Build é uma plataforma web SaaS que permite a advogados portugueses gerar peças
processuais de alta qualidade usando IA (Claude API), com um pipeline de fases
sequenciais, aprovação humana entre cada fase, e uma base de conhecimento jurídico
modular que cresce com o uso.

**MVP:** ACPAD (Ação de Condenação à Prática de Ato Devido) — direito administrativo.
**Público:** Advogados com cédula profissional na Ordem dos Advogados de Portugal.
**Modelo de negócio:** SaaS por assinatura. Cada advogado usa a sua própria API key
do Claude (Anthropic). O Lex Build orquestra as chamadas.

---

## Stack

- **Frontend:** Next.js 14+ (App Router), React 18, Tailwind CSS, shadcn/ui
- **Auth:** NextAuth.js (Credentials provider — email/password)
- **ORM:** Prisma
- **Base de dados:** PostgreSQL 16
- **File storage:** MinIO (S3-compatible, self-hosted)
- **Extração de documentos:** `pdftotext` (poppler-utils), `mammoth` (.docx→text)
- **API Claude:** `@anthropic-ai/sdk`
- **Geração .docx:** Python script (`gerar_docx.py`) chamado via `child_process.execFile`
- **Deploy:** Docker Compose (Node.js + PostgreSQL + MinIO) em VPS Linux

---

## Arquitectura — 3 sistemas centrais

### 1. Pipeline de fases (esteira)

Cada peça processual é gerada em fases sequenciais. Nenhuma fase avança sem aprovação
expressa do advogado.

```
UPLOAD → FASE 0 (chat/roteamento) → FASE 1 → FASE 2 → [FASE 3] → FASE 4 → FASE 5 → DOCX
              ↓                        ↓        ↓         ↓          ↓        ↓
           Aprovação              Aprovação Aprovação Aprovação  Aprovação Aprovação
```

A Fase 0 é conversacional (chat embutido). O Claude analisa os documentos do caso,
faz perguntas, e produz o plano (`caseData`) que inclui `modules_active` — a lista
de módulos temáticos a ativar.

As Fases 1-5 são de redação. Cada uma tem um agent file específico com instruções
detalhadas. O output de cada fase é texto jurídico em PT-PT formal.

A Fase 3 é condicional — só existe se `caseData.tempestividade_ativa === true`.

Após a Fase 5 aprovada, o sistema compila um JSON e gera o .docx final.

### 2. Base de conhecimento jurídico (3 camadas)

O conhecimento jurídico é modular e editável. O Motor de Contexto monta o prompt
de cada fase carregando apenas o conhecimento necessário.

**Camada 1 — Núcleo (scope: CORE)**
Artigos genéricos que aparecem em ~90% dos casos. Carregam sempre nas fases de direito.
Ex: CPTA art. 66.º, CPA art. 163.º, CRP art. 268.º/4. Estimativa: 20-30 artigos.

**Camada 2 — Módulos temáticos (scope: MODULE)**
Cada módulo é uma unidade autónoma com 4 sub-camadas: legislação própria, doutrina,
jurisprudência, notas práticas. Carrega SÓ SE a Fase 0 ativou esse módulo.

**Camada 3 — Referências cruzadas**
Cada módulo pode "puxar" artigos específicos do núcleo, evitando duplicação.

**Propriedade:** base da plataforma (todos vêem) + notas privadas por utilizador.

### 3. Referências de estilo (few-shot learning)

O sistema acumula pares antes/depois de correções feitas pelo advogado durante a
aprovação. Esses pares entram no prompt como exemplos de few-shot para eliminar
padrões de escrita IA.

Fluxo: o advogado pode "Editar antes de aprovar" → corrige o texto → opcionalmente
marca "Guardar como referência de estilo" → o sistema captura o par automaticamente.

Até 3 referências por secção são injetadas no prompt (gold standard têm prioridade).

---

## Modelo de dados (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── AUTH & PERFIL ───

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String                // Nome completo do advogado
  cpOA          String                // Cédula profissional OA (ex: "CP 59368P OA")
  firmName      String?               // Nome do escritório
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  apiKeyEnc     String?               // API key Claude — AES-256-GCM encrypted
  model         String   @default("claude-sonnet-4-20250514")

  templates     Template[]
  pecas         Peca[]
  userNotes     UserNote[]
  styleRefs     StyleReference[]
  role          UserRole @default(USER)
}

enum UserRole {
  USER
  ADMIN
}

model Template {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String                  // "Papel timbrado principal"
  s3Key       String                  // Path no MinIO
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

// ─── PEÇAS PROCESSUAIS ───

model Peca {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])
  type          PecaType
  status        PecaStatus
  currentPhase  Int        @default(0)
  templateId    String?
  caseData      Json?                 // Output estruturado da Fase 0
  model         String                // Modelo Claude usado
  outputS3Key   String?               // .docx final gerado
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  uploads       PecaUpload[]
  phases        Phase[]
  messages      Message[]
}

enum PecaType {
  ACPAD
  CAUTELAR
}

enum PecaStatus {
  DRAFT
  PHASE_0_ACTIVE
  PHASE_0_APPROVED
  PHASE_1_ACTIVE
  PHASE_1_APPROVED
  PHASE_2_ACTIVE
  PHASE_2_APPROVED
  PHASE_3_ACTIVE
  PHASE_3_APPROVED
  PHASE_3_SKIPPED
  PHASE_4_ACTIVE
  PHASE_4_APPROVED
  PHASE_5_ACTIVE
  PHASE_5_APPROVED
  GENERATING_DOCX
  COMPLETED
  ERROR
}

model PecaUpload {
  id          String   @id @default(cuid())
  pecaId      String
  peca        Peca     @relation(fields: [pecaId], references: [id])
  filename    String
  s3Key       String
  mimeType    String
  textContent String?  @db.Text       // Texto extraído (pdftotext/mammoth)
  createdAt   DateTime @default(now())
}

model Phase {
  id              String      @id @default(cuid())
  pecaId          String
  peca            Peca        @relation(fields: [pecaId], references: [id])
  number          Int                   // 0, 1, 2, 3, 4, 5
  status          PhaseStatus
  content         String?     @db.Text  // Output final aprovado (pode ser editado)
  originalContent String?     @db.Text  // Output original do Claude (antes de edição)
  editedByUser    Boolean     @default(false)
  tokenInput      Int?
  tokenOutput     Int?
  startedAt       DateTime?
  approvedAt      DateTime?
}

enum PhaseStatus {
  PENDING
  ACTIVE
  APPROVED
  SKIPPED
  REJECTED
}

model Message {
  id        String   @id @default(cuid())
  pecaId    String
  peca      Peca     @relation(fields: [pecaId], references: [id])
  phase     Int
  role      String                    // "user" | "assistant"
  content   String   @db.Text
  createdAt DateTime @default(now())
}

// ─── BASE DE CONHECIMENTO JURÍDICO ───

model ThematicModule {
  id          String     @id @default(cuid())
  code        String     @unique       // "sis-indicacao", "horas-extras"
  name        String                   // "Indicação SIS"
  description String?    @db.Text
  pecaTypes   PecaType[]              // Em que tipos de peça pode ser ativado
  isActive    Boolean    @default(true)
  sortOrder   Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  legislation     ModuleLegislation[]
  jurisprudence   ModuleJurisprudence[]
  doctrine        ModuleDoctrine[]
  platformNotes   PlatformNote[]
  userNotes       UserNote[]
  coreRefs        ModuleCoreRef[]
}

model Legislation {
  id          String           @id @default(cuid())
  diploma     String                   // "CPA", "CPTA", "CRP", "CT"
  article     String                   // "163.º, n.º 1"
  epigraph    String?                  // "Regime de invalidade"
  content     String           @db.Text
  scope       LegislationScope         // CORE ou MODULE
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  moduleLinks ModuleLegislation[]
  coreRefs    ModuleCoreRef[]
}

enum LegislationScope {
  CORE
  MODULE
}

model ModuleLegislation {
  id             String          @id @default(cuid())
  moduleId       String
  module         ThematicModule  @relation(fields: [moduleId], references: [id])
  legislationId  String
  legislation    Legislation     @relation(fields: [legislationId], references: [id])
  relevance      String?         @db.Text

  @@unique([moduleId, legislationId])
}

model ModuleCoreRef {
  id             String          @id @default(cuid())
  moduleId       String
  module         ThematicModule  @relation(fields: [moduleId], references: [id])
  legislationId  String
  legislation    Legislation     @relation(fields: [legislationId], references: [id])
  context        String?         @db.Text

  @@unique([moduleId, legislationId])
}

model ModuleJurisprudence {
  id          String          @id @default(cuid())
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  court       String                   // "TCA Sul", "STA", "TEDH", "TJUE"
  caseNumber  String
  date        String
  summary     String          @db.Text
  keyPassage  String?         @db.Text
  tags        String[]
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model ModuleDoctrine {
  id          String          @id @default(cuid())
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  author      String
  work        String
  passage     String          @db.Text
  page        String?
  year        Int?
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model PlatformNote {
  id          String          @id @default(cuid())
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  content     String          @db.Text
  category    NoteCategory    @default(GENERAL)
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model UserNote {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  content     String          @db.Text
  category    NoteCategory    @default(GENERAL)
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

enum NoteCategory {
  GENERAL
  TRIBUNAL_SPECIFIC
  PROCEDURAL
  STRATEGIC
}

// ─── REFERÊNCIAS DE ESTILO ───

model StyleReference {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  pecaType       PecaType
  section        StyleSection
  beforeText     String       @db.Text
  afterText      String       @db.Text
  notes          String?      @db.Text
  isGoldStandard Boolean      @default(false)
  isActive       Boolean      @default(true)
  sourcePecaId   String?
  sourcePhase    Int?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

enum StyleSection {
  PRESSUPOSTOS
  FACTOS
  TEMPESTIVIDADE
  DIREITO
  PEDIDOS
}
```

---

## Estrutura de directórios

```
lexbuild/
├── CLAUDE.md                          ← Este ficheiro
├── docker-compose.yml
├── Dockerfile
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                        ← Seed dos módulos iniciais
├── knowledge/                         ← Base de conhecimento (ficheiros .md)
│   └── acpad/
│       ├── global-rules.md            ← Regras globais extraídas do SKILL.md
│       ├── anti-ai-review.md          ← Revisão anti-IA
│       ├── phase0-instructions.md     ← Instruções da Fase 0
│       ├── agents/
│       │   ├── pressupostos.md
│       │   ├── facto-acpad.md
│       │   ├── tempestividade.md
│       │   ├── direito-acpad.md
│       │   └── pedidos-acpad.md
│       ├── references/
│       │   ├── tempestividade-cpta.md
│       │   └── prova-administrativa.md
│       └── scripts/
│           └── gerar_docx.py          ← Adaptado da skill existente
├── src/
│   ├── app/                           ← Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← Landing page
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                     ← Rotas autenticadas
│   │   │   ├── layout.tsx             ← Sidebar layout
│   │   │   ├── dashboard/page.tsx     ← Cards com tipos de peça
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx           ← Perfil + API key + template
│   │   │   │   ├── notes/page.tsx     ← Notas privadas por módulo
│   │   │   │   └── style/page.tsx     ← Referências de estilo
│   │   │   ├── peca/
│   │   │   │   ├── new/[type]/page.tsx ← Nova peça (upload docs)
│   │   │   │   └── [id]/page.tsx      ← Pipeline + chat da peça
│   │   │   └── admin/                 ← Rotas admin
│   │   │       ├── modules/page.tsx
│   │   │       ├── modules/[code]/page.tsx
│   │   │       ├── legislation/page.tsx
│   │   │       └── style-references/page.tsx
│   │   └── api/                       ← API Routes
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── profile/route.ts
│   │       ├── profile/api-key/route.ts
│   │       ├── profile/template/route.ts
│   │       ├── pecas/route.ts
│   │       ├── pecas/[id]/route.ts
│   │       ├── pecas/[id]/uploads/route.ts
│   │       ├── pecas/[id]/start/route.ts
│   │       ├── pecas/[id]/chat/route.ts
│   │       ├── pecas/[id]/approve/route.ts
│   │       ├── pecas/[id]/generate/route.ts
│   │       ├── pecas/[id]/download/route.ts
│   │       ├── style-references/route.ts
│   │       ├── modules/[code]/my-notes/route.ts
│   │       └── admin/
│   │           ├── modules/route.ts
│   │           ├── modules/[code]/route.ts
│   │           ├── modules/[code]/legislation/route.ts
│   │           ├── modules/[code]/jurisprudence/route.ts
│   │           ├── modules/[code]/doctrine/route.ts
│   │           ├── modules/[code]/notes/route.ts
│   │           ├── modules/[code]/core-refs/route.ts
│   │           └── legislation/route.ts
│   ├── lib/
│   │   ├── prisma.ts                  ← Prisma client singleton
│   │   ├── auth.ts                    ← NextAuth config
│   │   ├── encryption.ts             ← AES-256-GCM para API keys
│   │   ├── s3.ts                      ← MinIO client
│   │   ├── extract.ts                ← pdftotext + mammoth wrappers
│   │   ├── context-engine.ts         ← Motor de Contexto (progressive disclosure)
│   │   ├── orchestrator.ts           ← State machine do pipeline
│   │   ├── claude-api.ts             ← Wrapper Anthropic SDK (streaming)
│   │   └── docx-generator.ts         ← Wrapper para gerar_docx.py
│   └── components/
│       ├── ui/                        ← shadcn/ui components
│       ├── dashboard/
│       │   └── peca-card.tsx
│       ├── peca/
│       │   ├── pipeline-sidebar.tsx   ← Sidebar com fases + módulos ativos
│       │   ├── phase-chat.tsx         ← Chat embutido
│       │   ├── phase-output.tsx       ← Output renderizado em markdown
│       │   ├── phase-editor.tsx       ← Editor inline (editar antes de aprovar)
│       │   ├── approval-bar.tsx       ← Botões aprovar/editar/chat
│       │   └── style-ref-toggle.tsx   ← Toggle "guardar como ref de estilo"
│       ├── admin/
│       │   ├── module-form.tsx
│       │   ├── legislation-form.tsx
│       │   ├── jurisprudence-form.tsx
│       │   └── note-form.tsx
│       └── settings/
│           ├── api-key-form.tsx
│           ├── template-upload.tsx
│           └── style-ref-list.tsx
└── public/
    └── ...
```

---

## Motor de Contexto — lógica de montagem

O Motor de Contexto (`context-engine.ts`) é o componente mais importante. Ele monta
o prompt correto para cada fase, aplicando progressive disclosure.

### Princípio: cada chamada carrega APENAS o que a fase precisa.

### Mapa de carga por fase (ACPAD)

```
FASE 0 — Análise documental e roteamento
  SYSTEM: global-rules.md + phase0-instructions.md + catálogo de módulos (só metadados)
  USER:   textos extraídos dos documentos
  NÃO:    agents, legislação, jurisprudência, refs de estilo

FASE 1 — Pressupostos (arts. 1.º-3.º)
  SYSTEM: global-rules.md + agents/pressupostos.md + anti-ai-review.md + style refs (PRESSUPOSTOS)
  USER:   documentos + caseData + "Redige a Secção I"
  NÃO:    legislação, jurisprudência, módulos

FASE 2 — Matéria de facto (arts. 4.º+)
  SYSTEM: global-rules.md + agents/facto-acpad.md + anti-ai-review.md + style refs (FACTOS)
  USER:   documentos + caseData + output Fase 1 + módulos ativos (SÓ legislação + notas)
  NÃO:    jurisprudência, doutrina (factos não citam jurisprudência)

FASE 3 — Tempestividade (condicional)
  SYSTEM: global-rules.md + agents/tempestividade.md + anti-ai-review.md + style refs (TEMPESTIVIDADE)
  USER:   documentos + caseData + outputs 1-2 + núcleo CORE (arts. prazo) + references/tempestividade-cpta.md
  NÃO:    módulos temáticos

FASE 4 — Matéria de direito (FASE MAIS PESADA)
  SYSTEM: global-rules.md + agents/direito-acpad.md + anti-ai-review.md + style refs (DIREITO)
  USER:   documentos + caseData + outputs 1-3 + núcleo CORE (tudo)
         + módulos ativos TUDO (legislação + jurisprudência + doutrina + notas + refs cruzadas)

FASE 5 — Pedidos, prova e valor
  SYSTEM: global-rules.md + agents/pedidos-acpad.md + style refs (PEDIDOS)
  USER:   documentos + caseData + outputs 1-4 + references/prova-administrativa.md
  NÃO:    módulos, legislação extra
```

### Referências de estilo no prompt

Buscar até 3 StyleReferences do utilizador para a secção da fase atual.
Gold standard primeiro, depois mais recentes. Formato no prompt:

```
## Referências de estilo — padrão a seguir

Os exemplos abaixo mostram correções aplicadas a textos anteriores.
O texto DEPOIS é o padrão correto. Redigir SEMPRE conforme o padrão DEPOIS.

### Exemplo de correção (gold standard)
Nota: Eliminei travessões e fundi frases curtas

ANTES (NÃO repetir este padrão):
[texto original do Claude]

DEPOIS (padrão correto):
[texto corrigido pelo advogado]
```

---

## Fluxo de aprovação de cada fase

Três caminhos:

**A) Aprovar direto** → content = output do Claude. Avança.

**B) Editar antes de aprovar** → abre editor inline. Advogado corrige o texto.
   Pode marcar "Guardar como referência de estilo". O sistema salva:
   - `Phase.originalContent` = output original
   - `Phase.content` = versão corrigida
   - `Phase.editedByUser` = true
   - Se toggle ativo: cria `StyleReference` com beforeText/afterText

**C) Chat** → advogado escreve instrução no chat. Claude reenvia a secção. Depois
   pode aprovar (A) ou editar (B).

---

## Geração do .docx final

Após aprovação da Fase 5, o backend:

1. Monta o JSON com o schema esperado pelo `gerar_docx.py` (ver SKILL.md § Entrega)
2. Preenche campos dinâmicos do perfil do utilizador (advogado_nome, advogado_cp)
3. Descarrega o template .docx do utilizador do MinIO para um dir temporário
4. Executa:
   ```bash
   python3 knowledge/acpad/scripts/gerar_docx.py \
     --json /tmp/lexbuild-xxx/dados.json \
     --template /tmp/lexbuild-xxx/template.docx \
     --output /tmp/lexbuild-xxx/acpad_final.docx
   ```
5. Faz upload do .docx final para o MinIO
6. Disponibiliza link de download ao utilizador

O `gerar_docx.py` preserva headers, footers e logo do template (substitui apenas o
`document.xml` do zip, mantendo tudo o resto). O template deve ser um .docx com
header/footer/logo mas corpo vazio.

---

## Segurança da API key

Encriptar com AES-256-GCM. Chave derivada de `process.env.ENCRYPTION_KEY` (32 bytes hex).
Armazenar `iv:authTag:ciphertext` no campo `apiKeyEnc`. Desencriptar apenas em memória
para cada chamada à API. Nunca logar, nunca enviar ao frontend. O frontend mostra apenas
`sk-ant-...****`.

---

## Módulos temáticos iniciais (seed ACPAD)

Criar no `prisma/seed.ts` com conteúdo extraído dos ficheiros de referência existentes:

| code | name | Legislação própria |
|---|---|---|
| `sis-indicacao` | Indicação SIS | Reg. UE 2018/1860, 2018/1861 |
| `abandono-voluntario` | Abandono voluntário / NAV | Lei 23/2007 art. 138.º e ss. |
| `erro-facto` | Erro de facto na decisão | CPA art. 153.º |
| `ilegalidade-formal` | Ilegalidade formal | CPA arts. 114.º, 115.º, 121.º, 153.º, 160.º |
| `integracao-socioprofissional` | Integração socioprofissional | Lei 23/2007 |
| `menor-portugues` | Menor nacional português | TFUE art. 20.º, Lei 23/2007 art. 134.º |
| `proporcionalidade` | Proporcionalidade / art. 8.º CEDH | CEDH art. 8.º, CPA art. 7.º, CRP art. 18.º |
| `proibicoes-absolutas` | Proibições absolutas (art. 134.º) | Lei 23/2007 art. 134.º |

---

## Ficheiros de conhecimento a copiar

Os agents e references devem ser copiados das skills existentes para a pasta
`knowledge/acpad/`. Os caminhos de origem são:

```
/mnt/skills/user/acpad-condenacao-ato-devido/SKILL.md → extrair regras globais + Fase 0
/mnt/skills/user/acpad-condenacao-ato-devido/agents/*.md → knowledge/acpad/agents/
/mnt/skills/user/acpad-condenacao-ato-devido/references/*.md → knowledge/acpad/references/
/mnt/skills/user/acpad-condenacao-ato-devido/scripts/gerar_docx.py → knowledge/acpad/scripts/
/mnt/skills/user/providencia-cautelar-administrativa/references/*.md → knowledge/acpad/shared-references/
/mnt/skills/user/providencia-cautelar-administrativa/assets/template-cautelar.docx → knowledge/acpad/assets/
```

---

## Convenções de código

- TypeScript strict mode
- Imports absolutos (`@/lib/...`, `@/components/...`)
- Server Components por defeito, "use client" apenas quando necessário
- Prisma: usar transactions para operações multi-tabela
- API routes: validação com zod
- Erros: respostas estruturadas `{ error: string, details?: any }`
- Passwords: bcrypt com 12 rounds
- Todos os textos de interface em PT-BR (o utilizador é brasileiro/português)
- Textos jurídicos gerados pela IA em PT-PT (europeu) — isto é responsabilidade
  do prompt, não do frontend

---

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://lexbuild:password@localhost:5432/lexbuild
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=... (64 hex chars = 32 bytes)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=lexbuild
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=us-east-1
```
# CLAUDE.md — Lex Build

## Identidade do projeto

Lex Build é uma plataforma web SaaS que permite a advogados portugueses gerar peças
processuais de alta qualidade usando IA (Claude API), com um pipeline de fases
sequenciais, aprovação humana entre cada fase, e uma base de conhecimento jurídico
modular que cresce com o uso.

**MVP:** ACPAD (Ação de Condenação à Prática de Ato Devido) — direito administrativo.
**Público:** Advogados com cédula profissional na Ordem dos Advogados de Portugal.
**Modelo de negócio:** SaaS por assinatura. Cada advogado usa a sua própria API key
do Claude (Anthropic). O Lex Build orquestra as chamadas.

---

## Stack

- **Frontend:** Next.js 14+ (App Router), React 18, Tailwind CSS, shadcn/ui
- **Auth:** NextAuth.js (Credentials provider — email/password)
- **ORM:** Prisma
- **Base de dados:** PostgreSQL 16
- **File storage:** MinIO (S3-compatible, self-hosted)
- **Extração de documentos:** `pdftotext` (poppler-utils), `mammoth` (.docx→text)
- **API Claude:** `@anthropic-ai/sdk`
- **Geração .docx:** Python script (`gerar_docx.py`) chamado via `child_process.execFile`
- **Deploy:** Docker Compose (Node.js + PostgreSQL + MinIO) em VPS Linux

---

## Arquitectura — 3 sistemas centrais

### 1. Pipeline de fases (esteira)

Cada peça processual é gerada em fases sequenciais. Nenhuma fase avança sem aprovação
expressa do advogado.

```
UPLOAD → FASE 0 (chat/roteamento) → FASE 1 → FASE 2 → [FASE 3] → FASE 4 → FASE 5 → DOCX
              ↓                        ↓        ↓         ↓          ↓        ↓
           Aprovação              Aprovação Aprovação Aprovação  Aprovação Aprovação
```

A Fase 0 é conversacional (chat embutido). O Claude analisa os documentos do caso,
faz perguntas, e produz o plano (`caseData`) que inclui `modules_active` — a lista
de módulos temáticos a ativar.

As Fases 1-5 são de redação. Cada uma tem um agent file específico com instruções
detalhadas. O output de cada fase é texto jurídico em PT-PT formal.

A Fase 3 é condicional — só existe se `caseData.tempestividade_ativa === true`.

Após a Fase 5 aprovada, o sistema compila um JSON e gera o .docx final.

### 2. Base de conhecimento jurídico (3 camadas)

O conhecimento jurídico é modular e editável. O Motor de Contexto monta o prompt
de cada fase carregando apenas o conhecimento necessário.

**Camada 1 — Núcleo (scope: CORE)**
Artigos genéricos que aparecem em ~90% dos casos. Carregam sempre nas fases de direito.
Ex: CPTA art. 66.º, CPA art. 163.º, CRP art. 268.º/4. Estimativa: 20-30 artigos.

**Camada 2 — Módulos temáticos (scope: MODULE)**
Cada módulo é uma unidade autónoma com 4 sub-camadas: legislação própria, doutrina,
jurisprudência, notas práticas. Carrega SÓ SE a Fase 0 ativou esse módulo.

**Camada 3 — Referências cruzadas**
Cada módulo pode "puxar" artigos específicos do núcleo, evitando duplicação.

**Propriedade:** base da plataforma (todos vêem) + notas privadas por utilizador.

### 3. Referências de estilo (few-shot learning)

O sistema acumula pares antes/depois de correções feitas pelo advogado durante a
aprovação. Esses pares entram no prompt como exemplos de few-shot para eliminar
padrões de escrita IA.

Fluxo: o advogado pode "Editar antes de aprovar" → corrige o texto → opcionalmente
marca "Guardar como referência de estilo" → o sistema captura o par automaticamente.

Até 3 referências por secção são injetadas no prompt (gold standard têm prioridade).

---

## Modelo de dados (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── AUTH & PERFIL ───

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String                // Nome completo do advogado
  cpOA          String                // Cédula profissional OA (ex: "CP 59368P OA")
  firmName      String?               // Nome do escritório
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  apiKeyEnc     String?               // API key Claude — AES-256-GCM encrypted
  model         String   @default("claude-sonnet-4-20250514")

  templates     Template[]
  pecas         Peca[]
  userNotes     UserNote[]
  styleRefs     StyleReference[]
  role          UserRole @default(USER)
}

enum UserRole {
  USER
  ADMIN
}

model Template {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String                  // "Papel timbrado principal"
  s3Key       String                  // Path no MinIO
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

// ─── PEÇAS PROCESSUAIS ───

model Peca {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])
  type          PecaType
  status        PecaStatus
  currentPhase  Int        @default(0)
  templateId    String?
  caseData      Json?                 // Output estruturado da Fase 0
  model         String                // Modelo Claude usado
  outputS3Key   String?               // .docx final gerado
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  uploads       PecaUpload[]
  phases        Phase[]
  messages      Message[]
}

enum PecaType {
  ACPAD
  CAUTELAR
}

enum PecaStatus {
  DRAFT
  PHASE_0_ACTIVE
  PHASE_0_APPROVED
  PHASE_1_ACTIVE
  PHASE_1_APPROVED
  PHASE_2_ACTIVE
  PHASE_2_APPROVED
  PHASE_3_ACTIVE
  PHASE_3_APPROVED
  PHASE_3_SKIPPED
  PHASE_4_ACTIVE
  PHASE_4_APPROVED
  PHASE_5_ACTIVE
  PHASE_5_APPROVED
  GENERATING_DOCX
  COMPLETED
  ERROR
}

model PecaUpload {
  id          String   @id @default(cuid())
  pecaId      String
  peca        Peca     @relation(fields: [pecaId], references: [id])
  filename    String
  s3Key       String
  mimeType    String
  textContent String?  @db.Text       // Texto extraído (pdftotext/mammoth)
  createdAt   DateTime @default(now())
}

model Phase {
  id              String      @id @default(cuid())
  pecaId          String
  peca            Peca        @relation(fields: [pecaId], references: [id])
  number          Int                   // 0, 1, 2, 3, 4, 5
  status          PhaseStatus
  content         String?     @db.Text  // Output final aprovado (pode ser editado)
  originalContent String?     @db.Text  // Output original do Claude (antes de edição)
  editedByUser    Boolean     @default(false)
  tokenInput      Int?
  tokenOutput     Int?
  startedAt       DateTime?
  approvedAt      DateTime?
}

enum PhaseStatus {
  PENDING
  ACTIVE
  APPROVED
  SKIPPED
  REJECTED
}

model Message {
  id        String   @id @default(cuid())
  pecaId    String
  peca      Peca     @relation(fields: [pecaId], references: [id])
  phase     Int
  role      String                    // "user" | "assistant"
  content   String   @db.Text
  createdAt DateTime @default(now())
}

// ─── BASE DE CONHECIMENTO JURÍDICO ───

model ThematicModule {
  id          String     @id @default(cuid())
  code        String     @unique       // "sis-indicacao", "horas-extras"
  name        String                   // "Indicação SIS"
  description String?    @db.Text
  pecaTypes   PecaType[]              // Em que tipos de peça pode ser ativado
  isActive    Boolean    @default(true)
  sortOrder   Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  legislation     ModuleLegislation[]
  jurisprudence   ModuleJurisprudence[]
  doctrine        ModuleDoctrine[]
  platformNotes   PlatformNote[]
  userNotes       UserNote[]
  coreRefs        ModuleCoreRef[]
}

model Legislation {
  id          String           @id @default(cuid())
  diploma     String                   // "CPA", "CPTA", "CRP", "CT"
  article     String                   // "163.º, n.º 1"
  epigraph    String?                  // "Regime de invalidade"
  content     String           @db.Text
  scope       LegislationScope         // CORE ou MODULE
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  moduleLinks ModuleLegislation[]
  coreRefs    ModuleCoreRef[]
}

enum LegislationScope {
  CORE
  MODULE
}

model ModuleLegislation {
  id             String          @id @default(cuid())
  moduleId       String
  module         ThematicModule  @relation(fields: [moduleId], references: [id])
  legislationId  String
  legislation    Legislation     @relation(fields: [legislationId], references: [id])
  relevance      String?         @db.Text

  @@unique([moduleId, legislationId])
}

model ModuleCoreRef {
  id             String          @id @default(cuid())
  moduleId       String
  module         ThematicModule  @relation(fields: [moduleId], references: [id])
  legislationId  String
  legislation    Legislation     @relation(fields: [legislationId], references: [id])
  context        String?         @db.Text

  @@unique([moduleId, legislationId])
}

model ModuleJurisprudence {
  id          String          @id @default(cuid())
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  court       String                   // "TCA Sul", "STA", "TEDH", "TJUE"
  caseNumber  String
  date        String
  summary     String          @db.Text
  keyPassage  String?         @db.Text
  tags        String[]
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model ModuleDoctrine {
  id          String          @id @default(cuid())
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  author      String
  work        String
  passage     String          @db.Text
  page        String?
  year        Int?
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model PlatformNote {
  id          String          @id @default(cuid())
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  content     String          @db.Text
  category    NoteCategory    @default(GENERAL)
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model UserNote {
  id          String          @id @default(cuid())
  userId      String
  user        User            @relation(fields: [userId], references: [id])
  moduleId    String
  module      ThematicModule  @relation(fields: [moduleId], references: [id])
  content     String          @db.Text
  category    NoteCategory    @default(GENERAL)
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

enum NoteCategory {
  GENERAL
  TRIBUNAL_SPECIFIC
  PROCEDURAL
  STRATEGIC
}

// ─── REFERÊNCIAS DE ESTILO ───

model StyleReference {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  pecaType       PecaType
  section        StyleSection
  beforeText     String       @db.Text
  afterText      String       @db.Text
  notes          String?      @db.Text
  isGoldStandard Boolean      @default(false)
  isActive       Boolean      @default(true)
  sourcePecaId   String?
  sourcePhase    Int?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

enum StyleSection {
  PRESSUPOSTOS
  FACTOS
  TEMPESTIVIDADE
  DIREITO
  PEDIDOS
}
```

---

## Estrutura de directórios

```
lexbuild/
├── CLAUDE.md                          ← Este ficheiro
├── docker-compose.yml
├── Dockerfile
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                        ← Seed dos módulos iniciais
├── knowledge/                         ← Base de conhecimento (ficheiros .md)
│   └── acpad/
│       ├── global-rules.md            ← Regras globais extraídas do SKILL.md
│       ├── anti-ai-review.md          ← Revisão anti-IA
│       ├── phase0-instructions.md     ← Instruções da Fase 0
│       ├── agents/
│       │   ├── pressupostos.md
│       │   ├── facto-acpad.md
│       │   ├── tempestividade.md
│       │   ├── direito-acpad.md
│       │   └── pedidos-acpad.md
│       ├── references/
│       │   ├── tempestividade-cpta.md
│       │   └── prova-administrativa.md
│       └── scripts/
│           └── gerar_docx.py          ← Adaptado da skill existente
├── src/
│   ├── app/                           ← Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← Landing page
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/                     ← Rotas autenticadas
│   │   │   ├── layout.tsx             ← Sidebar layout
│   │   │   ├── dashboard/page.tsx     ← Cards com tipos de peça
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx           ← Perfil + API key + template
│   │   │   │   ├── notes/page.tsx     ← Notas privadas por módulo
│   │   │   │   └── style/page.tsx     ← Referências de estilo
│   │   │   ├── peca/
│   │   │   │   ├── new/[type]/page.tsx ← Nova peça (upload docs)
│   │   │   │   └── [id]/page.tsx      ← Pipeline + chat da peça
│   │   │   └── admin/                 ← Rotas admin
│   │   │       ├── modules/page.tsx
│   │   │       ├── modules/[code]/page.tsx
│   │   │       ├── legislation/page.tsx
│   │   │       └── style-references/page.tsx
│   │   └── api/                       ← API Routes
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── profile/route.ts
│   │       ├── profile/api-key/route.ts
│   │       ├── profile/template/route.ts
│   │       ├── pecas/route.ts
│   │       ├── pecas/[id]/route.ts
│   │       ├── pecas/[id]/uploads/route.ts
│   │       ├── pecas/[id]/start/route.ts
│   │       ├── pecas/[id]/chat/route.ts
│   │       ├── pecas/[id]/approve/route.ts
│   │       ├── pecas/[id]/generate/route.ts
│   │       ├── pecas/[id]/download/route.ts
│   │       ├── style-references/route.ts
│   │       ├── modules/[code]/my-notes/route.ts
│   │       └── admin/
│   │           ├── modules/route.ts
│   │           ├── modules/[code]/route.ts
│   │           ├── modules/[code]/legislation/route.ts
│   │           ├── modules/[code]/jurisprudence/route.ts
│   │           ├── modules/[code]/doctrine/route.ts
│   │           ├── modules/[code]/notes/route.ts
│   │           ├── modules/[code]/core-refs/route.ts
│   │           └── legislation/route.ts
│   ├── lib/
│   │   ├── prisma.ts                  ← Prisma client singleton
│   │   ├── auth.ts                    ← NextAuth config
│   │   ├── encryption.ts             ← AES-256-GCM para API keys
│   │   ├── s3.ts                      ← MinIO client
│   │   ├── extract.ts                ← pdftotext + mammoth wrappers
│   │   ├── context-engine.ts         ← Motor de Contexto (progressive disclosure)
│   │   ├── orchestrator.ts           ← State machine do pipeline
│   │   ├── claude-api.ts             ← Wrapper Anthropic SDK (streaming)
│   │   └── docx-generator.ts         ← Wrapper para gerar_docx.py
│   └── components/
│       ├── ui/                        ← shadcn/ui components
│       ├── dashboard/
│       │   └── peca-card.tsx
│       ├── peca/
│       │   ├── pipeline-sidebar.tsx   ← Sidebar com fases + módulos ativos
│       │   ├── phase-chat.tsx         ← Chat embutido
│       │   ├── phase-output.tsx       ← Output renderizado em markdown
│       │   ├── phase-editor.tsx       ← Editor inline (editar antes de aprovar)
│       │   ├── approval-bar.tsx       ← Botões aprovar/editar/chat
│       │   └── style-ref-toggle.tsx   ← Toggle "guardar como ref de estilo"
│       ├── admin/
│       │   ├── module-form.tsx
│       │   ├── legislation-form.tsx
│       │   ├── jurisprudence-form.tsx
│       │   └── note-form.tsx
│       └── settings/
│           ├── api-key-form.tsx
│           ├── template-upload.tsx
│           └── style-ref-list.tsx
└── public/
    └── ...
```

---

## Motor de Contexto — lógica de montagem

O Motor de Contexto (`context-engine.ts`) é o componente mais importante. Ele monta
o prompt correto para cada fase, aplicando progressive disclosure.

### Princípio: cada chamada carrega APENAS o que a fase precisa.

### Mapa de carga por fase (ACPAD)

```
FASE 0 — Análise documental e roteamento
  SYSTEM: global-rules.md + phase0-instructions.md + catálogo de módulos (só metadados)
  USER:   textos extraídos dos documentos
  NÃO:    agents, legislação, jurisprudência, refs de estilo

FASE 1 — Pressupostos (arts. 1.º-3.º)
  SYSTEM: global-rules.md + agents/pressupostos.md + anti-ai-review.md + style refs (PRESSUPOSTOS)
  USER:   documentos + caseData + "Redige a Secção I"
  NÃO:    legislação, jurisprudência, módulos

FASE 2 — Matéria de facto (arts. 4.º+)
  SYSTEM: global-rules.md + agents/facto-acpad.md + anti-ai-review.md + style refs (FACTOS)
  USER:   documentos + caseData + output Fase 1 + módulos ativos (SÓ legislação + notas)
  NÃO:    jurisprudência, doutrina (factos não citam jurisprudência)

FASE 3 — Tempestividade (condicional)
  SYSTEM: global-rules.md + agents/tempestividade.md + anti-ai-review.md + style refs (TEMPESTIVIDADE)
  USER:   documentos + caseData + outputs 1-2 + núcleo CORE (arts. prazo) + references/tempestividade-cpta.md
  NÃO:    módulos temáticos

FASE 4 — Matéria de direito (FASE MAIS PESADA)
  SYSTEM: global-rules.md + agents/direito-acpad.md + anti-ai-review.md + style refs (DIREITO)
  USER:   documentos + caseData + outputs 1-3 + núcleo CORE (tudo)
         + módulos ativos TUDO (legislação + jurisprudência + doutrina + notas + refs cruzadas)

FASE 5 — Pedidos, prova e valor
  SYSTEM: global-rules.md + agents/pedidos-acpad.md + style refs (PEDIDOS)
  USER:   documentos + caseData + outputs 1-4 + references/prova-administrativa.md
  NÃO:    módulos, legislação extra
```

### Referências de estilo no prompt

Buscar até 3 StyleReferences do utilizador para a secção da fase atual.
Gold standard primeiro, depois mais recentes. Formato no prompt:

```
## Referências de estilo — padrão a seguir

Os exemplos abaixo mostram correções aplicadas a textos anteriores.
O texto DEPOIS é o padrão correto. Redigir SEMPRE conforme o padrão DEPOIS.

### Exemplo de correção (gold standard)
Nota: Eliminei travessões e fundi frases curtas

ANTES (NÃO repetir este padrão):
[texto original do Claude]

DEPOIS (padrão correto):
[texto corrigido pelo advogado]
```

---

## Fluxo de aprovação de cada fase

Três caminhos:

**A) Aprovar direto** → content = output do Claude. Avança.

**B) Editar antes de aprovar** → abre editor inline. Advogado corrige o texto.
   Pode marcar "Guardar como referência de estilo". O sistema salva:
   - `Phase.originalContent` = output original
   - `Phase.content` = versão corrigida
   - `Phase.editedByUser` = true
   - Se toggle ativo: cria `StyleReference` com beforeText/afterText

**C) Chat** → advogado escreve instrução no chat. Claude reenvia a secção. Depois
   pode aprovar (A) ou editar (B).

---

## Geração do .docx final

Após aprovação da Fase 5, o backend:

1. Monta o JSON com o schema esperado pelo `gerar_docx.py` (ver SKILL.md § Entrega)
2. Preenche campos dinâmicos do perfil do utilizador (advogado_nome, advogado_cp)
3. Descarrega o template .docx do utilizador do MinIO para um dir temporário
4. Executa:
   ```bash
   python3 knowledge/acpad/scripts/gerar_docx.py \
     --json /tmp/lexbuild-xxx/dados.json \
     --template /tmp/lexbuild-xxx/template.docx \
     --output /tmp/lexbuild-xxx/acpad_final.docx
   ```
5. Faz upload do .docx final para o MinIO
6. Disponibiliza link de download ao utilizador

O `gerar_docx.py` preserva headers, footers e logo do template (substitui apenas o
`document.xml` do zip, mantendo tudo o resto). O template deve ser um .docx com
header/footer/logo mas corpo vazio.

---

## Segurança da API key

Encriptar com AES-256-GCM. Chave derivada de `process.env.ENCRYPTION_KEY` (32 bytes hex).
Armazenar `iv:authTag:ciphertext` no campo `apiKeyEnc`. Desencriptar apenas em memória
para cada chamada à API. Nunca logar, nunca enviar ao frontend. O frontend mostra apenas
`sk-ant-...****`.

---

## Módulos temáticos iniciais (seed ACPAD)

Criar no `prisma/seed.ts` com conteúdo extraído dos ficheiros de referência existentes:

| code | name | Legislação própria |
|---|---|---|
| `sis-indicacao` | Indicação SIS | Reg. UE 2018/1860, 2018/1861 |
| `abandono-voluntario` | Abandono voluntário / NAV | Lei 23/2007 art. 138.º e ss. |
| `erro-facto` | Erro de facto na decisão | CPA art. 153.º |
| `ilegalidade-formal` | Ilegalidade formal | CPA arts. 114.º, 115.º, 121.º, 153.º, 160.º |
| `integracao-socioprofissional` | Integração socioprofissional | Lei 23/2007 |
| `menor-portugues` | Menor nacional português | TFUE art. 20.º, Lei 23/2007 art. 134.º |
| `proporcionalidade` | Proporcionalidade / art. 8.º CEDH | CEDH art. 8.º, CPA art. 7.º, CRP art. 18.º |
| `proibicoes-absolutas` | Proibições absolutas (art. 134.º) | Lei 23/2007 art. 134.º |

---

## Ficheiros de conhecimento a copiar

Os agents e references devem ser copiados das skills existentes para a pasta
`knowledge/acpad/`. Os caminhos de origem são:

```
/mnt/skills/user/acpad-condenacao-ato-devido/SKILL.md → extrair regras globais + Fase 0
/mnt/skills/user/acpad-condenacao-ato-devido/agents/*.md → knowledge/acpad/agents/
/mnt/skills/user/acpad-condenacao-ato-devido/references/*.md → knowledge/acpad/references/
/mnt/skills/user/acpad-condenacao-ato-devido/scripts/gerar_docx.py → knowledge/acpad/scripts/
/mnt/skills/user/providencia-cautelar-administrativa/references/*.md → knowledge/acpad/shared-references/
/mnt/skills/user/providencia-cautelar-administrativa/assets/template-cautelar.docx → knowledge/acpad/assets/
```

---

## Convenções de código

- TypeScript strict mode
- Imports absolutos (`@/lib/...`, `@/components/...`)
- Server Components por defeito, "use client" apenas quando necessário
- Prisma: usar transactions para operações multi-tabela
- API routes: validação com zod
- Erros: respostas estruturadas `{ error: string, details?: any }`
- Passwords: bcrypt com 12 rounds
- Todos os textos de interface em PT-BR (o utilizador é brasileiro/português)
- Textos jurídicos gerados pela IA em PT-PT (europeu) — isto é responsabilidade
  do prompt, não do frontend

---

## Variáveis de ambiente

```env
DATABASE_URL=postgresql://lexbuild:password@localhost:5432/lexbuild
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=... (64 hex chars = 32 bytes)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=lexbuild
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=us-east-1
```
