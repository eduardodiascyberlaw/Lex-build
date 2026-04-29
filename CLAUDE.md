# CLAUDE.md — Lex Build

## Identidade

Lex Build é uma plataforma web SaaS que permite a advogados portugueses gerar peças
processuais de alta qualidade usando IA (Claude API), com um pipeline de fases
sequenciais, aprovação humana entre cada fase, e uma base de conhecimento jurídico
modular que cresce com o uso.

**Tipos de peça:** ACPAD, Providência Cautelar, Execução de Sentença.
**Público:** Advogados com cédula profissional na Ordem dos Advogados de Portugal.
**Modelo de negócio:** SaaS por assinatura. Cada advogado usa a sua própria API key
do Claude (Anthropic). O Lex Build orquestra as chamadas.

## Stack (resumo)

- Next.js 16.2.3 (App Router) + React 19.2.4 + TypeScript 5
- Prisma 5.22 + PostgreSQL 16
- NextAuth 4.24 (Credentials)
- @anthropic-ai/sdk 0.86.1
- Zod 4, Pino 10, Tailwind CSS, shadcn/ui
- MinIO (S3-compatible) para storage
- Docker Compose para deploy

Detalhes em `.claude/rules/code-style.md`.

## Regras absolutas (sempre carregadas)

1. **PT-PT em outputs jurídicos** — O sistema gera peças para tribunais portugueses. Output da Claude API nas Fases 1-5 é sempre PT-PT formal forense.
2. **PT-PT também em comunicação UI** — strings visíveis ao utilizador (advogado em Portugal) são PT-PT.
3. **API key nunca é logada nem retornada.** A `apiKeyEnc` em `User` é AES-256-GCM. Desencriptar só na borda imediata da chamada Claude. Ver `rules/security.md`.
4. **Aprovação humana entre fases.** Nenhum estado avança sem `PHASE_X_APPROVED`. Não automatizes transições.
5. **Migrations Prisma são uma direção.** Nunca `migrate reset` ou `db push --force-reset` em base com dados.
6. **`knowledge/{type}/agents/` são prompts da aplicação, não subagentes do Claude Code.** Não confundir com `.claude/agents/`.

## Onde está o quê

- Arquitectura, fases, motor de contexto, fluxos: `.claude/rules/architecture.md`
- Modelo de dados Prisma: `.claude/rules/database.md`
- Convenções de API e naming: `.claude/rules/api-conventions.md`
- Segurança (apiKeyEnc, rate-limit, auth): `.claude/rules/security.md` + `SECURITY.md` na raiz
- Convenções de código (Next 16, React 19, Tailwind): `.claude/rules/code-style.md`
- Slash commands disponíveis: `.claude/commands/`
- Permissões de execução: `.claude/settings.json`

## Variáveis de ambiente

Ver `.env.example`. Nunca commitar `.env` ou `.env.local`.

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
