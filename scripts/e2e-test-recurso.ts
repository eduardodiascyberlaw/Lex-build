/**
 * End-to-end smoke test for RECURSO DE APELAÇÃO pipeline.
 *
 * What it does:
 *  1. Wipes test user data (if exists)
 *  2. Creates a test User with encrypted API key placeholder
 *  3. Loads the cautelar template .docx into PG bytea (Template)
 *  4. Creates a Peca RECURSO + caseData (impugna_factos: false → phase 3 skipped)
 *  5. Creates Phases 1, 2, 4, 5 with realistic forensic Portuguese text
 *  6. Runs generateDocx()
 *  7. Reads peca.outputBytes, writes to D:/tmp/recurso-test.docx
 *  8. Prints a summary
 *
 * Run: DATABASE_URL=... npx tsx scripts/e2e-test-recurso.ts
 */
// Load .env.local before importing modules that read env vars
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { prisma } from "../src/lib/prisma";
import { generateDocx } from "../src/lib/docx-generator";
import { encrypt } from "../src/lib/encryption";
import { readFile, writeFile, mkdir } from "fs/promises";
import { hash } from "bcrypt";
import { join } from "path";

const TEST_EMAIL = "e2e-test@lexbuild.local";
const TEMPLATE_SOURCE = join(
  process.cwd(),
  "knowledge",
  "cautelar",
  "assets",
  "template-cautelar.docx"
);
const OUTPUT_PATH = "D:/tmp/recurso-test.docx";

const FASE_1_REQUERIMENTO = `
Exmo. Senhor
Juiz do Tribunal Administrativo e Fiscal de Lisboa

Processo n.º 1234/25.0BELSB

JOÃO MANUEL DA SILVA, Autor nos autos à margem referenciados, notificado da sentença proferida nestes autos em 14 de janeiro de 2026, pela qual foi julgada improcedente a ação e mantido o indeferimento da autorização de residência requerida junto da Agência para a Integração, Migrações e Asilo, I.P. (AIMA), vem interpor

RECURSO

nos termos e com os fundamentos seguintes:

Não se conformando com a decisão proferida, por entender que a sentença recorrida incorre em erro de direito ao validar um ato administrativo que padece de insuficiência de fundamentação, nos termos dos artigos 152.º e 153.º do Código do Procedimento Administrativo e do artigo 268.º, n.º 4, da Constituição da República Portuguesa, o Recorrente interpõe o presente recurso.

O presente recurso é um recurso ordinário de apelação, nos termos do artigo 140.º, n.º 1, do CPTA, com aplicação subsidiária dos artigos 627.º e 644.º, n.º 1, alínea a), do CPC, dirigido ao Tribunal Central Administrativo Sul, enquanto tribunal ad quem competente.

O recurso sobe nos próprios autos, por se tratar de sentença final proferida em primeira instância, em conformidade com o disposto no artigo 147.º, n.º 1, do CPTA e no artigo 645.º, n.º 1, alínea a), do CPC.

Quanto à tempestividade, a sentença foi notificada ao Recorrente em 14 de janeiro de 2026, e o presente requerimento é apresentado em 12 de fevereiro de 2026, dentro do prazo de 30 dias previsto no artigo 144.º, n.º 1, do CPTA.

Em cumprimento do disposto no artigo 144.º, n.º 2, do CPTA, seguem, em anexo, as alegações do recurso ora interposto.

Ao presente recurso deve ser atribuído efeito devolutivo, nos termos do artigo 143.º do CPTA.
`.trim();

