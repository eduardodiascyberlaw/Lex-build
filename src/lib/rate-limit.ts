import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("rate-limit");

const loginLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60, // 5 attempts per IP per minute
});

const registerLimiter = new RateLimiterMemory({
  points: 3,
  duration: 3600, // 3 registrations per IP per hour
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkLoginRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  try {
    await loginLimiter.consume(ip);
    return null;
  } catch (rlRes) {
    logger.warn({ ip }, "Login rate limit exceeded");
    const retryAfter = Math.ceil((rlRes as { msBeforeNext: number }).msBeforeNext / 1000);
    return NextResponse.json(
      { error: "Demasiadas tentativas. Tente novamente mais tarde.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }
}

export async function checkRegisterRateLimit(req: NextRequest): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  try {
    await registerLimiter.consume(ip);
    return null;
  } catch (rlRes) {
    logger.warn({ ip }, "Register rate limit exceeded");
    const retryAfter = Math.ceil((rlRes as { msBeforeNext: number }).msBeforeNext / 1000);
    return NextResponse.json(
      { error: "Demasiados registos. Tente novamente mais tarde.", code: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      }
    );
  }
}
