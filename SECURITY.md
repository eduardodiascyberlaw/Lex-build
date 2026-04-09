SECURITY.md — Regras de Segurança e Qualidade de Código

**Aplica-se a:** Todos os projetos construídos pelo Claude Code para Eduardo Dias.
**Versão:** 1.0
**Data:** 2026-04-10

Este ficheiro é **obrigatório** em todos os projetos. O Claude Code deve ler e cumprir
TODAS estas regras antes de escrever qualquer código. Nenhuma exceção é aceitável sem
aprovação explícita do Eduardo.

---

## 1. AUTENTICAÇÃO E AUTORIZAÇÃO

### 1.1 — Zero endpoints sem autenticação

**REGRA ABSOLUTA:** Nenhum endpoint da API pode existir sem middleware de autenticação,
exceto os seguintes (lista exaustiva):

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `GET /api/health` (healthcheck)
- Assets estáticos servidos pelo frontend

Qualquer novo endpoint DEVE incluir o middleware de auth. Se o Claude Code criar um
endpoint sem auth, é um bug — corrigir imediatamente.

```typescript
// CORRETO — todo endpoint tem auth
router.get('/api/pecas', authMiddleware, async (req, res) => { ... });

// ERRADO — nunca fazer isto
router.get('/api/pecas', async (req, res) => { ... });
```

### 1.2 — userId vem SEMPRE do token, NUNCA do body

**REGRA ABSOLUTA:** O `userId` é extraído exclusivamente do token JWT ou da sessão
autenticada. Nunca aceitar `userId` do body, query params, ou headers do cliente.

```typescript
// CORRETO — userId do token
const userId = req.user.id; // extraído pelo authMiddleware

// ERRADO — IDOR vulnerability
const { userId } = req.body; // NUNCA
```

### 1.3 — Verificação de ownership em todos os recursos

Antes de ler, editar ou apagar qualquer recurso, verificar que pertence ao utilizador
autenticado:

```typescript
const peca = await db.peca.findFirst({
  where: { id: pecaId, userId: req.user.id }, // SEMPRE filtrar por userId
});
if (!peca) return res.status(404).json({ error: "Não encontrado" });
```

### 1.4 — Roles e permissões

- `USER` — acede apenas aos seus próprios recursos
- `ADMIN` — acede a rotas `/api/admin/*` e recursos da plataforma

Middleware de role:

```typescript
function requireRole(role: UserRole) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: "Sem permissão" });
    }
    next();
  };
}

// Uso
router.post("/api/admin/modules", authMiddleware, requireRole("ADMIN"), handler);
```

### 1.5 — Passwords

- Hashing com **bcrypt**, mínimo **12 rounds**
- Password mínima: 8 caracteres
- Nunca logar passwords, nem em modo debug
- Nunca devolver password hash em responses da API

### 1.6 — Rate limiting nos endpoints de auth

Os endpoints de autenticação DEVEM ter rate limiting agressivo:

```
POST /api/auth/login        → 5 tentativas por IP por minuto
POST /api/auth/register     → 3 registos por IP por hora
POST /api/auth/forgot-password → 3 pedidos por email por hora
```

Após exceder o limite, devolver `429 Too Many Requests` com `Retry-After` header.

### 1.7 — Tokens e sessões

- JWT com expiração máxima de 24 horas
- Refresh tokens com expiração de 7 dias (quando aplicável)
- Tokens armazenados em httpOnly cookies (nunca em localStorage)
- Incluir `secure: true` e `sameSite: 'strict'` em produção

---

## 2. VALIDAÇÃO DE INPUT

### 2.1 — Zod em TODOS os endpoints

**REGRA ABSOLUTA:** Todo endpoint que recebe dados (body, query, params) DEVE ter
um schema Zod que valida e tipifica o input ANTES de qualquer lógica de negócio.

```typescript
import { z } from "zod";

const createPecaSchema = z.object({
  body: z.object({
    type: z.enum(["ACPAD", "CAUTELAR"]),
    templateId: z.string().cuid().optional(),
  }),
});

router.post("/api/pecas", authMiddleware, validate(createPecaSchema), handler);
```

### 2.2 — Middleware de validação genérico

Usar um middleware centralizado que:

- Valida body, query e params
- Rejeita campos extra (`.strict()` ou `.strip()`)
- Devolve erros formatados com campo + mensagem
- Devolve status `400` para input inválido

### 2.3 — Sanitização

- **Strings:** trimmar espaços, limitar comprimento máximo
- **HTML:** nunca renderizar HTML cru do utilizador — usar sanitização ou escape
- **SQL:** zero concatenação de strings em queries — usar apenas queries parametrizadas
- **Filenames:** sanitizar nomes de ficheiros em uploads (remover `../`, caracteres especiais)

### 2.4 — Uploads de ficheiros

