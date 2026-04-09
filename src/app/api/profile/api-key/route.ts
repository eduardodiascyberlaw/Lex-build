import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encrypt, maskApiKey, decrypt } from "@/lib/encryption";
import { createLogger } from "@/lib/logger";
import { requireAuth, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-key");

const apiKeySchema = z.object({
  apiKey: z.string().min(10, "API key inválida"),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const data = await parseBody(req, apiKeySchema);
  if (data instanceof NextResponse) return data;

  try {
    const apiKeyEnc = encrypt(data.apiKey);

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { apiKeyEnc },
    });

    logger.info({ userId: auth.user.id }, "API key updated");

    return NextResponse.json({
      maskedKey: maskApiKey(data.apiKey),
    });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to save API key");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { apiKeyEnc: true },
    });

    if (!user?.apiKeyEnc) {
      return NextResponse.json({ hasKey: false, maskedKey: null });
    }

    const decrypted = decrypt(user.apiKeyEnc);
    return NextResponse.json({
      hasKey: true,
      maskedKey: maskApiKey(decrypted),
    });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to fetch API key status");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.user.update({
      where: { id: auth.user.id },
      data: { apiKeyEnc: null },
    });

    logger.info({ userId: auth.user.id }, "API key removed");
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to remove API key");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
