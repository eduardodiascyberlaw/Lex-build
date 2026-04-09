import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { parseBody, errorResponse } from "@/lib/api-utils";
import { checkRegisterRateLimit } from "@/lib/rate-limit";

const logger = createLogger("auth-register");

const registerSchema = z.object({
  email: z
    .string()
    .email("Email inválido")
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Password deve ter no mínimo 8 caracteres"),
  name: z
    .string()
    .min(2, "Nome é obrigatório")
    .transform((v) => v.trim()),
  cpOA: z
    .string()
    .min(3, "Cédula profissional é obrigatória")
    .transform((v) => v.trim()),
  firmName: z
    .string()
    .transform((v) => v.trim())
    .optional(),
});

export async function POST(req: NextRequest) {
  const rateLimited = await checkRegisterRateLimit(req);
  if (rateLimited) return rateLimited;

  const data = await parseBody(req, registerSchema);
  if (data instanceof NextResponse) return data;

  try {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existing) {
      return errorResponse("Email já registado", 409, "EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        cpOA: data.cpOA,
        firmName: data.firmName,
      },
      select: { id: true, email: true, name: true },
    });

    logger.info({ userId: user.id }, "New user registered");

    return NextResponse.json({ id: user.id, email: user.email, name: user.name }, { status: 201 });
  } catch (err) {
    logger.error({ err }, "Registration failed");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
