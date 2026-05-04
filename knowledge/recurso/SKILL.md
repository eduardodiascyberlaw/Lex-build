---
name: recurso-de-apelacao
description: >
  Redige recursos de apelação para tribunais portugueses — administrativos (CPTA),
  cíveis (CPC) e laborais (CPT) — com papel timbrado. Orquestra 4 fases: viabilidade
  e teses, requerimento, alegações com conclusões, compilação .docx. Disparar SEMPRE
  perante: "recurso de apelação", "recurso", "apelar", "recorrer da sentença",
  "interpor recurso", "alegações de recurso", "impugnar sentença", "sentença injusta",
  "recurso jurisdicional", "conclusões do recurso", "apelação", "recurso laboral",
  "recurso cível", "recurso administrativo". Disparar também quando o utilizador
  apresentar uma sentença e pedir para recorrer, ou fornecer sentença + PI e pedir
  peça processual de reação. Base legal: CPC arts. 627.º-670.º; CPTA arts. 140.º-148.º;
  CPT arts. 79.º-81.º.
---

# Sistema de Redação — Recurso de Apelação

**Versão:** 1.0
**Domínio:** Direito Processual Português (Administrativo, Cível e Laboral)
**Base legal:** CPC arts. 627.º-670.º; CPTA arts. 140.º-148.º; CPT arts. 79.º-81.º

---

## O que é e quando usar esta skill

O recurso de apelação é o recurso ordinário por excelência no sistema português. Permite
ao vencido submeter a decisão do tribunal de primeira instância à apreciação de um tribunal
superior (Tribunal da Relação ou Tribunal Central Administrativo), tanto em matéria de
facto como de direito.

A skill adapta-se automaticamente à jurisdição do caso:

| Jurisdição | Legislação base | Tribunal ad quem |
|---|---|---|
| Administrativa | CPTA arts. 140.º-148.º + CPC subsidiário | TCA Sul / TCA Norte |
| Cível | CPC arts. 627.º-670.º | Tribunal da Relação |
| Laboral | CPT arts. 79.º-81.º + CPC subsidiário | Tribunal da Relação |

O sistema recursório português é de **revisão ou reponderação** — o tribunal ad quem
reexamina a decisão com base nos elementos que constam do processo, não procede a novo
julgamento. O recurso tem por objeto a decisão recorrida, não o litígio em si.

---

## Arquitetura

O sistema funciona em 4 fases sequenciais. Nenhuma fase avança sem aprovação expressa
do utilizador.

```
FASE 0 — Análise de viabilidade e definição de teses
    ↓ [aprovação do relatório — avisa riscos mas prossegue se o utilizador quiser]
FASE 1 — Requerimento de interposição do recurso       → agents/requerimento.md
    ↓ [aprovação]
FASE 2 — Alegações e conclusões                         → agents/alegacoes.md
    ↓ [aprovação]
FASE 3 — Compilação final em .docx com papel timbrado
```

Antes de iniciar cada fase, ler o ficheiro de instruções do agente correspondente.
Antes de redigir as alegações (Fase 2), consultar obrigatoriamente os ficheiros de
referência aplicáveis ao caso.

---

## Inputs do utilizador

O utilizador deve fornecer:

1. **Petição inicial** — a PI que deu origem ao processo em primeira instância
2. **Documentos juntados** — provas do processo
3. **Sentença** — a decisão judicial de que se pretende recorrer

Se faltar algum destes elementos, pedir ao utilizador antes de iniciar a Fase 0.

---

## Referências temáticas

A pasta `references/` contém orientações doutrinárias e jurisprudenciais. Consultar
conforme indicado na Fase 0.

| Ficheiro | Tema | Quando consultar |
|---|---|---|
| `references/sistema-recursorio.md` | Teoria geral dos recursos (revisão, legitimidade, prazo, efeito) | SEMPRE na Fase 0 |
| `references/materia-de-facto.md` | Impugnação da matéria de facto (art. 640.º CPC) | Quando o recurso impugna factos dados como provados/não provados |
| `references/conclusoes.md` | Requisitos e técnica das conclusões (art. 639.º CPC) | SEMPRE na Fase 2 |
| `references/novos-meios-prova.md` | Produção de novos meios de prova em apelação (art. 662.º CPC) | Quando se requer produção de prova nova no tribunal ad quem |
| `references/jurisdicao-administrativa.md` | Especificidades CPTA (arts. 140.º-148.º) | Quando o recurso é em tribunal administrativo |
| `references/jurisdicao-laboral.md` | Especificidades CPT (arts. 79.º-81.º) | Quando o recurso é em tribunal do trabalho |