- Validar MIME type no servidor (não confiar no Content-Type do cliente)
- Limitar tamanho máximo (ex: 20 MB por ficheiro)
- Armazenar em S3/MinIO, nunca no filesystem local servido pelo web server
- Nunca executar ficheiros enviados pelo utilizador
- Gerar nomes aleatórios (UUID) para ficheiros armazenados

---

## 3. SEGURANÇA DE TRANSPORTE E HEADERS

### 3.1 — HTTPS obrigatório

- Todo o tráfego em produção DEVE ser HTTPS
- Redirecionar HTTP → HTTPS automaticamente
- Certificados via Let's Encrypt (auto-renovação)

### 3.2 — Headers de segurança

Incluir em TODAS as respostas HTTP em produção:

```typescript
// Middleware de security headers
app.use((req, res, next) => {
  // Previne clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Previne MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Activa HSTS (1 ano)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Controla referrer
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy (ajustar conforme o projeto)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "connect-src 'self' https://api.anthropic.com; " +
      "frame-ancestors 'none';"
  );

  // Desativa X-Powered-By
  res.removeHeader("X-Powered-By");

  next();
});
```

### 3.3 — CORS

- Em produção, permitir APENAS a origem do frontend (`https://dominio.pt`)
- Nunca usar `Access-Control-Allow-Origin: *` em produção
- Listar explicitamente os métodos e headers permitidos

### 3.4 — CSRF

- Se usar cookies para auth: implementar proteção CSRF (token por sessão)
- Se usar Bearer token em header: CSRF não se aplica (mas nunca armazenar
  o token em cookie sem httpOnly)

---

## 4. PROTECÇÃO DE DADOS SENSÍVEIS

### 4.1 — API keys e segredos

- **NUNCA** hardcoded no código-fonte — sempre em variáveis de ambiente
- **NUNCA** com prefixo `VITE_` ou `NEXT_PUBLIC_` (expõe no bundle do frontend)
- Encriptar em repouso com AES-256-GCM quando armazenadas na base de dados
- Desencriptar apenas em memória, usar e descartar
- Nunca logar segredos (mesmo parcialmente)
- O frontend mostra apenas os primeiros/últimos 4 caracteres (`sk-ant-...****`)

### 4.2 — Dados pessoais

- Mínimo necessário: recolher apenas os dados estritamente necessários
- Encriptar dados sensíveis em repouso (API keys, NIF, documentos)
- Soft delete por defeito (marcar como inativo, não apagar)
- Logs NUNCA contêm dados pessoais (nome, email, NIF, passwords, tokens)

### 4.3 — Respostas da API

- Nunca devolver mais campos do que o necessário (usar `select` no Prisma)
- Nunca devolver password hashes, API keys, ou tokens internos
- Erros em produção: mensagem genérica ao cliente, detalhe apenas nos logs

```typescript
// CORRETO
return res.status(500).json({ error: "Erro interno" });
// Log interno com detalhe
logger.error({ err, userId: req.user.id }, "Falha ao gerar peça");

// ERRADO — expõe stack trace ao cliente
return res.status(500).json({ error: err.message, stack: err.stack });
```

### 4.4 — .gitignore obrigatório

Todo projeto DEVE ter no `.gitignore`:

```
.env
.env.*
!.env.example
*.pem
*.key
*.p12
*.pfx
*.cert
node_modules/
.next/
dist/
*.log
```

E um `.env.example` com todas as variáveis (sem valores reais).

---

## 5. QUALIDADE DE CÓDIGO

### 5.1 — TypeScript strict

Todo projeto usa TypeScript com configuração strict:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 5.2 — ESLint + Prettier

- ESLint configurado com regras recomendadas (flat config ESLint 9+)
- Prettier para formatação automática (aspas duplas, 2 espaços, ponto-e-vírgula)
- Ambos devem estar configurados desde o primeiro commit
- Configurar `.prettierrc` e `eslint.config.mjs` na raiz

### 5.3 — Pre-commit hooks

Husky + lint-staged configurados para:

- Rodar Prettier em ficheiros staged
- Rodar ESLint em ficheiros staged
- Impedir commit se houver erros de lint

### 5.4 — Logger estruturado (zero console.log em produção)

- Usar Pino ou similar para logs estruturados em JSON
- Cada serviço/módulo cria o seu logger com nome identificador
- Níveis: `info`, `warn`, `error`, `debug`
- Em desenvolvimento: formato legível com cores
- Em produção: JSON puro para integração com ferramentas de observabilidade
- **Zero `console.log`, `console.warn`, `console.error`** em código de produção

```typescript
import { createLogger } from "@/lib/logger";

const logger = createLogger("context-engine");

logger.info({ phase: 2, modules: ["sis"] }, "Montando contexto");
logger.error({ err, pecaId }, "Falha na chamada à API");
```

