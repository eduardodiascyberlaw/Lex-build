import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, errorResponse } from "@/lib/api-utils";
const logger = createLogger("api-profile-template");

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse("Ficheiro em falta", 400, "NO_FILE");
    }

    if (file.type !== DOCX_MIME) {
      return errorResponse(
        "Tipo de ficheiro invalido. Use um ficheiro .docx",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("Ficheiro excede 10 MB", 400, "FILE_TOO_LARGE");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Deactivate old templates, create new one (PG bytea storage)
    const template = await prisma.$transaction(async (tx) => {
      await tx.template.updateMany({
        where: { userId: auth.user.id, isActive: true },
        data: { isActive: false },
      });

      return tx.template.create({
        data: {
          userId: auth.user.id,
          name: file.name,
          bytes: buffer,
          filename: file.name,
          mimeType: DOCX_MIME,
          isActive: true,
        },
        select: { id: true, name: true, isActive: true, createdAt: true },
      });
    });

    logger.info({ userId: auth.user.id, templateId: template.id }, "Template uploaded");

    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to upload template");
    return errorResponse("Erro no upload do template", 500, "UPLOAD_ERROR");
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const template = await prisma.template.findFirst({
      where: { userId: auth.user.id, isActive: true },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(template);
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to fetch template");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.template.updateMany({
      where: { userId: auth.user.id, isActive: true },
      data: { isActive: false },
    });

    logger.info({ userId: auth.user.id }, "Templates deactivated");

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to deactivate templates");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