const FASE_2_OBJETO = `
1.º O presente recurso tem por objeto a sentença proferida pelo Tribunal Administrativo e Fiscal, que julgou improcedente a ação administrativa intentada por João Manuel da Silva contra a Agência para a Integração, Migrações e Asilo (doravante AIMA), mantendo o ato de indeferimento da autorização de residência que esta entidade havia praticado. É dessa decisão que ora se recorre para esse Venerando Tribunal.

2.º Visou o recorrente, em primeira instância, obter a anulação do ato administrativo pelo qual a AIMA indeferiu o pedido de autorização de residência, invocando, para o efeito, a nulidade ou a anulabilidade do mesmo por insuficiência de fundamentação, nos termos dos artigos 152.º e 153.º do Código do Procedimento Administrativo e do artigo 268.º, n.º 4, da Constituição da República Portuguesa. O Tribunal a quo, porém, julgou improcedente esse pedido, entendendo, em síntese, que o ato impugnado cumpria os requisitos legais de fundamentação exigíveis.

3.º O presente recurso circunscreve-se inteiramente à matéria de direito. O recorrente aceita a matéria de facto dada como provada e não provada pelo douto Tribunal de primeira instância, não impugnando o probatório fixado na sentença recorrida. As questões submetidas à apreciação de VV. Exas. são exclusivamente jurídicas.

4.º A questão central que o recurso coloca é a de saber se a sentença revidenda errou ao qualificar como suficientemente fundamentado o ato administrativo praticado pela AIMA. O recorrente entende que o Tribunal a quo, com a devida vénia, interpretou de forma incorreta os requisitos de fundamentação consagrados nos artigos 152.º e 153.º do CPA, e que essa interpretação afronta o direito fundamental à fundamentação dos atos administrativos lesivos, consagrado no artigo 268.º, n.º 4, da Constituição.

5.º Nos termos do disposto no artigo 635.º, n.º 4, do Código de Processo Civil, aplicável subsidiariamente por força do artigo 140.º, n.º 3, do CPTA, o objeto do presente recurso fica delimitado às questões enunciadas, sendo as demais, incluindo as que não foram objeto de impugnação pelo recorrente, consideradas aceites nos seus precisos termos.
`.trim();

const FASE_4_DIREITO = `
5.º O Tribunal a quo, ao concluir pela suficiência da fundamentação constante do ato impugnado, incorreu em erro de interpretação e aplicação do direito, porquanto desconsiderou o padrão normativo que os artigos 152.º e 153.º do Código do Procedimento Administrativo e o artigo 268.º, n.º 3, da Constituição da República Portuguesa impõem como condição de validade dos atos administrativos restritivos de direitos. A decisão revidenda limitou-se a afirmar que a indicação da norma habilitante bastava para fundamentar o indeferimento da autorização de residência, sem ponderar se essa remissão normativa, desacompanhada de qualquer subsunção factual, satisfaz a exigência constitucional e legal de revelação do iter decisório do órgão administrativo. Salvo o devido respeito, tal entendimento não pode ser sufragado.

6.º O ato de indeferimento objeto dos presentes autos limita-se a invocar genericamente a alínea f) do n.º 1 do artigo 134.º da Lei n.º 23/2007, de 4 de julho, sem que em parte alguma do texto decisório se identifiquem os factos concretos que o órgão administrativo considerou verificados, a valoração jurídica que deles fez, nem a razão pela qual esses factos se enquadram na previsão da referida alínea. Não há qualquer menção ao percurso de vida do Recorrente, às condições familiares, ao tempo de permanência em território nacional, nem a qualquer circunstância individualizante. O ato é, na prática, uma fórmula estereotipada que poderia ser aposta a qualquer indeferimento do mesmo tipo, o que demonstra, à saciedade, que a motivação formal existe mas a fundamentação substancial está ausente.

7.º A distinção entre ausência formal e insuficiência substancial de fundamentação não tem, nesta matéria, a relevância que o Tribunal a quo lhe atribuiu, porquanto a jurisprudência do Supremo Tribunal Administrativo consolidou o entendimento de que a fundamentação insuficiente equivale, para efeitos de invalidade, à falta de fundamentação. Com efeito, o STA, em acórdão de 14 de março de 2018, proferido no processo n.º 0123/17, enunciou que a fundamentação que não permite ao destinatário conhecer as razões concretas da decisão, reconstituindo o iter lógico do decisor, é juridicamente inexistente, por não cumprir a função para que foi exigida. No mesmo sentido pronunciou-se o STA em acórdão de 22 de novembro de 2016, processo n.º 0987/15, ao afirmar que a menção da norma habilitante, desacompanhada de qualquer enunciação factual, não constitui fundamentação válida, tratando-se de simples aparência de motivação. A sentença revidenda não considerou esta linha jurisprudencial, razão pela qual a sua conclusão não encontra apoio na ordem jurídica vigente.

8.º O artigo 153.º do CPA é, a este propósito, inequívoco: a fundamentação deve ser expressa, clara, suficiente e congruente, devendo conter a enunciação das razões de facto e de direito que determinaram a decisão, bem como a ponderação dos interesses públicos e privados em presença, nos termos do artigo 152.º, n.º 1, do mesmo Código. A exigência não é meramente formal, tendo conteúdo substantivo que o Tribunal Constitucional densificou ao declarar que a garantia constitucional prevista no artigo 268.º, n.º 3, da CRP impõe que o cidadão possa conhecer os motivos específicos que levaram a Administração a decidir de determinado modo, de forma a poder sindicar a decisão, designadamente pela via jurisdicional. Um ato que se limita a citar a norma que abstractamente autorizaria o indeferimento, sem demonstrar que os pressupostos dessa norma se encontram preenchidos no caso concreto, impede essa sindicância e viola, por conseguinte, um direito fundamental de natureza análoga aos direitos liberdades e garantias.

9.º A consequência jurídica da fundamentação inexistente ou substancialmente insuficiente é a anulabilidade do ato nos termos do artigo 163.º, n.º 1, do CPA, que comina com essa forma de invalidade os atos praticados em violação de lei. Decorre da conjugação das normas invocadas que o ato de indeferimento da autorização de residência padece de vício gerador de anulabilidade, devendo ser anulado com as inerentes consequências repristinatórias. A sentença recorrida, ao validar um ato nessas condições, fez errada aplicação do direito aos factos provados, incorrendo no erro de julgamento que motiva o presente recurso. Cabe a esse Venerando Tribunal revogar a decisão revidenda e, em substituição, declarar a ilegalidade do ato impugnado por insuficiência de fundamentação, com as consequências legais daí decorrentes, nomeadamente a anulação do ato e a condenação da entidade demandada à nova apreciação do pedido com fundamentação bastante.
`.trim();

