# FASE 0 — Análise documental e parametrização (EXECUÇÃO DE SENTENÇA)

Esta fase é executada directamente pelo orquestrador. O objectivo é analisar os documentos do caso, classificar o tipo de execução e produzir o plano (caseData) para as fases seguintes.

---

## 0.1 — Leitura integral dos documentos

Extrair e organizar:

**Identificação do Exequente** — nome completo (em maiúsculas para o cabeçalho), nacionalidade, profissão, documento de identificação, NIF, morada.

**Identificação da Executada** — designação oficial, NIF da pessoa colectiva, sede.

**Identificação da sentença exequenda** — tribunal, número de processo (incluindo apensos), data da sentença, nome do juiz, tipo de decisão (sentença, acórdão), se houve antecipação do juízo (art. 121.º CPTA).

**Dispositivo da sentença** — com rigor: o que foi anulado, o que foi condenado, os parâmetros fixados pelo tribunal para a nova decisão administrativa, custas.

**Vícios reconhecidos na sentença** — listar cada vício com indicação da norma violada, distinguindo os que procederam dos que improcederam.

**Trânsito em julgado** — confirmar data e fundamento (ausência de recurso, expiração de prazo, decisão de recurso).

**Incumprimento** — notificação da sentença à Executada (data e modo), tempo decorrido, actos (ou omissões) da Executada desde então.

**Situação actual do Exequente** — factos supervenientes à sentença que agravam a urgência ou reforçam a posição.

---

## 0.2 — Classificação do tipo de execução

Com base na sentença, identificar:

- **Tipo principal:**
  - `ANULACAO` — a sentença limitou-se a anular o acto (art. 162.º)
  - `CONDENACAO` — a sentença condenou à prática de acto devido (art. 166.º)
  - `MISTA` — anulou e condenou a retomar procedimento com parâmetros (combina arts. 162.º e 166.º) — caso mais frequente
  - `RESTITUICAO` — condenação em restituição ou compensação (art. 171.º)

- **Módulos de direito a activar na Fase 4 (Direito):**
  - M1 — Execução de sentença anulatória (art. 162.º) — SEMPRE
  - M2 — Execução de sentença condenatória (art. 166.º) — se CONDENACAO ou MISTA
  - M3 — Sanção pecuniária compulsória (art. 169.º) — SEMPRE (recomendado)
  - M4 — Tutela jurisdicional efectiva (CRP) — SEMPRE
  - M5 — Causa legítima de inexecução (art. 163.º) — se risco de a Executada invocar impossibilidade

- **Domínio temático** — imigração/AR, urbanismo, função pública, contratação pública, outro
- **Referências partilhadas a consultar** — sis-aima.md (se imigração), proporcionalidade.md (se vida familiar), etc.

---

## 0.3 — Perguntas ao utilizador

Formular apenas as questões estritamente necessárias para preencher lacunas. Não perguntar o que já resulta dos documentos. Máximo 5 perguntas. Perguntas típicas:

1. A sentença transitou em julgado? A Executada recorreu?
2. A Executada tomou alguma medida de cumprimento desde a notificação?
3. Quando foi a Executada notificada da sentença?
4. A situação do Exequente alterou-se desde a sentença?
5. Pretende requerer sanção pecuniária compulsória?

---

## 0.4 — Apresentação do plano ao utilizador

Antes de iniciar a Fase 1, apresentar:

1. **Identificação da sentença exequenda** — tribunal, processo, data, dispositivo resumido
2. **Tipo de execução e módulos activos** — com justificação
3. **Cronologia do incumprimento** — prazo decorrido, cálculo
4. **Estratégia processual** — pedidos a formular
5. **Lista de documentos** — com numeração (Doc. 1, Doc. 2, etc.)

Aguardar aprovação antes de activar a Fase 1.

---

## Schema do caseData (JSON)

O output desta fase deve incluir um bloco JSON com a seguinte estrutura:

```json
{
  "tribunal": "Tribunal Administrativo e Fiscal de ...",
  "processo": "n.º 000/00.0BEXXX",
  "exequente": {
    "nome": "NOME COMPLETO EM MAIÚSCULAS",
    "descricao": "nacional de ..., portador/a do passaporte n.º ..., NIF ..., residente na ..."
  },
  "executada": {
    "nome": "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
    "descricao": ", com sede na Avenida António Augusto de Aguiar, 20, 1069-119 Lisboa"
  },
  "tipo_execucao": "MISTA",
  "modulos_direito": ["M1", "M2", "M3", "M4"],
  "dominio": "imigracao",
  "modules_active": [],
  "dispositivo_sentenca": "...",
  "data_transito": "...",
  "data_notificacao": "...",
  "documentos": ["Doc. 1 — Certidão da sentença", "Doc. 2 — ..."]
}
```
