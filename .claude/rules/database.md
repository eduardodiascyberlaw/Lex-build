# Modelo de dados — Lex Build (Prisma)

O schema Prisma completo está em `prisma/schema.prisma`. Abaixo está a documentação
anotada dos modelos e enums.

## Modelos principais

### User — Auth & perfil do advogado

- `apiKeyEnc`: API key Claude encriptada com AES-256-GCM. Ver `rules/security.md`.
- `model`: Modelo Claude preferido (default: `claude-sonnet-4-20250514`)
- `role`: `USER` ou `ADMIN`
- `cpOA`: Cédula profissional da Ordem dos Advogados (ex: "CP 59368P OA")

### Peca — Peça processual

- `type`: `PecaType` — `ACPAD | CAUTELAR | EXECUCAO`
- `status`: `PecaStatus` — estado da state machine (ver abaixo)
- `currentPhase`: fase actual (0-5)
- `caseData`: JSON com output estruturado da Fase 0 (inclui `modules_active`)
- `outputS3Key`: path do .docx final no MinIO

### PecaType (enum)

```
ACPAD      — Ação de Condenação à Prática de Ato Devido
CAUTELAR   — Providência Cautelar Administrativa
EXECUCAO   — Execução de Sentença Administrativa
```

### PecaStatus (enum — state machine)

```
DRAFT → PHASE_0_ACTIVE → PHASE_0_APPROVED →
  PHASE_1_ACTIVE → PHASE_1_APPROVED →
  PHASE_2_ACTIVE → PHASE_2_APPROVED →
  PHASE_3_ACTIVE → PHASE_3_APPROVED (ou PHASE_3_SKIPPED) →
  PHASE_4_ACTIVE → PHASE_4_APPROVED →
  PHASE_5_ACTIVE → PHASE_5_APPROVED →
  GENERATING_DOCX → COMPLETED

ERROR — estado terminal em caso de falha
```

A lógica de transição está em `src/lib/orchestrator.ts`. CAUTELAR salta fases 1 e 3.
EXECUCAO salta fase 3.

### Phase — Output de cada fase

- `content`: texto final aprovado (pode ter sido editado pelo advogado)
- `originalContent`: output original do Claude (antes de edição)
- `editedByUser`: flag se o advogado editou antes de aprovar
- `status`: `PENDING | ACTIVE | APPROVED | SKIPPED | REJECTED`

### Template — Papel timbrado do advogado

Template .docx armazenado no MinIO. Usado pelo ACPAD para gerar o documento final.
CAUTELAR e EXECUCAO usam templates built-in.

## Base de conhecimento

### ThematicModule — Módulo temático

- `code`: identificador único (ex: `sis-indicacao`)
- `pecaTypes`: array de `PecaType` — em que tipos de peça pode ser activado
- Relações: `legislation`, `jurisprudence`, `doctrine`, `platformNotes`, `userNotes`, `coreRefs`

### Legislation — Artigos legislativos

- `scope`: `CORE` (carrega sempre) ou `MODULE` (carrega com módulo)
- `diploma`: código do diploma (CPA, CPTA, CRP, etc.)

### ModuleCoreRef — Referências cruzadas

Liga um módulo temático a artigos do núcleo CORE, evitando duplicação.

### StyleReference — Referências de estilo (few-shot)

- `pecaType`: tipo de peça
- `section`: `PRESSUPOSTOS | FACTOS | TEMPESTIVIDADE | DIREITO | PEDIDOS`
- `beforeText` / `afterText`: par antes/depois para few-shot
- `isGoldStandard`: exemplo preferido (carrega primeiro)

## Regras de migração

- **Nunca** usar `prisma migrate reset` ou `db push --force-reset` (bloqueado em `.claude/settings.json`)
- Usar `prisma migrate dev --name <nome>` para criar migrações
- Verificar sempre impacto no `seed.ts` após alterações ao schema
- Enums são adicionados com `ALTER TYPE ... ADD VALUE` (não reversível em PostgreSQL)
- Usar transactions Prisma para operações multi-tabela