const FASE_5_CONCLUSOES = `
I. O presente recurso tem por objeto a sentença proferida pelo Tribunal a quo que julgou improcedente a ação, mantendo o ato administrativo impugnado, cujo fundamento essencial assenta numa errada aplicação das normas que regem o dever de fundamentação dos atos administrativos.

II. O ato administrativo sub judice padece de insuficiência de fundamentação, pois o seu conteúdo não permite ao destinatário reconstruir o iter cognoscitivo e valorativo que conduziu à decisão, em violação do disposto nos arts. 152.º e 153.º do CPA.

III. A jurisprudência consolidada dos Tribunais Centrais Administrativos equipara a fundamentação insuficiente à falta de fundamentação para efeitos de invalidade, devendo o vício ser qualificado como anulabilidade nos termos do art. 163.º do CPA; a sentença recorrida desconsiderou este enquadramento, incorrendo em errada subsunção jurídica.

IV. O direito constitucionalmente garantido à fundamentação dos atos administrativos lesivos, consagrado no art. 268.º n.º 4 da CRP, foi violado pelo ato impugnado, e a sentença revidenda, ao manter tal ato na ordem jurídica, perpetuou a lesão desse direito fundamental de caráter procedimental.

V. A decisão recorrida errou no julgamento de direito ao não decretar a anulação do ato com fundamento no vício de forma que inquina a fundamentação, impondo-se a sua revogação e substituição por outra que reconheça a invalidade e ordene a anulação do ato.
`.trim();

