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
JOÃO MANUEL DA SILVA, recorrente nos autos à margem identificados, vem, nos termos e ao abrigo do disposto nos arts. 140.º, n.º 1, alínea a) e 144.º do Código de Processo nos Tribunais Administrativos (CPTA), interpor

RECURSO DE APELAÇÃO

para o Tribunal Central Administrativo Sul, da douta sentença proferida em 12 de janeiro de 2026, que julgou improcedente a ação intentada contra a AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P. (AIMA), o que faz nos termos e com os fundamentos seguintes.

O presente recurso é tempestivo, nos termos do art. 144.º, n.º 1 do CPTA, tendo a sentença sido notificada ao recorrente em 14 de janeiro de 2026 e o presente requerimento sido apresentado dentro do prazo legal de trinta dias.

A sentença recorrida violou as regras de direito aplicáveis, designadamente o disposto nos arts. 121.º e 153.º do Código do Procedimento Administrativo (CPA), e art. 268.º, n.º 4 da Constituição da República Portuguesa.
`.trim();

const FASE_2_OBJETO = `
1.º
O presente recurso tem por objeto a impugnação da sentença proferida pelo Tribunal Administrativo e Fiscal de Lisboa, na parte em que julgou improcedente o pedido de anulação do ato administrativo que indeferiu a concessão de autorização de residência ao recorrente.

2.º
O recorrente delimita o objeto do recurso à reapreciação da matéria de direito, sustentando que a sentença recorrida fez errada interpretação e aplicação dos arts. 121.º e 153.º do CPA, no que respeita à fundamentação do ato administrativo impugnado.

3.º
Não se impugna a matéria de facto fixada em primeira instância, aceitando-se integralmente o probatório constante da sentença recorrida.

4.º
A questão a decidir circunscreve-se a saber se a fundamentação aduzida pelo ato impugnado preenche os requisitos legais de suficiência, clareza e congruência exigidos pelos arts. 152.º e 153.º do CPA.
`.trim();

const FASE_4_DIREITO = `
5.º
A fundamentação do ato administrativo constitui requisito essencial à sua validade, nos termos do art. 152.º do CPA, pelo que a sua falta ou insuficiência determina a anulabilidade do ato, conforme decorre do art. 163.º do mesmo Código.

6.º
O dever de fundamentação radica na exigência de transparência da actuação administrativa e visa permitir ao destinatário do acto compreender as razões de facto e de direito que conduziram à decisão, possibilitando-lhe o exercício efetivo do direito de impugnação, conforme estatui o art. 268.º, n.º 4 da Constituição da República Portuguesa.

7.º
No caso concreto, o ato impugnado limita-se a invocar genericamente a alínea f) do n.º 1 do art. 134.º da Lei n.º 23/2007, de 4 de julho, sem identificar os factos concretos que constituíriam o pressuposto da sua aplicação, omitindo o nexo entre a previsão legal e a situação individual do recorrente.

8.º
Tal modo de fundamentar o ato é equivalente, em termos jurídicos, à sua falta, conforme jurisprudência consolidada do Supremo Tribunal Administrativo, nomeadamente no acórdão de 14 de março de 2018, processo n.º 0123/17, em que se firmou o entendimento de que a remissão para preceitos legais sem subsunção dos factos não satisfaz o dever de fundamentação.

9.º
A sentença recorrida, ao concluir pela suficiência da fundamentação, fez errada aplicação do direito aos factos provados, devendo, por essa razão, ser revogada e substituída por decisão que anule o ato administrativo impugnado.
`.trim();

const FASE_5_CONCLUSOES = `
a) O presente recurso é tempestivo, tendo o recorrente cumprido o prazo legal de trinta dias previsto no art. 144.º, n.º 1 do CPTA;

b) A sentença recorrida violou os arts. 152.º e 153.º do CPA, ao considerar suficiente uma fundamentação que se limitou à invocação genérica de preceito legal, sem identificação dos factos concretos;

c) A insuficiência de fundamentação equivale à sua falta, determinando a anulabilidade do ato administrativo nos termos do art. 163.º do CPA;

d) Em consequência, deve a sentença recorrida ser revogada e substituída por decisão que anule o ato administrativo impugnado, com as legais consequências.

Termos em que requer a V. Exas. se dignem julgar o presente recurso procedente, revogando a sentença recorrida e ordenando a anulação do ato administrativo impugnado.
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
