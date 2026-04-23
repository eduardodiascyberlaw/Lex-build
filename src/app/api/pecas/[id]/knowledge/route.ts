import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-peca-knowledge");

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const detail = req.nextUrl.searchParams.get("detail");
  const moduleCode = req.nextUrl.searchParams.get("module");

  try {
    const peca = await prisma.peca.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true, type: true, caseData: true },
    });

    if (!peca) {
      return errorResponse("Nao encontrado", 404, "NOT_FOUND");
    }

    // If detail=true and module specified, return detailed module data
    if (detail === "true" && moduleCode) {
      const mod = await prisma.thematicModule.findFirst({
        where: { code: moduleCode, isActive: true },
        include: {
          legislation: {
            include: {
              legislation: {
                select: { diploma: true, article: true, epigraph: true, content: true },
              },
            },
          },
          jurisprudence: {
            where: { isActive: true },
            select: {
              court: true,
              caseNumber: true,
              date: true,
              summary: true,
              keyPassage: true,
            },
          },
          doctrine: {
            where: { isActive: true },
            select: {
              author: true,
              work: true,
              passage: true,
              page: true,
              year: true,
            },
          },
          platformNotes: {
            where: { isActive: true },
            select: {
              content: true,
              category: true,
            },
          },
        },
      });

      if (!mod) {
        return errorResponse("Modulo nao encontrado", 404, "MODULE_NOT_FOUND");
      }

      // Also fetch core legislation
      const coreLegislation = await prisma.legislation.findMany({
        where: { scope: "CORE", isActive: true },
        select: { diploma: true, article: true, epigraph: true, content: true },
        orderBy: [{ diploma: "asc" }, { article: "asc" }],
      });

      return NextResponse.json({
        code: mod.code,
        legislation: mod.legislation.map((ml) => ({
          diploma: ml.legislation.diploma,
          article: ml.legislation.article,
          epigraph: ml.legislation.epigraph,
          content: ml.legislation.content,
        })),
        jurisprudence: mod.jurisprudence.map((j) => ({
          court: j.court,
          caseNumber: j.caseNumber,
          date: j.date,
          summary: j.summary,
          keyPassage: j.keyPassage,
        })),
        doctrine: mod.doctrine.map((d) => ({
          author: d.author,
          work: d.work,
          passage: d.passage,
          page: d.page,
          year: d.year,
        })),
        platformNotes: mod.platformNotes.map((n) => ({
          content: n.content,
          category: n.category,
        })),
        coreLegislation,
      });
    }

    // Default: summary counts
    const activeModules =
      ((peca.caseData as Record<string, unknown>)?.modules_active as string[]) ?? [];

    // Count core legislation
    const core = await prisma.legislation.count({
      where: { scope: "CORE", isActive: true },
    });

    // Count module-specific content
    const modules = await prisma.thematicModule.findMany({
      where: { isActive: true, pecaTypes: { has: peca.type as "ACPAD" | "CAUTELAR" } },
      select: {
        code: true,
        name: true,
        description: true,
        _count: {
          select: {
            legislation: true,
            jurisprudence: true,
            doctrine: true,
            platformNotes: true,
          },
        },
      },
    });

    // Total counts
    const totalLegislation = modules.reduce((s, m) => s + m._count.legislation, 0) + core;
    const totalJurisprudence = modules.reduce((s, m) => s + m._count.jurisprudence, 0);
    const totalDoctrine = modules.reduce((s, m) => s + m._count.doctrine, 0);

    // Style refs for this user
    const styleRefs = await prisma.styleReference.count({
      where: { userId: auth.user.id, pecaType: peca.type as "ACPAD" | "CAUTELAR", isActive: true },
    });

    return NextResponse.json({
      core,
      legislation: totalLegislation,
      jurisprudence: totalJurisprudence,
      doctrine: totalDoctrine,
      styleRefs,
      modules: modules.map((m) => ({
        code: m.code,
        name: m.name,
        description: m.description,
        legislationCount: m._count.legislation,
        jurisprudenceCount: m._count.jurisprudence,
        doctrineCount: m._count.doctrine,
        notesCount: m._count.platformNotes,
      })),
    });
  } catch (err) {
    logger.error({ err, pecaId: id }, "Failed to fetch knowledge");
    return errorResponse("Erro interno", 500, "INTERNAL_ERROR");
  }
}
