# Convenções de API — Lex Build

## Estrutura de rotas

Todas as API routes estão em `src/app/api/` usando Next.js App Router (`route.ts`).

### Rotas principais

| Rota                       | Descrição                                          |
| -------------------------- | -------------------------------------------------- |
| `pecas/`                   | CRUD de peças (lista, criação)                     |
| `pecas/[id]/`              | Detalhe de uma peça                                |
| `pecas/[id]/uploads/`      | Upload de documentos para uma peça                 |
| `pecas/[id]/start/`        | Iniciar pipeline (DRAFT → PHASE_0_ACTIVE)          |
| `pecas/[id]/chat/`         | Chat streaming com Claude (qualquer fase)          |
| `pecas/[id]/approve/`      | Aprovar fase + transição de estado                 |
| `pecas/[id]/generate/`     | Gerar .docx final                                  |
| `pecas/[id]/download/`     | Download do .docx                                  |
| `profile/`                 | Perfil do utilizador                               |
| `profile/api-key/`         | Gestão da API key Claude                           |
| `profile/template/`        | Upload/gestão do template .docx                    |
| `style-references/`        | CRUD de referências de estilo                      |
| `modules/[code]/my-notes/` | Notas privadas por módulo                          |
| `admin/*`                  | Rotas de administração (módulos, legislação, etc.) |

## Padrões obrigatórios

### 1. Autenticação

Todas as rotas (excepto `auth/[...nextauth]`) usam `getServerSession(authOptions)`.
O `userId` vem SEMPRE da sessão, nunca do body ou query.

### 2. Autorização (ownership)

Em rotas com `[id]`, confirmar que o recurso pertence ao utilizador:

```typescript
const peca = await prisma.peca.findUnique({ where: { id } });
if (!peca || peca.userId !== session.user.id) {
  return errorResponse("Peça não encontrada", 404);
}
```

Rotas `admin/*` verificam `session.user.role === "ADMIN"`.

### 3. Validação de input

Todo body/query/params passa por schema Zod antes de uso. Usar `z.object()` inline
ou schemas partilhados conforme o caso.

### 4. Respostas de erro

Shape consistente via `src/lib/api-utils.ts`:

```typescript
return errorResponse("Mensagem de erro", 400);
// Retorna: { error: "Mensagem de erro" }
```

### 5. Logging

Usar `src/lib/logger.ts` (Pino) com nível apropriado. Nunca `console.log` em produção.

## Naming — PT-PT vs inglês

- **Código** (variáveis, funções, tipos): inglês
- **Enums e valores de negócio**: inglês técnico (ex: `ACPAD`, `PRESSUPOSTOS`, `PHASE_0_ACTIVE`)
- **Strings visíveis ao utilizador**: PT-PT
- **Textos jurídicos gerados pela IA**: PT-PT formal forense
- **Nomes de rotas API**: inglês (`/api/pecas`, `/api/profile`)

## Streaming (chat)

A rota `pecas/[id]/chat/` usa streaming SSE com `@anthropic-ai/sdk`. O wrapper está
em `src/lib/claude-api.ts` (`streamClaude` — AsyncGenerator). O conteúdo final da
fase é gravado em `Phase.content` ao terminar o stream.