### 5.5 — Imports absolutos

Usar path aliases em vez de imports relativos profundos:

```typescript
// CORRETO
import { prisma } from "@/lib/prisma";
import { PecaCard } from "@/components/dashboard/peca-card";

// ERRADO
import { prisma } from "../../../lib/prisma";
```

### 5.6 — Tratamento de erros

- Toda chamada a API externa (Claude, S3, etc.) envolvida em try/catch
- Erros logados com contexto suficiente para debug
- Nunca engolir erros silenciosamente (`catch (e) {}`)
- Usar error boundaries no React para erros de renderização
- Respostas de erro estruturadas e consistentes:

```typescript
interface ApiError {
  error: string; // Mensagem para o utilizador
  code?: string; // Código máquina (ex: 'INVALID_API_KEY')
  details?: unknown; // Detalhes adicionais (apenas em desenvolvimento)
}
```

### 5.7 — Sem código morto

- Não deixar funções, imports ou variáveis não utilizadas
- Não deixar código comentado (usar git para histórico)
- ESLint com `noUnusedLocals` e `noUnusedParameters` detecta automaticamente

---

## 6. RESILIÊNCIA

### 6.1 — Circuit breaker em dependências externas

Quando o sistema depende de serviços externos (API do Claude, Supabase, S3),
implementar circuit breaker com 3 estados:

- **Closed (normal):** chamadas passam normalmente
- **Open (falha):** após N falhas consecutivas, activar fallback
- **Half-Open (recuperação):** após timeout, tentar reconectar

### 6.2 — Caches com limites

- Caches in-memory DEVEM ter `maxEntries` e `TTL`
- Usar LRU (Least Recently Used) ou FIFO para eviction
- Nunca usar `Map` sem limite para cache — cresce indefinidamente e causa memory leak

### 6.3 — Timeouts

- Toda chamada HTTP externa DEVE ter timeout (ex: 30s para Claude API, 5s para S3)
- Toda query à base de dados DEVE ter timeout (ex: 10s)
- Informar o utilizador quando um timeout ocorre

### 6.4 — Retry com backoff

Para chamadas à API do Claude e outras APIs externas:

