import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import mammoth from "mammoth";
import { createLogger } from "@/lib/logger";

const execFileAsync = promisify(execFile);
const logger = createLogger("extract");

const MAX_TEXT_LENGTH = 500_000; // 500KB text limit

/**
 * Extract text from a PDF buffer using pdftotext (poppler-utils).
 */
async function extractPdf(buffer: Buffer): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "lex-"));
  const inputPath = path.join(dir, "input.pdf");
  const outputPath = path.join(dir, "output.txt");

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync("pdftotext", ["-layout", inputPath, outputPath], {
      timeout: 30_000,
    });

    const { readFile } = await import("fs/promises");
    const text = await readFile(outputPath, "utf-8");
    return text.slice(0, MAX_TEXT_LENGTH);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Extract text from a .docx buffer using mammoth.
 */
async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.slice(0, MAX_TEXT_LENGTH);
}

/**
 * Extract text from a file buffer based on its MIME type.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  try {
    if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
      return await extractPdf(buffer);
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.endsWith(".docx")
    ) {
      return await extractDocx(buffer);
    }

    if (mimeType.startsWith("text/")) {
      return buffer.toString("utf-8").slice(0, MAX_TEXT_LENGTH);
    }

    logger.warn({ mimeType, filename }, "Unsupported file type for text extraction");
    return null;
  } catch (err) {
    logger.error({ err, mimeType, filename }, "Text extraction failed");
    return null;
  }
}
