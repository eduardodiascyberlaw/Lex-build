import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { requireAuth, parseBody, errorResponse } from "@/lib/api-utils";

const logger = createLogger("api-profile");

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        cpOA: true,
        firmName: true,
        model: true,
        apiKeyEnc: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return errorResponse("Utilizador não encontrado", 404, "NOT_FOUND");
    }

    return NextResponse.json({
      ...user,
      hasApiKey: !!user.apiKeyEnc,
      apiKeyEnc: undefined, // never send encrypted key to frontend
    });
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to fetch profile");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}

const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2)
    .transform((v) => v.trim())
    .optional(),
  cpOA: z
    .string()
    .min(3)
    .transform((v) => v.trim())
    .optional(),
  firmName: z
    .string()
    .transform((v) => v.trim())
    .nullable()
    .optional(),
  model: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const data = await parseBody(req, updateProfileSchema);
  if (data instanceof NextResponse) return data;

  try {
    const updated = await prisma.user.update({
      where: { id: auth.user.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        cpOA: true,
        firmName: true,
        model: true,
      },
    });

    logger.info({ userId: auth.user.id }, "Profile updated");
    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err, userId: auth.user.id }, "Failed to update profile");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
