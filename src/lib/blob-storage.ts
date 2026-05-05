import { createLogger } from "@/lib/logger";

const logger = createLogger("blob-storage");

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB hard limit per file

export class BlobTooLargeError extends Error {
  constructor(size: number, max: number) {
    super(`File size ${size} bytes exceeds limit of ${max} bytes`);
    this.name = "BlobTooLargeError";
  }
}

export function assertBlobSize(buffer: Buffer | Uint8Array, max: number = MAX_UPLOAD_BYTES) {
  const size = buffer.byteLength;
  if (size > max) {
    logger.warn({ size, max }, "blob exceeds size limit");
    throw new BlobTooLargeError(size, max);
  }
  return size;
}

export function detectMimeType(filename: string, fallback = "application/octet-stream"): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    rtf: "application/rtf",
    odt: "application/vnd.oasis.opendocument.text",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  return map[ext] ?? fallback;
}

export function toNodeBuffer(input: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  return Buffer.from(input);
}