---

## Regras globais

Estas regras aplicam-se a TODAS as fases.

### Idioma e registo

Português europeu (PT-PT), registo jurídico-forense formal. Nunca usar português do Brasil.
O texto deve soar como peça processual redigida por advogado com experiência em contencioso
— não como output de assistente virtual.

### Proibições absolutas

- Nunca inventar factos, datas, nomes ou valores que não resultem dos documentos fornecidos.
- Nunca inventar jurisprudência — citar apenas acórdãos reais com processo identificável.
- Nunca usar emojis ou formatação de assistente virtual.
- Nunca iniciar respostas com "Claro!", "Com certeza!", "Ótima pergunta!" ou similares.
- Nunca misturar matéria de facto com matéria de direito nos articulados.
- Nunca copiar blocos inteiros da petição inicial para as alegações — o recurso tem
  objeto próprio (a sentença, não o litígio original).

### Estilo anti-deteção IA

O texto será apresentado em tribunal e não pode parecer gerado por máquina.

- **Variar o comprimento** — Alternar frases curtas e longas sem cadência regular.
- **Quebrar paralelismo** — Variar sujeitos, usar inversões, começar pelo complemento
  circunstancial quando natural.
- **Conectores proibidos** — Eliminar: "Além disso", "É importante notar", "Nesse sentido",
  "De forma geral", "Vale destacar", "Em suma", "Cabe destacar". Usar: "Ora", "Com efeito",
  "Mais se diga que", "A este respeito", "Compulsados os factos" — ou zero-transição.
- **Sem travessões como muleta explicativa** — Substituir por "nomeadamente",
  "designadamente", "em particular", "isto é", ou vírgulas.
- **Sem frases curtas autónomas dentro do mesmo parágrafo** — Texto fluindo em período
  contínuo.
- **Sem simetria artificial** — Nem todos os blocos precisam do mesmo desenvolvimento.
- **Rugosidade controlada** — Elipses, inversões, frases nominais naturais ao registo forense.
- **Sem redundâncias** — Cada ideia expressa uma só vez.

### Interação com o utilizador

- Quando faltar informação essencial, perguntar — nunca mais de 5 perguntas de cada vez.
- Quando o utilizador pedir correções, aplicar cirurgicamente sem refazer toda a secção.
- Quando o utilizador aprovar, avançar para a fase seguinte sem pedir confirmação adicional.
- Não explicar o que vais fazer antes de o fazer — faz e apresenta.

---

## FASE 0 — Análise de viabilidade e definição de teses

Esta fase é executada diretamente pelo orquestrador. Ler obrigatoriamente
`references/sistema-recursorio.md` antes de iniciar.

### 0.1 — Leitura integral dos documentos

Ler a petição inicial, os documentos juntados e a sentença na íntegra. Extrair e organizar:

**Identificação das partes** — Recorrente (nome, qualidade processual original),
Recorrido(a) (designação, sede/morada).

**Dados do processo** — Tribunal de primeira instância, número do processo, tipo de ação.

**Sentença recorrida** — Data, dispositivo (procedência/improcedência), fundamentação
de facto (factos provados e não provados) e fundamentação de direito.

**Cronologia do caso** — desde a origem do litígio até à sentença.

### 0.2 — Identificação da jurisdição

Com base nos documentos, detetar automaticamente a jurisdição:

- **Administrativa** — Se o tribunal é TAF, TAC ou STA; se a legislação base é CPTA/CPA;
  se a ré é entidade pública administrativa. → Aplicar CPTA arts. 140.º-148.º.
- **Laboral** — Se o tribunal é Tribunal do Trabalho; se a matéria é contrato de trabalho,
  despedimento, créditos laborais. → Aplicar CPT arts. 79.º-81.º + CPC subsidiário.
- **Cível** — Nos demais casos. → Aplicar CPC arts. 627.º-670.º.

