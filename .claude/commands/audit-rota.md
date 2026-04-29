Vais auditar uma rota de API do Lex Build em busca de problemas comuns.

Pergunta-me qual rota auditar (ex: `/api/pecas/[id]/start`).

Verifica:

1. **Autenticação:** a rota usa `getServerSession(authOptions)` ou está dentro de middleware autenticado?
2. **Autorização:** confirma que o `userId` da sessão tem permissão sobre o recurso pedido (ex: `peca.userId === session.user.id`).
3. **Rate limiting:** rotas que chamam a Claude API ou geram .docx devem usar `src/lib/rate-limit.ts`.
4. **Validação de input:** todo body/query/params passa por schema Zod antes de uso?
5. **API key:** se a rota chama a Claude API, a key vem de `apiKeyEnc` desencriptada via `src/lib/encryption.ts`, e nunca é logada nem retornada na response.
6. **Tratamento de erros:** usa `src/lib/api-utils.ts` (se existir padrão) ou retorna shape consistente?
7. **Logging:** usa o logger do `src/lib/logger.ts` (Pino) com nível apropriado?

Apresenta os achados como checklist marcado/desmarcado, com referência exata ao ficheiro e linha. Não alteres código sem eu aprovar.
