# Arquitectura — Lex Build

## Pipeline de fases (esteira)

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

Fases condicionais por tipo de peça:

- **ACPAD:** Fase 3 só existe se `caseData.tempestividade_ativa === true`
- **CAUTELAR:** Skip fases 1 e 3 (não tem pressupostos nem tempestividade)
- **EXECUCAO:** Skip só fase 3 (sem tempestividade)

Após a Fase 5 aprovada, o sistema compila um JSON e gera o .docx final.

## Base de conhecimento jurídico (3 camadas)

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

## Referências de estilo (few-shot learning)

O sistema acumula pares antes/depois de correções feitas pelo advogado durante a
aprovação. Esses pares entram no prompt como exemplos de few-shot para eliminar
padrões de escrita IA.

Fluxo: o advogado pode "Editar antes de aprovar" → corrige o texto → opcionalmente
marca "Guardar como referência de estilo" → o sistema captura o par automaticamente.

Até 3 referências por secção são injetadas no prompt (gold standard têm prioridade).

## Estrutura de directórios

```
lexbuild/
├── CLAUDE.md                          ← Resumo alto nível
├── .claude/                           ← Metadados de desenvolvimento
│   ├── settings.json
│   ├── commands/
│   ├── rules/
│   └── agents/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                        ← Seed dos módulos iniciais
├── knowledge/                         ← Base de conhecimento (NÃO são subagentes Claude Code)
│   ├── acpad/                         ← ACPAD — Ação de Condenação à Prática de Ato Devido
│   ├── cautelar/                      ← Providência Cautelar Administrativa
│   └── execucao/                      ← Execução de Sentença Administrativa
│       ├── global-rules.md
│       ├── anti-ai-review.md
│       ├── phase0-instructions.md
│       ├── agents/                    ← Prompts de fase da aplicação
│       ├── references/
│       ├── scripts/
│       └── assets/
├── src/
│   ├── app/                           ← Next.js App Router
│   │   ├── (auth)/                    ← Login, registo
│   │   ├── (app)/                     ← Rotas autenticadas (dashboard, peca, settings, admin)
│   │   └── api/                       ← API Routes
│   ├── lib/
│   │   ├── prisma.ts                  ← Prisma client singleton
│   │   ├── auth.ts                    ← NextAuth config
│   │   ├── encryption.ts             ← AES-256-GCM para API keys
│   │   ├── s3.ts                      ← MinIO client
│   │   ├── extract.ts                ← pdftotext + mammoth wrappers
│   │   ├── context-engine.ts         ← Motor de Contexto (progressive disclosure, type-aware)
│   │   ├── orchestrator.ts           ← State machine do pipeline (type-aware skip logic)
│   │   ├── claude-api.ts             ← Wrapper Anthropic SDK (streaming)
│   │   ├── logger.ts                 ← Pino logger
│   │   ├── rate-limit.ts             ← Rate limiting para rotas Claude API
│   │   ├── api-utils.ts              ← requireAuth/requireAdmin/parseBody/errorResponse
│   │   └── docx-generator.ts         ← Wrapper para gerar_docx.py (dispatch por tipo)
│   └── components/
│       ├── ui/                        ← shadcn/ui
│       ├── harness/                   ← Harness UI v2 (5 tabs)
│       ├── peca/                      ← Pipeline UI (sidebar, chat, editor, approval)
│       ├── admin/                     ← Formulários admin (módulos, legislação, etc.)
│       └── settings/                  ← API key, template, style refs
└── public/
```

## Motor de Contexto — lógica de montagem

O Motor de Contexto (`context-engine.ts`) é o componente mais importante. Ele monta
o prompt correto para cada fase, aplicando progressive disclosure.

### Princípio: cada chamada carrega APENAS o que a fase precisa.

O motor é type-aware — `getKnowledgeDir(pecaType)` e `loadKnowledgeFile(filename, pecaType)`
carregam de `knowledge/{acpad,cautelar,execucao}/` conforme o tipo da peça.

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

## Geração do .docx final

Após aprovação da Fase 5, o backend:

1. Monta o JSON com o schema esperado pelo `gerar_docx.py`
2. Preenche campos dinâmicos do perfil do utilizador (advogado_nome, advogado_cp)
3. Dispatch por tipo de peça:
   - **ACPAD:** descarrega template .docx do utilizador do MinIO, executa `knowledge/acpad/scripts/gerar_docx.py`
   - **CAUTELAR:** usa template built-in (`knowledge/cautelar/assets/template-cautelar.docx`), executa `knowledge/cautelar/scripts/gerar_docx.py`
   - **EXECUCAO:** usa template built-in (`knowledge/execucao/assets/template-execucao.docx`), executa `knowledge/execucao/scripts/gerar_docx.py`
4. Faz upload do .docx final para o MinIO
5. Disponibiliza link de download ao utilizador

O `gerar_docx.py` preserva headers, footers e logo do template (substitui apenas o
`document.xml` do zip, mantendo tudo o resto).

## Módulos temáticos iniciais (seed ACPAD)

Definidos no `prisma/seed.ts`:

| code                           | name                              | Legislação própria                          |
| ------------------------------ | --------------------------------- | ------------------------------------------- |
| `sis-indicacao`                | Indicação SIS                     | Reg. UE 2018/1860, 2018/1861                |
| `abandono-voluntario`          | Abandono voluntário / NAV         | Lei 23/2007 art. 138.º e ss.                |
| `erro-facto`                   | Erro de facto na decisão          | CPA art. 153.º                              |
| `ilegalidade-formal`           | Ilegalidade formal                | CPA arts. 114.º, 115.º, 121.º, 153.º, 160.º |
| `integracao-socioprofissional` | Integração socioprofissional      | Lei 23/2007                                 |
| `menor-portugues`              | Menor nacional português          | TFUE art. 20.º, Lei 23/2007 art. 134.º      |
| `proporcionalidade`            | Proporcionalidade / art. 8.º CEDH | CEDH art. 8.º, CPA art. 7.º, CRP art. 18.º  |
| `proibicoes-absolutas`         | Proibições absolutas (art. 134.º) | Lei 23/2007 art. 134.º                      |

Os módulos CAUTELAR e EXECUCAO são configurados com `pecaTypes` no seed para activação selectiva.

## Ficheiros de conhecimento — origem

Os agents e references foram copiados das skills existentes:

```
/mnt/skills/user/acpad-condenacao-ato-devido/ → knowledge/acpad/
/mnt/skills/user/providencia-cautelar-administrativa/ → knowledge/cautelar/
/tmp/execucao-skill/execucao-sentenca-administrativa/ → knowledge/execucao/
```