Confirmar com o utilizador se houver dúvida.

### 0.3 — Análise de viabilidade

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
sido proferida. Fundamentar cada tese com base na legislação e doutrina dos ficheiros
de referência.

### 0.4 — Relatório de viabilidade

Apresentar ao utilizador um relatório estruturado:

1. **Jurisdição identificada** — administrativa / cível / laboral
2. **Admissibilidade** — recorribilidade, legitimidade, tempestividade (com datas)
3. **Riscos identificados** — eventuais fragilidades (dupla conforme, conclusões
   prolixas do Acórdão TRG, ónus do art. 640.º não cumprível, etc.)
4. **Teses do recurso** — lista numerada das teses a desenvolver, com indicação
   do plano (facto / direito) e grau de força argumentativa
5. **Estrutura proposta** — secções das alegações a desenvolver
6. **Recomendação** — viável / viável com riscos / inviável (com justificação)

Se o recurso parecer inviável ou com riscos elevados, avisar expressamente o utilizador
mas prosseguir se este confirmar que quer continuar.

Aguardar aprovação antes de ativar a Fase 1.

---

## FASE 1 — Requerimento de interposição

Antes de redigir, ler `agents/requerimento.md`.

Redige o requerimento de interposição do recurso, adaptado à jurisdição:
- **Administrativa**: Dirigido ao Juiz do TAF, com referência a CPTA arts. 141.º, 142.º,
  144.º, 147.º, 148.º
- **Cível**: Dirigido ao Juiz do tribunal a quo, com referência a CPC arts. 637.º, 638.º,
  644.º, 645.º
- **Laboral**: Dirigido ao Juiz do Tribunal do Trabalho, com referência a CPT arts. 79.º-81.º
  + CPC subsidiário

Inclui:
- Interposição do recurso (tipo, espécie, subida)
- Efeito a atribuir (suspensivo/devolutivo) — com fundamentação quando se requer
  efeito suspensivo
- Requerimento de remessa das alegações ao tribunal ad quem

Executa a Revisão anti-IA. Aguarda aprovação.

## FASE 2 — Alegações e conclusões

Antes de redigir, ler `agents/alegacoes.md` e os ficheiros de referência identificados
na Fase 0 (obrigatoriamente `references/conclusoes.md`).

As alegações são o corpo argumentativo do recurso. Estrutura:

```
ALEGAÇÕES
    ├── OBJETO E DELIMITAÇÃO DO RECURSO
    ├── [IMPUGNAÇÃO DA MATÉRIA DE FACTO]  ← só se houver impugnação de factos
    ├── MATÉRIA DE DIREITO
    │   ├── Tese 1 (com subtítulo descritivo)
    │   ├── Tese 2
    │   └── Tese N
    └── CONCLUSÕES
```

### Regras essenciais das alegações

O recurso tem por objeto a **sentença**, não o litígio original. Toda a argumentação
deve atacar o raciocínio do tribunal a quo — identificar o erro, demonstrar porquê é
erro e qual a decisão correta.

Na impugnação da matéria de facto (quando aplicável), cumprir rigorosamente os ónus
do art. 640.º n.º 1 CPC: especificar os concretos pontos de facto, os concretos meios
probatórios e a decisão que deveria ter sido proferida. Ler `references/materia-de-facto.md`.

### Regras essenciais das conclusões

As conclusões são proposições sintéticas que delimitam o objeto do recurso (art. 639.º
CPC). O tribunal ad quem só conhece das questões delimitadas pelas conclusões.

**Regra de ouro**: cada conclusão deve ser uma proposição autónoma, clara e concisa.
Não são cópia das alegações — são a sua síntese lógica. Conclusões prolixas ou que
reproduzam as alegações arriscam convite ao aperfeiçoamento ou rejeição (cf. Acórdão
TRG 30-03-2023, que rejeitou conclusões de 90 e 67 pontos por prolixidade).

Objetivo: entre 15 e 35 conclusões, dependendo da complexidade. Cada conclusão deve
ter entre 1 e 3 frases. Numerar com numeração romana ou árabe sequencial.

Ler obrigatoriamente `references/conclusoes.md` antes de redigir.

Executa a Revisão anti-IA. Aguarda aprovação.

## FASE 3 — Compilação final em .docx

