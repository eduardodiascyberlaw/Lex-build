import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-utils");

export interface AuthSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code && { code }) }, { status });
}

/**
 * Get authenticated session or return 401.
 * userId always comes from the token, never from the request body.
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const session = await getServerSession(authOptions);
  return session as AuthSession | null;
}

/**
 * Require auth — returns session or 401 response.
 * Use in API route handlers:
 *
 * const auth = await requireAuth();
 * if (auth instanceof NextResponse) return auth;
 * // auth.user.id is safe to use
 */
export async function requireAuth(): Promise<AuthSession | NextResponse> {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return errorResponse("Não autenticado", 401, "UNAUTHENTICATED");
  }
  return session;
}

/**
 * Require admin role — returns session or 403 response.
 */
export async function requireAdmin(): Promise<AuthSession | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "ADMIN") {
    return errorResponse("Sem permissão", 403, "FORBIDDEN");
  }
  return auth;
}

/**
 * Parse and validate request body with Zod schema.
 * Returns parsed data or error response.
 */
export async function parseBody<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T> | NextResponse> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      return NextResponse.json(
        { error: "Dados inválidos", code: "VALIDATION_ERROR", details: errors },
        { status: 400 }
      );
    }

    return result.data;
  } catch {
    return errorResponse("Body inválido", 400, "INVALID_BODY");
  }
}

/**
 * Parse and validate query params with Zod schema.
 */
export function parseQuery<T extends z.ZodType>(
  req: NextRequest,
  schema: T
): z.infer<T> | NextResponse {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return NextResponse.json(
      { error: "Parâmetros inválidos", code: "VALIDATION_ERROR", details: errors },
      { status: 400 }
    );
  }

  return result.data;
}
