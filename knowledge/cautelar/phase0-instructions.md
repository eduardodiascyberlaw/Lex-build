# FASE 0 — Análise documental e parametrização (Providência Cautelar)

Esta fase é executada diretamente pelo orquestrador. Quando o utilizador fornecer
documentos, segue estes passos:

## 0.1 — Leitura integral

Lê cada documento na íntegra. Extrai e organiza:

**Identificação do Requerente** — nome completo, nacionalidade, NIF, documento de
identificação, morada, situação familiar.

**Identificação da Entidade Requerida** — designação, base legal de atuação, competência.

**Identificação do ato impugnado** — natureza, data, fundamento legal invocado, data
de notificação, prazo de execução.

**Cronologia dos factos** — por ordem de data, desde a entrada do requerente em Portugal
ou o início da relação com a administração até ao ato impugnado.

**Documentos probatórios disponíveis** — listar cada documento e o que prova.

**Urgência** — existe prazo iminente para execução do ato? Existe data agendada para
ato coercitivo?

## 0.2 — Identificação do tipo de caso e módulos a ativar

Com base nos documentos, identificar:

- Domínio jurídico principal (estrangeiros/imigração, licenciamento, urbanismo,
  função pública, contratação pública, etc.)
- Tipo de ilegalidade invocável (erro de facto, erro de direito, vício procedimental,
  inconstitucionalidade, violação do direito da UE, desproporção manifesta)
- Módulos temáticos a ativar
- Referências temáticas em `references/` aplicáveis ao caso
- Estratégia cautelar: fumus principal + argumentos subsidiários

## 0.3 — Perguntas ao utilizador

Faz apenas as perguntas estritamente necessárias para preencher lacunas. Não perguntes
o que já resulta dos documentos. Máximo 5 perguntas.

## 0.4 — Apresentação do plano ao utilizador

Apresentar antes de iniciar a redação:

1. **Mapa factual cronológico** — todos os factos relevantes por data
2. **Tipo de caso e módulos a ativar** — com justificação sumária
3. **Estratégia cautelar** — fumus principal e subsidiário, periculum e ponderação
4. **Lista de documentos a juntar** — com numeração (Doc. 1, Doc. 2, etc.)
5. **Referências temáticas ativas** — quais os ficheiros de `references/` a consultar

## 0.5 — Bloco JSON caseData

Produzir um bloco JSON com o seguinte schema:

```json
{
  "tribunal": "Tribunal Administrativo e Fiscal de ...",
  "juizo": "Exmo. Senhor Juiz de Direito do Juízo ...",
  "requerente": { "nome": "NOME COMPLETO", "descricao": "nacional de ..." },
  "requerida": { "nome": "...", "descricao": "..." },
  "tipo_acao": "PROVIDÊNCIA CAUTELAR",
  "subtipo_acao": "DE SUSPENSÃO DE EFICÁCIA DE ATO ADMINISTRATIVO",
  "requisitos_114": {
    "providencia_adotada": "Suspensão da eficácia do ato administrativo que ...",
    "acao_dependente": "O Requerente indica que irá propor ..."
  },
  "modules_active": ["sis-indicacao", "integracao-socioprofissional"],
  "blocos_direito": ["fumus_sis", "periculum_afastamento", "ponderacao_integracao"],
  "cronologia": [...],
  "documentos": ["Doc. 1 - ...", "Doc. 2 - ..."],
  "prova_testemunhal": [],
  "prova_pericial": null
}
```

Aguarda aprovação antes de avançar.
