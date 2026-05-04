# Fase 0 — Viabilidade e Teses — Recurso de Apelação

Esta fase é executada pelo orquestrador antes de qualquer redação.
Ler obrigatoriamente `references/sistema-recursorio.md` antes de iniciar.

---

## 0.1 — Leitura integral dos documentos

Ler a petição inicial, os documentos juntados e a sentença na íntegra. Extrair e organizar:

**Identificação das partes** — Recorrente (nome, qualidade processual original),
Recorrido(a) (designação, sede/morada).

**Dados do processo** — Tribunal de primeira instância, número do processo, tipo de ação.

**Sentença recorrida** — Data, dispositivo (procedência/improcedência), fundamentação
de facto (factos provados e não provados) e fundamentação de direito.

**Cronologia do caso** — desde a origem do litígio até à sentença.

---

## 0.2 — Identificação da jurisdição

Com base nos documentos, detetar automaticamente a jurisdição:

- **Administrativa** — Se o tribunal é TAF, TAC ou STA; se a legislação base é CPTA/CPA;
  se a ré é entidade pública administrativa. → Aplicar CPTA arts. 140.º-148.º.
- **Laboral** — Se o tribunal é Tribunal do Trabalho; se a matéria é contrato de trabalho,
  despedimento, créditos laborais. → Aplicar CPT arts. 79.º-81.º + CPC subsidiário.
- **Cível** — Nos demais casos. → Aplicar CPC arts. 627.º-670.º.

Confirmar com o utilizador se houver dúvida.

---

## 0.3 — Análise de viabilidade

Avaliar, com base na sentença e nos documentos:

**Legitimidade e interesse em agir** — O recorrente ficou vencido? Qual a medida da
sucumbência? (art. 631.º CPC)

**Recorribilidade da decisão** — Valor da causa e da sucumbência face às alçadas;
tipo de decisão (sentença final, despacho saneador, despacho interlocutório); casos
de irrecorribilidade (dupla conforme, art. 629.º CPC). Na jurisdição administrativa,
atenção ao art. 142.º CPTA.

**Tempestividade** — Prazo de interposição: 30 dias (CPC art. 638.º), 30 dias (CPTA
art. 144.º n.º 1), 15 dias para laborais quando aplicável art. 80.º CPT. Verificar
se está dentro do prazo.

**Planos de impugnação disponíveis**:
- *Matéria de direito* — erros de interpretação, subsunção ou aplicação da lei
- *Matéria de facto* — factos mal julgados, factos não provados que deviam estar
  provados (e vice-versa), com indicação dos meios de prova que impõem decisão diferente
  (art. 640.º CPC)

**Teses a desenvolver** — Para cada erro identificado na sentença, formular a tese
do recurso: qual o erro, qual a norma violada, qual a decisão correta que deveria ter
sido proferida.

---

## 0.4 — Output obrigatório: JSON caseData

Ao final da Fase 0, gerar um bloco JSON com os dados do caso para uso nas fases seguintes.
Este JSON é extraído automaticamente e guardado em `caseData`.

```json
{
  "jurisdicao": "administrativa | civel | laboral",
  "tribunal": "Tribunal Administrativo e Fiscal de [XX]",
  "tribunal_ad_quem": "Tribunal Central Administrativo Sul",
  "processo": "n.º 000/00.0BEXXX",
  "recorrente": {
    "nome": "NOME EM MAIÚSCULAS",
    "qualidade": "Autor / Requerente / Trabalhador"
  },
  "recorrido": {
    "nome": "NOME/DESIGNAÇÃO EM MAIÚSCULAS",
    "qualidade": "Réu / Requerido / Entidade empregadora"
  },
  "impugna_factos": true,
  "novos_meios_prova": false,
  "efeito_suspensivo": false,
  "teses": [
    "Tese 1: [descrição]",
    "Tese 2: [descrição]"
  ],
  "modules_active": [],
  "viabilidade": "viavel | viavel_com_riscos | inviavel",
  "riscos": ["risco 1", "risco 2"]
}
```

**Campos críticos**:
- `impugna_factos: true` → Fase 3 será ativada (impugnação da matéria de facto).
- `impugna_factos: false` → Fase 3 é automaticamente saltada.
- `novos_meios_prova: true` → Carregar `references/novos-meios-prova.md` na Fase 3.
- `jurisdicao` → Determina quais referências de jurisdição são carregadas na Fase 4.

---

## 0.5 — Relatório de viabilidade ao utilizador

Apresentar ao utilizador um relatório estruturado antes de aguardar aprovação:

1. **Jurisdição identificada** — administrativa / cível / laboral
2. **Admissibilidade** — recorribilidade, legitimidade, tempestividade (com datas)
3. **Riscos identificados** — eventuais fragilidades
4. **Teses do recurso** — lista numerada, plano (facto/direito), força argumentativa
5. **Estrutura proposta** — secções das alegações a desenvolver
6. **Recomendação** — viável / viável com riscos / inviável (com justificação)

Se o recurso parecer inviável ou com riscos elevados, avisar expressamente mas
prosseguir se o utilizador confirmar que quer continuar.

Aguardar aprovação antes de ativar a Fase 1.
