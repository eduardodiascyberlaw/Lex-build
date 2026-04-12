# FASE 0 — Análise Documental e Parametrização

Esta fase é executada pelo motor de contexto. O objectivo é analisar os documentos
fornecidos e produzir um plano estruturado (caseData) em formato JSON.

## 0.1 — Leitura integral dos documentos

Extrair e organizar:

**Identificação do Autor** — nome completo (em maiúsculas para o cabeçalho),
nacionalidade, profissão, documento de identificação, NIF, morada.

**Identificação da Ré** — designação, NIF da pessoa coletiva, sede.

**Identificação do ato impugnado** — natureza, data da prática, data de notificação (se
existiu), data do conhecimento efetivo pelo Autor, fundamento legal invocado pela Ré.

**Processo cautelar associado** — número do processo cautelar (quando a ACPAD é proposta
em apenso ou na sequência de cautelar). Se não existir, indicar que a ação é autónoma.

**Cronologia factual completa** — por ordem de data, desde o início da relação com a
administração até ao momento da propositura.

**Factos supervenientes** — factos ocorridos após a distribuição da cautelar (se houver),
que reforçam a posição do Autor ou agravaram a sua situação.

**Documentos probatórios disponíveis** — listar cada documento e o que prova.

## 0.2 — Identificação do tipo de caso e módulos a ativar

Com base nos documentos, identificar:

- **Domínio jurídico principal** (imigração/AR, função pública, urbanismo, contratação, etc.)
- **Tipo de ilegalidade invocável** — formal (notificação, audiência, fundamentação) e/ou
  substantiva (erro de facto, erro de direito, violação de norma proibitiva, desproporção)
- **Módulos temáticos** a ativar — selecionar dos módulos disponíveis no catálogo
- **Referências temáticas** a consultar
- **Ativar Fase 3 (Tempestividade)?** — Sim se: (a) a notificação do ato foi ausente ou
  deficiente; (b) o prazo de impugnação pode ser questionado; (c) o utilizador o indique.
  Não se o prazo é pacífico e o Autor foi regularmente notificado.
- **Blocos de direito a desenvolver** — identificar quais dos blocos I-VI se aplicam
- **Meios de prova** — documental (já disponível), testemunhal (indicar quantas testemunhas
  e o que provam), pericial (quando aplicável), inspeção judicial (excecional)

## 0.3 — Perguntas ao utilizador

Formular apenas as questões estritamente necessárias para preencher lacunas. Não perguntar
o que já resulta dos documentos. Máximo 5 perguntas. Perguntas típicas:

1. Existe processo cautelar associado? Qual o número?
2. Após a cautelar, ocorreram factos novos relevantes (novo emprego, alteração familiar, etc.)?
3. O Autor foi notificado da decisão? Quando e como?
4. Existem testemunhas a arrolar? Quantas e o que provam?
5. Pretende requerer perícia ou outro meio de prova especial?

## 0.4 — Apresentação do plano ao utilizador

Antes de iniciar a Fase 1, apresentar:

1. **Mapa factual cronológico** — todos os factos por data, incluindo supervenientes
2. **Tipo de caso e módulos ativos** — com justificação sumária
3. **Ativação da Fase 3** — indicar se a tempestividade será tratada como secção autónoma
4. **Blocos de direito a desenvolver** — lista dos blocos I-VI a ativar
5. **Estratégia de prova** — meios de prova propostos
6. **Lista de documentos** — com numeração (Doc. 1, Doc. 2, etc.)

Aguardar aprovação antes de ativar a Fase 1.

## Formato do output (caseData JSON)

Após o utilizador aprovar o plano, o conteúdo da fase deve incluir um bloco JSON
com a seguinte estrutura. O sistema irá extrair este JSON para o campo `caseData`
da peça:

```json
{
  "tribunal": "Tribunal Administrativo e Fiscal de ...",
  "processo_cautelar": "n.º 000/00.0BEXXX ou null",
  "autor": {
    "nome": "NOME COMPLETO EM MAIÚSCULAS",
    "descricao": "nacional de ..., profissão, portador/a do passaporte n.º ..., NIF ..., residente na ..."
  },
  "re": {
    "nome": "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
    "descricao": ", com sede na Avenida António Augusto de Aguiar, 20, 1069-119 Lisboa"
  },
  "tipo_acao": "AÇÃO DE CONDENAÇÃO À PRÁTICA DE ATO DEVIDO",
  "base_legal": "nos termos do disposto no art. 66.º, n.º 1 e 2, do CPTA",
  "modules_active": ["sis-indicacao", "ilegalidade-formal"],
  "tempestividade_ativa": true,
  "blocos_direito": ["I", "II", "III", "IV", "V", "VI"],
  "cronologia": [
    { "data": "2024-01-15", "facto": "Entrada em Portugal" },
    { "data": "2024-06-01", "facto": "Pedido de AR" }
  ],
  "documentos": ["Doc. 1 — Cópia do ato impugnado", "Doc. 2 — Cópia do passaporte"],
  "prova_testemunhal": [{ "nome": "Nome", "morada": "Morada", "facto": "O que prova" }],
  "prova_pericial": null
}
```

O JSON deve ser emitido num bloco de código marcado com ```json no final do conteúdo
aprovado da fase.
