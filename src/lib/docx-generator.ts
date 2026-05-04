import { execFile } from "child_process";
import { writeFile, mkdir, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import { uploadToS3, getFromS3 } from "@/lib/s3";
import { createLogger } from "@/lib/logger";

const execFileAsync = promisify(execFile);
const logger = createLogger("docx-generator");

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

  // Load peca with phases and user
  const peca = await prisma.peca.findFirstOrThrow({
    where: { id: pecaId, userId },
    include: {
      phases: { where: { status: "APPROVED" }, orderBy: { number: "asc" } },
      user: {
        select: { name: true, cpOA: true, templates: { where: { isActive: true }, take: 1 } },
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

    // Download template from S3
    const template = peca.user.templates[0];
    if (!template) {
      throw new Error("Utilizador não tem template .docx configurado. Faça upload em Definições.");
    }
    const templateBuffer = await getFromS3(template.s3Key);
    await writeFile(templatePath, templateBuffer);

    // Run python script
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [SCRIPT_PATH, "--json", jsonPath, "--template", templatePath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) {
      logger.warn({ stderr }, "gerar_docx.py stderr");
    }
    logger.info({ stdout: stdout.trim() }, "DOCX generated");

    // Read output and upload to S3
    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const s3Key = await uploadToS3(
      docxBuffer,
      `acpad_${pecaId}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      `pecas/${pecaId}`
    );

    // Update peca
    await prisma.peca.update({
      where: { id: pecaId },
      data: { outputS3Key: s3Key, status: "COMPLETED" },
    });

    logger.info({ pecaId, s3Key }, "DOCX uploaded and peca completed");
    return s3Key;
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
      "python3",
      [CAUTELAR_SCRIPT_PATH, "--json", jsonPath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) {
      logger.warn({ stderr }, "gerar_docx.py (cautelar) stderr");
    }
    logger.info({ stdout: stdout.trim() }, "CAUTELAR DOCX generated");

    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const s3Key = await uploadToS3(
      docxBuffer,
      `cautelar_${pecaId}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      `pecas/${pecaId}`
    );

    await prisma.peca.update({
      where: { id: pecaId },
      data: { outputS3Key: s3Key, status: "COMPLETED" },
    });

    logger.info({ pecaId, s3Key }, "CAUTELAR DOCX uploaded and peca completed");
    return s3Key;
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
      "python3",
      [EXECUCAO_SCRIPT_PATH, "--json", jsonPath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) {
      logger.warn({ stderr }, "gerar_execucao.py stderr");
    }
    logger.info({ stdout: stdout.trim() }, "EXECUCAO DOCX generated");

    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const s3Key = await uploadToS3(
      docxBuffer,
      `execucao_${pecaId}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      `pecas/${pecaId}`
    );

    await prisma.peca.update({
      where: { id: pecaId },
      data: { outputS3Key: s3Key, status: "COMPLETED" },
    });

    logger.info({ pecaId, s3Key }, "EXECUCAO DOCX uploaded and peca completed");
    return s3Key;
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
        select: { name: true, cpOA: true, templates: { where: { isActive: true }, take: 1 } },
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
    tribunal: caseData.tribunal ?? "Tribunal Administrativo e Fiscal de Lisboa",
    tribunal_ad_quem: caseData.tribunal_ad_quem ?? "Tribunal Central Administrativo Sul",
    processo: caseData.processo ?? null,
    jurisdicao: (caseData.jurisdicao as string) ?? "administrativa",
    recorrente: caseData.recorrente ?? { nome: "RECORRENTE", qualidade: "Autor" },
    recorrido: caseData.recorrido ?? {
      nome: "AGÊNCIA PARA A INTEGRAÇÃO, MIGRAÇÕES E ASILO, I.P.",
      qualidade: "Réu",
    },
    requerimento: phaseContent[1] ?? "",
    objeto_delimitacao: phaseContent[2] ?? "",
    // Use actual approved phase 3 content as source of truth, not stale caseData at generation time
    impugna_factos: phaseContent[3] !== undefined,
    impugnacao_facto: phaseContent[3] ?? "",
    materia_direito: phaseContent[4] ?? "",
    conclusoes: phaseContent[5] ?? "",
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
    const templateBuffer = await getFromS3(template.s3Key);
    await writeFile(templatePath, templateBuffer);

    const { stdout, stderr } = await execFileAsync(
      "python3",
      [RECURSO_SCRIPT_PATH, "--json", jsonPath, "--template", templatePath, "--output", outputPath],
      { timeout: 30000 }
    );

    if (stderr) logger.warn({ stderr }, "gerar_recurso_docx.py stderr");
    logger.info({ stdout: stdout.trim() }, "RECURSO DOCX generated");

    const { readFile } = await import("fs/promises");
    const docxBuffer = await readFile(outputPath);
    const s3Key = await uploadToS3(
      docxBuffer,
      `recurso_${pecaId}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      `pecas/${pecaId}`
    );

    await prisma.peca.update({
      where: { id: pecaId },
      data: { outputS3Key: s3Key, status: "COMPLETED" },
    });

    logger.info({ pecaId, s3Key }, "RECURSO DOCX uploaded and peca completed");
    return s3Key;
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
