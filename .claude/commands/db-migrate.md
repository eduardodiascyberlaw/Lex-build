Vais criar uma nova migração Prisma para o Lex Build.

Passos:

1. Verifica `prisma/schema.prisma` para confirmar que o estado atual reflete a alteração desejada.
2. Pergunta-me um nome curto descritivo para a migração (snake_case, em inglês).
3. Corre `npx prisma migrate dev --name <nome>` num ambiente de desenvolvimento.
4. Após sucesso, mostra-me o ficheiro SQL gerado em `prisma/migrations/`.
5. Verifica se o `seed.ts` continua compatível — se o schema mudou de forma que o seed possa quebrar, alerta-me.
6. **Não corras `prisma migrate reset` em circunstância nenhuma.** Esse comando está bloqueado nas permissões.
