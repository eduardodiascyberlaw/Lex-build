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
