# Convenções de código — Lex Build

## Stack detalhada

- **Next.js 16.2.3** (App Router) + **React 19.2.4** + TypeScript 5 (strict mode)
- **Prisma 5.22** + PostgreSQL 16
- **NextAuth 4.24** (Credentials provider — email/password)
- **@anthropic-ai/sdk 0.86.1** — wrapper em `src/lib/claude-api.ts`
- **Zod 4** — validação de input em todas as API routes
- **Pino 10** — logging (`src/lib/logger.ts`)
- **Tailwind CSS** + **shadcn/ui** — componentes UI
- **MinIO** (S3-compatible) — file storage
- Docker Compose para deploy em VPS Linux

## TypeScript

- Strict mode activado
- Imports absolutos: `@/lib/...`, `@/components/...`
- Nunca `any` sem justificação — preferir tipos explícitos ou `unknown`

## React / Next.js

- **Server Components por defeito.** Adicionar `"use client"` apenas quando necessário (hooks, event handlers, browser APIs).
- App Router: layouts em `layout.tsx`, pages em `page.tsx`, API routes em `route.ts`
- Route groups: `(auth)` para rotas públicas, `(app)` para rotas autenticadas

## Formatação

- **Prettier** configurado no projecto (corre via lint-staged no commit)
- **ESLint** com regras Next.js
- Ficheiros `.md` em `.claude/` passam pelo Prettier — está OK, não excluir

## Prisma

- Usar **transactions** para operações multi-tabela
- Client singleton em `src/lib/prisma.ts`
- Migrations via `prisma migrate dev` (nunca `reset` ou `push --force-reset`)

## Erros

- Shape consistente: `{ error: string, details?: any }`
- Usar helpers de `src/lib/api-utils.ts` (`errorResponse`, `requireAuth`, etc.)

## Idioma

- **Código** (variáveis, funções, tipos, rotas): inglês
- **Textos de interface** (strings visíveis ao utilizador): PT-PT
- **Textos jurídicos gerados pela IA** (Fases 1-5): PT-PT formal forense
- **Comentários no código**: inglês (alinhado com o código)
