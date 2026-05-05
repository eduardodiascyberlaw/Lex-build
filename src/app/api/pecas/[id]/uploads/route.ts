import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { extractText } from "@/lib/extract";
import { assertBlobSize, BlobTooLargeError } from "@/lib/blob-storage";

const logger = createLogger("api-uploads");

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Ownership check
  const peca = await prisma.peca.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true },
  });

  if (!peca) {
    return errorResponse("Não encontrado", 404, "NOT_FOUND");
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string | null) ?? null;

    if (!file) {
      return errorResponse("Ficheiro em falta", 400, "NO_FILE");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("Ficheiro excede 20 MB", 400, "FILE_TOO_LARGE");
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return errorResponse(
        "Tipo de ficheiro não suportado. Use PDF, DOCX ou TXT.",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Authoritative size check (don't trust client-reported file.size).
    try {
      assertBlobSize(buffer, MAX_FILE_SIZE);
    } catch (err) {
      if (err instanceof BlobTooLargeError) {
        return errorResponse("Ficheiro excede 20 MB", 400, "FILE_TOO_LARGE");
      }
      throw err;
    }

    // Extract text
    const textContent = await extractText(buffer, file.type, file.name);

    // Save record (PG bytea storage)
    const upload = await prisma.pecaUpload.create({
      data: {
        pecaId: id,
        filename: file.name,
        bytes: buffer,
        size: buffer.byteLength,
        mimeType: file.type,
        category,
        textContent,
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });

    logger.info(
      { pecaId: id, uploadId: upload.id, filename: file.name, hasText: !!textContent },
      "File uploaded"
    );

    return NextResponse.json(upload, { status: 201 });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Upload failed");
    return errorResponse("Erro no upload", 500, "UPLOAD_ERROR");
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const peca = await prisma.peca.findFirst({
    where: { id, userId: auth.user.id },
    select: { id: true },
  });

  if (!peca) {
    return errorResponse("Não encontrado", 404, "NOT_FOUND");
  }

  const uploads = await prisma.pecaUpload.findMany({
    where: { pecaId: id },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(uploads);
}