async function main() {
  console.log("[1/7] Limpando dados antigos do user de teste...");
  const old = await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } });
  if (old) {
    const pecas = await prisma.peca.findMany({ where: { userId: old.id }, select: { id: true } });
    for (const p of pecas) {
      await prisma.message.deleteMany({ where: { pecaId: p.id } });
      await prisma.phase.deleteMany({ where: { pecaId: p.id } });
      await prisma.pecaUpload.deleteMany({ where: { pecaId: p.id } });
    }
    await prisma.peca.deleteMany({ where: { userId: old.id } });
    await prisma.template.deleteMany({ where: { userId: old.id } });
    await prisma.user.delete({ where: { id: old.id } });
  }

  console.log("[2/7] Criando user de teste...");
  const passwordHash = await hash("test-password-not-real", 12);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Eduardo S Dias (E2E)",
      cpOA: "CP 59368P OA",
      firmName: "Escritório de Teste",
      apiKeyEnc: encrypt("sk-ant-fake-key-for-e2e-only"),
      model: "claude-sonnet-4-20250514",
    },
  });
  console.log(`    user.id = ${user.id}`);

  console.log("[3/7] Carregando template .docx para PG bytea...");
  const templateBytes = await readFile(TEMPLATE_SOURCE);
  const template = await prisma.template.create({
    data: {
      userId: user.id,
      name: "Template E2E",
      bytes: templateBytes,
      filename: "template-cautelar.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      isActive: true,
    },
    select: { id: true, filename: true },
  });
  console.log(`    template.id = ${template.id} (${templateBytes.length} bytes)`);

  console.log("[4/7] Criando Peca RECURSO + caseData (impugna_factos: false → F3 skipped)...");
  const peca = await prisma.peca.create({
    data: {
      userId: user.id,
      type: "RECURSO",
      status: "GENERATING_DOCX",
      currentPhase: 5,
      model: user.model,
      caseData: {
        tribunal: "Tribunal Administrativo e Fiscal de Lisboa",
        tribunal_ad_quem: "Tribunal Central Administrativo Sul",
        processo: "1234/25.0BELSB",
        jurisdicao: "administrativa",
        recorrente: { nome: "JOÃO MANUEL DA SILVA", qualidade: "Autor" },
        recorrido: {
          nome: "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
          qualidade: "Réu",
        },
        impugna_factos: false,
      },
    },
  });
  console.log(`    peca.id = ${peca.id}`);

  console.log("[5/7] Criando Phases 1, 2, (3 skipped), 4, 5 com texto realista PT-PT forense...");
  const phases = [
    { number: 1, status: "APPROVED" as const, content: FASE_1_REQUERIMENTO },
    { number: 2, status: "APPROVED" as const, content: FASE_2_OBJETO },
    { number: 3, status: "SKIPPED" as const, content: null },
    { number: 4, status: "APPROVED" as const, content: FASE_4_DIREITO },
    { number: 5, status: "APPROVED" as const, content: FASE_5_CONCLUSOES },
  ];
  for (const p of phases) {
    await prisma.phase.create({
      data: {
        pecaId: peca.id,
        number: p.number,
        status: p.status,
        content: p.content,
        approvedAt: p.status === "APPROVED" ? new Date() : null,
      },
    });
  }
  console.log(`    fases criadas: 1, 2, 4, 5 (APPROVED) + 3 (SKIPPED)`);

  console.log("[6/7] Chamando generateDocx() — aciona Python script...");
  const filename = await generateDocx({ pecaId: peca.id, userId: user.id });
  console.log(`    filename = ${filename}`);

  console.log("[7/7] Lendo outputBytes e gravando .docx em " + OUTPUT_PATH + "...");
  const result = await prisma.peca.findUniqueOrThrow({
    where: { id: peca.id },
    select: { outputBytes: true, outputFilename: true, outputMimeType: true, status: true },
  });
  if (!result.outputBytes) {
    throw new Error("outputBytes está vazio depois de generateDocx — algo correu mal");
  }
  await mkdir("D:/tmp", { recursive: true });
  await writeFile(OUTPUT_PATH, Buffer.from(result.outputBytes));

  console.log("\n=== RESULTADO ===");
  console.log(`peca.id           = ${peca.id}`);
  console.log(`peca.status       = ${result.status}`);
  console.log(`outputFilename    = ${result.outputFilename}`);
  console.log(`outputMimeType    = ${result.outputMimeType}`);
  console.log(`outputBytes size  = ${result.outputBytes.length} bytes`);
  console.log(`saved to          = ${OUTPUT_PATH}`);
  console.log("\nAbre o ficheiro em Word e valida visualmente.");
}

main()
  .catch((err) => {
    console.error("E2E test FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