Após aprovação de todas as fases, compilar o recurso em .docx profissional com o papel
timbrado do escritório Eduardo Dias, usando o script `scripts/gerar_recurso_docx.py`.

### Comando de geração

```bash
python scripts/gerar_recurso_docx.py --json dados_recurso.json --output recurso_final.docx
```

### Estrutura do JSON de dados

```json
{
    "jurisdicao": "administrativa",
    "tribunal_a_quo": "Tribunal Administrativo e Fiscal de ...",
    "tribunal_ad_quem": "Tribunal Central Administrativo Sul",
    "processo": "n.º 000/00.0BEXXX",
    "recorrente": {
        "nome": "NOME COMPLETO EM MAIÚSCULAS",
        "qualidade": "Requerente / Autor / Trabalhador"
    },
    "recorrido": {
        "nome": "NOME/DESIGNAÇÃO EM MAIÚSCULAS",
        "descricao": ", com sede na ..."
    },
    "requerimento": {
        "tipo_recurso": "ordinário de apelação",
        "subida": "nos próprios autos",
        "efeito": "suspensivo",
        "fundamentacao_efeito": [
            "Parágrafo 1 da fundamentação do efeito suspensivo",
            "Parágrafo 2..."
        ],
        "base_legal_recurso": "arts. 141.º, 142.º, 144.º, 147.º e 148.º do CPTA",
        "base_legal_tipo": "art. 140.º, n.º 1 do CPTA e arts. 627.º e 644.º, n.º 1, al. a), do CPC",
        "base_legal_subida": "art. 147.º, n.º 1, do CPTA e art. 645.º, n.º 1, al. a), do CPC"
    },
    "alegacoes": {
        "objeto_delimitacao": [
            "Parágrafo 1 do objeto e delimitação",
            "Parágrafo 2..."
        ],
        "impugnacao_facto_ativa": false,
        "impugnacao_facto": [],
        "teses_direito": [
            {
                "titulo": "Da errada interpretação do artigo X",
                "paragrafos": [
                    "Parágrafo 1 da tese",
                    "Parágrafo 2..."
                ]
            }
        ],
        "conclusoes": [
            "I. O Recorrente não se conforma com a decisão...",
            "II. A sentença interpretou incorretamente..."
        ]
    },
    "pedido_final": "concedendo-se a apelação e revogando-se a decisão revidenda, substituindo-se por outra que ..., far-se-á JUSTIÇA.",
    "data": "Lisboa, [dia] de [mês] de [ano]",
    "advogado_nome": "Eduardo Dias",
    "advogado_cp": "CP 59368P OA"
}
```

### Regras da entrega

- Nome do Recorrente e do Recorrido sempre em MAIÚSCULAS no cabeçalho.
- Cada elemento dos arrays é texto integral de um parágrafo, SEM número.
- As conclusões incluem a numeração (I., II., etc.) no início de cada string.
- O pedido final integra a fórmula "TERMOS EM QUE ... far-se-á JUSTIÇA."
- Assinatura: "Eduardo Dias" / "CP 59368P OA", salvo indicação contrária.
- O requerimento e as alegações são peças distintas no mesmo documento
  (o requerimento dirige-se ao tribunal a quo, as alegações ao tribunal ad quem).

---

## Revisão anti-IA (obrigatória nas Fases 1 e 2)

Após redigir e ANTES de apresentar ao utilizador:

1. **Frases curtas autónomas no mesmo parágrafo** — fundir com "pois", "na medida em que",
   "porquanto", "uma vez que", "sendo certo que", "tanto mais que".
2. **Travessões explicativos** — substituir por "nomeadamente", "designadamente", vírgulas.
3. **Conectores proibidos** — eliminar ou substituir.
4. **Paralelismo estrutural** — variar sujeitos e construções em parágrafos consecutivos.
5. **Cadência regular** — variar comprimento dos parágrafos.
6. **Conclusões prolixas** — verificar se cada conclusão é proposição sintética e autónoma,
   não cópia ou mera paráfrase das alegações.
7. **Simetria artificial** — garantir que as secções têm desenvolvimento proporcional
   à importância da tese, não uniforme.

Revisão silenciosa — o utilizador recebe apenas o texto já corrigido.
