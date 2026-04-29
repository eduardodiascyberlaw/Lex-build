Vais criar um novo endpoint sob `/api/pecas/[id]/...` seguindo os padrões existentes.

Passos:

1. Pergunta-me: nome do endpoint, método HTTP, propósito.
2. Examina endpoints irmãos em `src/app/api/pecas/[id]/` (ex: `start`, `approve`, `chat`) para extrair o padrão atual: imports, autenticação, validação, error handling, logger.
3. Cria o novo `route.ts` seguindo esse padrão exato.
4. Se for um endpoint que muda estado da `Peca`, considera atualizar o `orchestrator.ts` e os `PecaStatus` enum se necessário — nesse caso para e pede-me orientação antes de mexer.
5. Cria/atualiza schema Zod para o body se houver input.
6. **Não fazes commit** desta criação automaticamente — mostra-me o diff e espera aprovação.
