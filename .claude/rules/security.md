# Segurança — Lex Build

Para o standard completo, consultar `SECURITY.md` na raiz do projecto.
Este ficheiro resume as regras mais relevantes para o desenvolvimento diário.

## API key Claude (apiKeyEnc)

- Encriptada com **AES-256-GCM**. Chave derivada de `process.env.ENCRYPTION_KEY` (32 bytes hex).
- Armazenada como `iv:authTag:ciphertext` no campo `User.apiKeyEnc`.
- Desencriptar **apenas em memória**, na borda imediata da chamada à Claude API.
- **Nunca logar, nunca enviar ao frontend.** O frontend mostra apenas `sk-ant-...****`.
- Implementação em `src/lib/encryption.ts`.

## Autenticação & autorização

- **Zero endpoints sem auth.** Whitelist: `auth/[...nextauth]`, health, static.
- `userId` vem **SEMPRE do token/sessão**, nunca do body ou query.
- Ownership check em todo CRUD com `[id]`: `recurso.userId === session.user.id`.
- Rotas admin verificam `session.user.role === "ADMIN"`.
- Passwords: **bcrypt 12 rounds**.

## Rate limiting

- Rotas que chamam a Claude API (`chat`, `generate`) devem usar `src/lib/rate-limit.ts`.
- Previne abuso de custos (o utilizador paga a sua própria key, mas a plataforma controla o ritmo).

## Validação de input

- **Zod em TODOS os endpoints.** Body, query, params — tudo validado antes de uso.
- Sanitizar inputs do utilizador antes de injecção em prompts da Claude API (prevenção de prompt injection).

## Headers & transporte

- CORS whitelist explícita em `CORS_ORIGIN`.
- Nunca `NEXT_PUBLIC_` com segredos.

## Logging

- Usar Pino (`src/lib/logger.ts`). **Zero `console.log` em produção.**
- Nunca logar PII, API keys, ou tokens.

## Variáveis de ambiente

- Nunca commitar `.env` ou `.env.local`.
- `ENCRYPTION_KEY` deve ter 64 hex chars (= 32 bytes).
- Ver `.env.example` para a lista completa.
