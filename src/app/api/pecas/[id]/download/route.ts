import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-peca-download");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Ownership check + load bytes (PG bytea storage)
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: {
        id: true,
        type: true,
        outputBytes: true,
        outputFilename: true,
        outputMimeType: true,
      },
    });

    if (!peca) {
      return errorResponse("Nao encontrado", 404, "NOT_FOUND");
    }

    if (!peca.outputBytes) {
      return errorResponse("DOCX ainda nao gerado", 400, "NO_DOCX");
    }

    const buffer = Buffer.from(peca.outputBytes);
    const filename = peca.outputFilename ?? `${peca.type.toLowerCase()}_${id}.docx`;

    logger.info({ userId: auth.user.id, pecaId: id }, "DOCX downloaded");

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          peca.outputMimeType ??
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to download DOCX");
    return errorResponse("Erro no download", 500, "DOWNLOAD_ERROR");
  }
}
