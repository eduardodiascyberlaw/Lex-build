import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

export async function POST(req: NextRequest, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const params = await ctx.params;
  const isCredentialsCallback =
    params.nextauth?.includes("callback") && params.nextauth?.includes("credentials");

  if (isCredentialsCallback) {
    const rateLimited = await checkLoginRateLimit(req);
    if (rateLimited) return rateLimited;
  }

  return handler(req, ctx);
}
