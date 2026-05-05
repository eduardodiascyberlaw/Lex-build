import { execFile } from "child_process";
import { writeFile, mkdir, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const execFileAsync = promisify(execFile);
const logger = createLogger("docx-generator");
const pythonBin = () => process.env.PYTHON_BIN ?? "python3";

const SCRIPT_PATH = join(process.cwd(), "knowledge", "acpad", "scripts", "gerar_docx.py");
const CAUTELAR_SCRIPT_PATH = join(
  process.cwd(),
  "knowledge",
  "cautelar",
  "scripts",
  "gerar_docx.py"
);
const EXECUCAO_SCRIPT_PATH = join(
  process.cwd(),
  "knowledge",
  "execucao",
  "scripts",
  "gerar_execucao.py"
);
const RECURSO_SCRIPT_PATH = join(
  process.cwd(),
  "knowledge",
  "recurso",
  "scripts",
  "gerar_recurso_docx.py"
);

interface DocxInput {
  pecaId: string;
  userId: string;
}

/**
 * Generate the final .docx for a completed ACPAD peca.
 *
 * 1. Builds JSON from approved phases + caseData + user profile
 * 2. Downloads user template from S3
 * 3. Calls python3 gerar_docx.py
 * 4. Uploads result to S3
 * 5. Updates Peca record
 */
export async function generateDocx(input: DocxInput): Promise<string> {
  const { pecaId, userId } = input;

  // Load peca with phases and user (template bytes loaded explicitly)
  const peca = await prisma.peca.findFirstOrThrow({
    where: { id: pecaId, userId },
    include: {
      phases: { where: { status: "APPROVED" }, orderBy: { number: "asc" } },
      user: {
        select: {
          name: true,
          cpOA: true,
          templates: {
            where: { isActive: true },
            take: 1,
            select: { id: true, bytes: true, filename: true, mimeType: true },
          },
        },
      },
    },
  });

  // Dispatch CAUTELAR to dedicated generator
  if (peca.type === "CAUTELAR") {
    return generateCautelarDocx(pecaId, userId);
  }

  // Dispatch EXECUCAO to dedicated generator
  if (peca.type === "EXECUCAO") {
    return generateExecucaoDocx(pecaId, userId);
  }

  // Dispatch RECURSO to dedicated generator
  if (peca.type === "RECURSO") {
    return generateRecursoDocx(pecaId, userId);
  }

  const caseData = peca.caseData as Record<string, unknown> | null;
  if (!caseData) {
    throw new Error("Peca has no caseData (Phase 0 not completed)");
  }

  // Get approved phase content by number
  const phaseContent: Record<number, string> = {};
  for (const phase of peca.phases) {
    if (phase.content) {
      phaseContent[phase.number] = phase.content;
    }
  }

  // Parse content into article arrays
  const pressupostos = parseArticles(phaseContent[1] ?? "");
  const factos = parseArticles(phaseContent[2] ?? "");
  const tempestividade = caseData.tempestividade_ativa ? parseArticles(phaseContent[3] ?? "") : [];
  const direito = parseArticles(phaseContent[4] ?? "");

  // Build JSON payload for gerar_docx.py
  const docxData = {
    tribunal: caseData.tribunal ?? "Tribunal Administrativo e Fiscal de Lisboa",
    processo_cautelar: caseData.processo_cautelar ?? null,
    autor: caseData.autor ?? { nome: "AUTOR", descricao: "" },
    re: caseData.re ?? {
      nome: "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
      descricao: ", com sede na Avenida António Augusto de Aguiar, 20, 1069-119 Lisboa",
    },
    tipo_acao: (caseData.tipo_acao as string) ?? "AÇÃO DE CONDENAÇÃO À PRÁTICA DE ATO DEVIDO",
    base_legal:
      (caseData.base_legal as string) ?? "nos termos do disposto no art. 66.º, n.º 1 e 2, do CPTA",
    pressupostos,
    factos,
    tempestividade_ativa: !!caseData.tempestividade_ativa,
    tempestividade,
    direito_inicio_artigo: pressupostos.length + factos.length + tempestividade.length + 1,
    direito,
    pedidos_abertura:
      "Termos em que requer a V. Exa. se digne julgar a presente ação procedente e provada e, em consequência:",
    pedidos: parsePedidos(phaseContent[5] ?? ""),
    prova_documental:
      "Os documentos juntos aos presentes autos, que se dão por integralmente reproduzidos.",
    prova_testemunhal:
      (caseData.prova_testemunhal as Array<{ nome: string; morada: string; facto: string }>) ?? [],
    prova_pericial: (caseData.prova_pericial as string) ?? null,
    valor_causa: "30.000,01 euros (art. 34.º, n.º 2, do CPTA)",
    documentos: (caseData.documentos as string[]) ?? [],
    data: formatDate(),
    advogado_nome: peca.user.name ?? "Eduardo S Dias",
    advogado_cp: peca.user.cpOA ?? "CP 59368P OA",
  };

  // Create temp directory
  const tempDir = join(tmpdir(), `lexbuild-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const jsonPath = join(tempDir, "dados.json");
  const templatePath = join(tempDir, "template.docx");
  const outputPath = join(tempDir, "acpad_final.docx");

  try {
    // Write JSON
    await writeFile(jsonPath, JSON.stringify(docxData, null, 2), "utf-8");

    // Load template from PG bytea
    const template = peca.user.templates[0];
    if (!template) {
      throw new Error("Utilizador não tem template .docx configurado. Faça upload em Definições.");
    }
    await writeFile(templatePath, Buffer.from(template.bytes));

    // Run python script
    const { stdout, stderr } = await execFileAsync(
      pythonBin(),
      [SCRIPT_PATH, "--json", jsonPath, "--template", templatePath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) {
      logger.warn({ stderr }, "gerar_docx.py stderr");
    }
    logger.info({ stdout: stdout.trim() }, "DOCX generated");

    // Read output and persist to PG bytea
    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const filename = `acpad_${pecaId}.docx`;

    await prisma.peca.update({
      where: { id: pecaId },
      data: {
        outputBytes: docxBuffer,
        outputFilename: filename,
        outputMimeType: DOCX_MIME,
        status: "COMPLETED",
      },
    });

    logger.info({ pecaId, size: docxBuffer.length }, "DOCX persisted and peca completed");
    return filename;
  } catch (err) {
    // Mark as error
    await prisma.peca.update({
      where: { id: pecaId },
      data: { status: "ERROR" },
    });
    logger.error({ err, pecaId }, "DOCX generation failed");
    throw err;
  } finally {
    // Cleanup temp files
    try {
      await unlink(jsonPath).catch(() => {});
      await unlink(templatePath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Generate the final .docx for a completed CAUTELAR peca.
 *
 * Uses built-in template (no user template needed).
 * Phases: 2=factos, 4=direito, 5=pedidos (phases 1,3 skipped).
 */
async function generateCautelarDocx(pecaId: string, userId: string): Promise<string> {
  const peca = await prisma.peca.findFirstOrThrow({
    where: { id: pecaId, userId },
    include: {
      phases: { where: { status: "APPROVED" }, orderBy: { number: "asc" } },
      user: { select: { name: true, cpOA: true } },
    },
  });

  const caseData = peca.caseData as Record<string, unknown> | null;
  if (!caseData) {
    throw new Error("Peca has no caseData (Phase 0 not completed)");
  }

  const phaseContent: Record<number, string> = {};
  for (const phase of peca.phases) {
    if (phase.content) {
      phaseContent[phase.number] = phase.content;
    }
  }

  const factos = parseArticles(phaseContent[2] ?? "");
  const direito = parseArticles(phaseContent[4] ?? "");

  const docxData = {
    tribunal: (caseData.tribunal as string) ?? "Tribunal Administrativo e Fiscal de Lisboa",
    juizo:
      (caseData.juizo as string) ?? "Exmo. Senhor Juiz de Direito do Juízo Administrativo Comum",
    requerente: caseData.requerente ?? { nome: "REQUERENTE", descricao: "" },
    requerida: caseData.requerida ?? {
      nome: "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
      descricao: ", com sede na Avenida António Augusto de Aguiar, 20, 1069-119 Lisboa",
    },
    tipo_acao: (caseData.tipo_acao as string) ?? "PROVIDÊNCIA CAUTELAR",
    subtipo_acao:
      (caseData.subtipo_acao as string) ?? "DE SUSPENSÃO DE EFICÁCIA DE ATO ADMINISTRATIVO",
    requisitos_114: caseData.requisitos_114 ?? {},
    factos,
    direito_inicio_artigo: factos.length + 1,
    direito,
    pedidos_abertura:
      (caseData.pedidos_abertura as string) ??
      "Nestes termos e nos melhores de direito que V. Exa. doutamente suprirá, requer-se:",
    pedidos: parsePedidos(phaseContent[5] ?? ""),
    valor_causa: (caseData.valor_causa as string) ?? "30.000,01 euros",
    prova: caseData.prova ?? {
      documental:
        "Os documentos juntos aos presentes autos, que se dão por integralmente reproduzidos.",
    },
    documentos: (caseData.documentos as string[]) ?? [],
    data: formatDate(),
    advogado_nome: peca.user.name ?? "Eduardo S Dias",
    advogado_cp: peca.user.cpOA ?? "CP 59368P OA",
  };

  const tempDir = join(tmpdir(), `lexbuild-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const jsonPath = join(tempDir, "dados.json");
  const outputPath = join(tempDir, "cautelar_final.docx");

  try {
    await writeFile(jsonPath, JSON.stringify(docxData, null, 2), "utf-8");

    // Cautelar uses built-in template — no user template download needed
    const { stdout, stderr } = await execFileAsync(
      pythonBin(),
      [CAUTELAR_SCRIPT_PATH, "--json", jsonPath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) {
      logger.warn({ stderr }, "gerar_docx.py (cautelar) stderr");
    }
    logger.info({ stdout: stdout.trim() }, "CAUTELAR DOCX generated");

    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const filename = `cautelar_${pecaId}.docx`;

    await prisma.peca.update({
      where: { id: pecaId },
      data: {
        outputBytes: docxBuffer,
        outputFilename: filename,
        outputMimeType: DOCX_MIME,
        status: "COMPLETED",
      },
    });

    logger.info({ pecaId, size: docxBuffer.length }, "CAUTELAR DOCX persisted and peca completed");
    return filename;
  } catch (err) {
    await prisma.peca.update({
      where: { id: pecaId },
      data: { status: "ERROR" },
    });
    logger.error({ err, pecaId }, "CAUTELAR DOCX generation failed");
    throw err;
  } finally {
    try {
      await unlink(jsonPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Generate the final .docx for a completed EXECUCAO peca.
 *
 * Uses built-in template (no user template needed).
 * Phases: 1=sentenca_exequenda, 2=incumprimento, 4=direito, 5=pedidos (phase 3 skipped).
 */
async function generateExecucaoDocx(pecaId: string, userId: string): Promise<string> {
  const peca = await prisma.peca.findFirstOrThrow({
    where: { id: pecaId, userId },
    include: {
      phases: { where: { status: "APPROVED" }, orderBy: { number: "asc" } },
      user: { select: { name: true, cpOA: true } },
    },
  });

  const caseData = peca.caseData as Record<string, unknown> | null;
  if (!caseData) {
    throw new Error("Peca has no caseData (Phase 0 not completed)");
  }

  const phaseContent: Record<number, string> = {};
  for (const phase of peca.phases) {
    if (phase.content) {
      phaseContent[phase.number] = phase.content;
    }
  }

  const sentenca_exequenda = parseArticles(phaseContent[1] ?? "");
  const incumprimento = parseArticles(phaseContent[2] ?? "");
  const direito = parseArticles(phaseContent[4] ?? "");

  const docxData = {
    tribunal: (caseData.tribunal as string) ?? "Tribunal Administrativo e Fiscal de Lisboa",
    processo: (caseData.processo as string) ?? "",
    exequente: caseData.exequente ?? { nome: "EXEQUENTE", descricao: "" },
    tipo_requerimento: "EXECUÇÃO DE SENTENÇA",
    sentenca_exequenda,
    incumprimento,
    direito,
    pedidos_abertura:
      (caseData.pedidos_abertura as string) ?? "Termos em que requer a V. Exa. se digne:",
    pedidos: parsePedidos(phaseContent[5] ?? ""),
    documentos: (caseData.documentos as string[]) ?? [],
    data: formatDate(),
    advogado_nome: peca.user.name ?? "Eduardo S Dias",
    advogado_cp: peca.user.cpOA ?? "CP 59368P OA",
  };

  const tempDir = join(tmpdir(), `lexbuild-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const jsonPath = join(tempDir, "dados.json");
  const outputPath = join(tempDir, "execucao_final.docx");

  try {
    await writeFile(jsonPath, JSON.stringify(docxData, null, 2), "utf-8");

    // EXECUCAO uses built-in template — no user template download needed
    const { stdout, stderr } = await execFileAsync(
      pythonBin(),
      [EXECUCAO_SCRIPT_PATH, "--json", jsonPath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) {
      logger.warn({ stderr }, "gerar_execucao.py stderr");
    }
    logger.info({ stdout: stdout.trim() }, "EXECUCAO DOCX generated");

    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const filename = `execucao_${pecaId}.docx`;

    await prisma.peca.update({
      where: { id: pecaId },
      data: {
        outputBytes: docxBuffer,
        outputFilename: filename,
        outputMimeType: DOCX_MIME,
        status: "COMPLETED",
      },
    });

    logger.info({ pecaId, size: docxBuffer.length }, "EXECUCAO DOCX persisted and peca completed");
    return filename;
  } catch (err) {
    await prisma.peca.update({
      where: { id: pecaId },
      data: { status: "ERROR" },
    });
    logger.error({ err, pecaId }, "EXECUCAO DOCX generation failed");
    throw err;
  } finally {
    try {
      await unlink(jsonPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Split free-form phase content into paragraphs (separated by blank lines).
 */
function paraSplit(content: string): string[] {
  if (!content.trim()) return [];
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Parse phase content into individual article texts.
 * Articles are separated by "X.º" patterns (ordinal numbering).
 */
function parseArticles(content: string): string[] {
  if (!content.trim()) return [];

  // Split on article numbers (1.º, 2.º, etc.)
  const parts = content.split(/\n\s*\d+\.º\s*\n/);
  // Filter out empty strings and section titles
  return parts.map((p) => p.trim()).filter((p) => p.length > 0 && !p.match(/^[IVX]+\s*[—–-]/));
}

/**
 * Parse pedidos section into individual pedido lines.
 */
function parsePedidos(content: string): string[] {
  if (!content.trim()) return [];

  const lines = content.split("\n");
  const pedidos: string[] = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^[a-z]\)/)) {
      if (current) pedidos.push(current);
      current = trimmed;
    } else if (current && trimmed) {
      current += " " + trimmed;
    }
  }
  if (current) pedidos.push(current);

  return pedidos;
}

function formatDate(): string {
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  return `Lisboa, ${day} de ${month} de ${year}`;
}

/**
 * Generate the final .docx for a completed RECURSO DE APELAÇÃO peca.
 *
 * Phases: 1=requerimento, 2=objeto, 3=facto (optional), 4=direito, 5=conclusoes
 * Phase 3 may be skipped when impugna_factos === false.
 */
async function generateRecursoDocx(pecaId: string, userId: string): Promise<string> {
  const peca = await prisma.peca.findFirstOrThrow({
    where: { id: pecaId, userId },
    include: {
      phases: { where: { status: "APPROVED" }, orderBy: { number: "asc" } },
      user: {
        select: {
          name: true,
          cpOA: true,
          templates: {
            where: { isActive: true },
            take: 1,
            select: { id: true, bytes: true, filename: true, mimeType: true },
          },
        },
      },
    },
  });

  const caseData = peca.caseData as Record<string, unknown> | null;
  if (!caseData) {
    throw new Error("Peca has no caseData (Phase 0 not completed)");
  }

  const phaseContent: Record<number, string> = {};
  for (const phase of peca.phases) {
    if (phase.content) {
      phaseContent[phase.number] = phase.content;
    }
  }

  const docxData = {
    tribunal_a_quo:
      caseData.tribunal_a_quo ?? caseData.tribunal ?? "Tribunal Administrativo e Fiscal de Lisboa",
    tribunal_ad_quem: caseData.tribunal_ad_quem ?? "Tribunal Central Administrativo Sul",
    processo: caseData.processo ?? "",
    jurisdicao: (caseData.jurisdicao as string) ?? "administrativa",
    recorrente: caseData.recorrente ?? { nome: "RECORRENTE", qualidade: "Autor" },
    recorrido: caseData.recorrido ?? {
      nome: "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
      qualidade: "Réu",
    },
    requerimento: {
      contextualizacao: paraSplit(phaseContent[1] ?? ""),
      tipo_recurso: (caseData.tipo_recurso as string) ?? "ordinário de apelação",
      subida: (caseData.subida as string) ?? "nos próprios autos",
      base_legal_tipo:
        (caseData.base_legal_tipo as string) ??
        "art. 627.º, n.º 2, do CPC ex vi art. 140.º, n.º 3, do CPTA",
      base_legal_subida:
        (caseData.base_legal_subida as string) ??
        "art. 645.º, n.º 1, alínea a), do CPC ex vi art. 140.º, n.º 3, do CPTA",
      alegacoes_referencia:
        (caseData.alegacoes_referencia as string) ??
        "Em cumprimento do dever processual, seguem, junto, as alegações do recurso ora interposto.",
      efeito: (caseData.efeito as string) ?? "devolutivo",
      fundamentacao_efeito: (caseData.fundamentacao_efeito as string[]) ?? [],
      juntas:
        (caseData.juntas as string) ??
        "Alegações, D.U.C. e comprovativo do pagamento da taxa de justiça.",
    },
    alegacoes: {
      objeto_delimitacao: paraSplit(phaseContent[2] ?? ""),
      impugnacao_facto_ativa:
        phaseContent[3] !== undefined && Boolean(caseData.impugna_factos),
      impugnacao_facto: paraSplit(phaseContent[3] ?? ""),
      teses_direito: [
        { titulo: "MATÉRIA DE DIREITO", paragrafos: paraSplit(phaseContent[4] ?? "") },
      ],
      conclusoes: paraSplit(phaseContent[5] ?? ""),
    },
    pedido_final:
      (caseData.pedido_final as string) ??
      "e noutros que VV. Exas. suprirão, concedendo-se a apelação e revogando-se a decisão revidenda, substituindo-se por outra que decida em conformidade, far-se-á JUSTIÇA.",
    data: formatDate(),
    advogado_nome: peca.user.name ?? "Eduardo S Dias",
    advogado_cp: peca.user.cpOA ?? "CP 59368P OA",
  };

  const tempDir = join(tmpdir(), `lexbuild-recurso-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const jsonPath = join(tempDir, "dados.json");
  const templatePath = join(tempDir, "template.docx");
  const outputPath = join(tempDir, "recurso_final.docx");

  try {
    await writeFile(jsonPath, JSON.stringify(docxData, null, 2), "utf-8");

    const template = peca.user.templates[0];
    if (!template) {
      throw new Error("Utilizador não tem template .docx configurado. Faça upload em Definições.");
    }
    await writeFile(templatePath, Buffer.from(template.bytes));

    const { stdout, stderr } = await execFileAsync(
      pythonBin(),
      [RECURSO_SCRIPT_PATH, "--json", jsonPath, "--template", templatePath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) logger.warn({ stderr }, "gerar_recurso_docx.py stderr");
    logger.info({ stdout: stdout.trim() }, "RECURSO DOCX generated");

    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const filename = `recurso_${pecaId}.docx`;

    await prisma.peca.update({
      where: { id: pecaId },
      data: {
        outputBytes: docxBuffer,
        outputFilename: filename,
        outputMimeType: DOCX_MIME,
        status: "COMPLETED",
      },
    });

    logger.info({ pecaId, size: docxBuffer.length }, "RECURSO DOCX persisted and peca completed");
    return filename;
  } catch (err) {
    await prisma.peca.update({
      where: { id: pecaId },
      data: { status: "ERROR" },
    });
    logger.error({ err, pecaId }, "RECURSO DOCX generation failed");
    throw err;
  } finally {
    try {
      await unlink(jsonPath).catch(() => {});
      await unlink(templatePath).catch(() => {});
      await unlink(outputPath).catch(() => {});
      const { rmdir } = await import("fs/promises");
      await rmdir(tempDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}