```typescript
async function callWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = Math.min(1000 * Math.pow(2, i), 10000); // exponential backoff
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

### 6.5 — Graceful shutdown

O servidor DEVE fechar conexões limpamente ao receber SIGTERM:

```typescript
process.on("SIGTERM", async () => {
  logger.info("SIGTERM recebido, a fechar...");
  await server.close();
  await prisma.$disconnect();
  process.exit(0);
});
```

---

## 7. BASE DE DADOS

### 7.1 — Queries seguras

- Zero concatenação de strings em queries SQL
- Usar exclusivamente queries parametrizadas (Prisma, prepared statements)
- Limitar resultados com `take` / `LIMIT` — nunca devolver tabelas inteiras

### 7.2 — Migrations

- Toda alteração ao schema passa por Prisma Migrate
- Nunca alterar a base de dados manualmente em produção
- Migrations devem ser reversíveis quando possível

### 7.3 — Backups

- Base de dados de produção com backup diário automático
- Testar restore de backup pelo menos uma vez antes do go-live

### 7.4 — Índices

- Criar índices para campos usados em `WHERE` e `ORDER BY` frequentes
- No mínimo: `userId` em todas as tabelas com dados do utilizador
- Monitorizar queries lentas e adicionar índices conforme necessário

### 7.5 — Transactions

- Operações que alteram múltiplas tabelas DEVEM usar transactions Prisma:

```typescript
await prisma.$transaction(async (tx) => {
  await tx.phase.update({ ... });
  await tx.peca.update({ ... });
  await tx.styleReference.create({ ... });
});
```

---

## 8. FRONTEND

### 8.1 — Sem dados sensíveis no bundle

- Variáveis com `NEXT_PUBLIC_` ou `VITE_` são incluídas no bundle — visíveis
  para qualquer pessoa
- **NUNCA** colocar API keys, segredos ou tokens em variáveis públicas do frontend
- O frontend só precisa de: URL da API, configurações de UI
- Tudo o resto passa pelo backend

### 8.2 — XSS prevention

- Usar React (que escapa output por defeito)
- **NUNCA** usar `dangerouslySetInnerHTML` sem sanitização prévia com DOMPurify
- Sanitizar qualquer conteúdo do utilizador antes de renderizar

### 8.3 — Estado de autenticação

- Verificar auth no server-side (middleware, getServerSession)
- Redirecionar para login se não autenticado
- Proteger rotas de admin no frontend E no backend (defence in depth)

### 8.4 — Error boundaries

- Componente ErrorBoundary global que captura erros de renderização
- Mensagem amigável ao utilizador, log interno do erro
- Não mostrar stack traces ao utilizador

---

## 9. DOCKER E DEPLOY

### 9.1 — Imagem mínima

- Usar imagens slim (`node:20-slim`, `python:3.12-slim`)
- Multi-stage build: stage de build separado do stage de runtime
- Não incluir ferramentas de desenvolvimento na imagem final

### 9.2 — Não correr como root

```dockerfile
RUN addgroup --system app && adduser --system --ingroup app app
USER app
```

### 9.3 — Variáveis de ambiente

- Nunca incluir `.env` na imagem Docker
- Passar variáveis via `docker-compose.yml` ou secrets manager
- `.env.example` no repositório com todas as variáveis documentadas

### 9.4 — Health checks

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

### 9.5 — Logs

- Containers enviam logs para stdout/stderr
- Docker Compose ou runtime externo gere rotação e retenção
- Nunca escrever logs para ficheiros dentro do container

---

## 10. TESTES

### 10.1 — Cobertura mínima

Para MVP, cobertura mínima obrigatória:

- Auth (register, login, token validation, role check)
- Middleware de validação
- Motor de Contexto (progressive disclosure)
- Orquestrador de fases (state machine transitions)
- Endpoints críticos (criar peça, aprovar fase, gerar docx)

### 10.2 — Testes de segurança

Incluir testes que verificam explicitamente:

- Endpoint sem auth devolve 401
- Utilizador A não acede a recursos do utilizador B
- Input inválido devolve 400 com erro claro
- Rate limiting devolve 429 após exceder limite
- Admin route devolve 403 para utilizador normal

```typescript
describe("Security", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/pecas");
    expect(res.status).toBe(401);
  });

  it("prevents IDOR — user A cannot access user B resources", async () => {
    const res = await request(app)
      .get(`/api/pecas/${userBPecaId}`)
      .set("Authorization", `Bearer ${userAToken}`);
    expect(res.status).toBe(404); // não 403 — não revelar existência
  });

  it("validates input with Zod", async () => {
    const res = await request(app)
      .post("/api/pecas")
      .set("Authorization", `Bearer ${token}`)
      .send({ type: "INVALIDO" });
    expect(res.status).toBe(400);
  });
});
```

### 10.3 — Framework

- Vitest ou Jest (conforme o projeto)
- Supertest para testes de endpoints HTTP
- Testes rodam em CI antes de merge (quando CI existir)

---

## 11. CHECKLIST PRÉ-DEPLOY

Antes de qualquer deploy para produção, verificar:

```
AUTH
☐ Zero endpoints sem middleware de autenticação (excepto whitelist)
☐ userId extraído exclusivamente do token/sessão
☐ Ownership check em todos os acessos a recursos
☐ Rate limiting nos endpoints de auth
☐ Passwords com bcrypt 12 rounds

INPUT
☐ Zod schema em todos os endpoints que recebem dados
☐ Campos extra rejeitados (.strict() ou .strip())
☐ Uploads validados (MIME type, tamanho, nome sanitizado)

SEGREDOS
☐ Zero hardcoded secrets no código-fonte
☐ Zero variáveis VITE_/NEXT_PUBLIC_ com segredos
☐ API keys encriptadas na base de dados
☐ .env no .gitignore
☐ .env.example com todas as variáveis

TRANSPORTE
☐ HTTPS em produção
☐ Security headers configurados (CSP, HSTS, X-Frame-Options)
☐ CORS restrito à origem do frontend

CÓDIGO
☐ TypeScript strict mode
☐ ESLint + Prettier configurados
☐ Zero console.log em produção
☐ Pre-commit hooks activos
☐ Zero código morto ou imports não utilizados

RESILIÊNCIA
☐ Circuit breaker em dependências externas
☐ Timeouts em todas as chamadas externas
☐ Caches com maxEntries e TTL
☐ Graceful shutdown configurado

BASE DE DADOS
☐ Queries parametrizadas (zero concatenação SQL)
☐ Índices em campos de lookup frequente
☐ Migrations versionadas
☐ Backup configurado

TESTES
☐ Testes de auth (401, 403, IDOR)
☐ Testes de validação (400 para input inválido)
☐ Testes dos fluxos críticos

DOCKER
☐ Container não corre como root
☐ .env não incluído na imagem
☐ Health check configurado
☐ Logs para stdout
```

---

## APLICAÇÃO DESTE DOCUMENTO

Este ficheiro deve ser colocado na raiz de cada projeto como `SECURITY.md`.
O Claude Code DEVE ler este ficheiro antes de iniciar qualquer trabalho e
cumprir TODAS as regras aqui descritas. Quando criar um novo endpoint,
componente ou serviço, verificar contra as regras aplicáveis.

Se alguma regra entrar em conflito com um requisito do projeto, documentar
a exceção e obter aprovação do Eduardo antes de prosseguir.
