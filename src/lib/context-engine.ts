import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { readFile } from "fs/promises";
import path from "path";

const logger = createLogger("context-engine");

const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge", "acpad");

async function loadKnowledgeFile(filename: string): Promise<string> {
  try {
    return await readFile(path.join(KNOWLEDGE_DIR, filename), "utf-8");
  } catch {
    logger.warn({ filename }, "Knowledge file not found");
    return "";
  }
}

/**
 * Load style references for a user + section. Max 3, gold standard first.
 */
async function loadStyleRefs(
  userId: string,
  pecaType: "ACPAD" | "CAUTELAR",
  section: string
): Promise<string> {
  const refs = await prisma.styleReference.findMany({
    where: {
      userId,
      pecaType,
      section: section as never,
      isActive: true,
    },
    orderBy: [{ isGoldStandard: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  if (refs.length === 0) return "";

  let block = `\n## Referências de estilo — padrão a seguir\n\n`;
  block += `Os exemplos abaixo mostram correções aplicadas a textos anteriores.\n`;
  block += `O texto DEPOIS é o padrão correto. Redigir SEMPRE conforme o padrão DEPOIS.\n\n`;

  for (const ref of refs) {
    const label = ref.isGoldStandard ? " (gold standard)" : "";
    const notes = ref.notes ? `Nota: ${ref.notes}\n` : "";
    block += `### Exemplo de correção${label}\n`;
    block += notes;
    block += `\nANTES (NÃO repetir este padrão):\n${ref.beforeText}\n\n`;
    block += `DEPOIS (padrão correto):\n${ref.afterText}\n\n`;
  }

  return block;
}

/**
 * Load core legislation (scope = CORE).
 */
async function loadCoreLegislation(): Promise<string> {
  const laws = await prisma.legislation.findMany({
    where: { scope: "CORE", isActive: true },
    orderBy: [{ diploma: "asc" }, { article: "asc" }],
  });

  if (laws.length === 0) return "";

  let block = `\n## Legislação do Núcleo (CORE)\n\n`;
  for (const law of laws) {
    block += `### ${law.diploma} — ${law.article}`;
    if (law.epigraph) block += ` (${law.epigraph})`;
    block += `\n${law.content}\n\n`;
  }
  return block;
}

/**
 * Load module content for active modules.
 */
async function loadModuleContent(
  moduleCodes: string[],
  includeJurisprudence: boolean,
  includeDoctrine: boolean
): Promise<string> {
  if (moduleCodes.length === 0) return "";

  const modules = await prisma.thematicModule.findMany({
    where: { code: { in: moduleCodes }, isActive: true },
    include: {
      legislation: {
        include: { legislation: true },
        where: { legislation: { isActive: true } },
      },
      jurisprudence: includeJurisprudence ? { where: { isActive: true } } : false,
      doctrine: includeDoctrine ? { where: { isActive: true } } : false,
      platformNotes: { where: { isActive: true } },
      coreRefs: { include: { legislation: true } },
    },
  });

  let block = "";
  for (const mod of modules) {
    block += `\n## Módulo: ${mod.name} (${mod.code})\n`;
    if (mod.description) block += `${mod.description}\n\n`;

    // Module-specific legislation
    if (mod.legislation.length > 0) {
      block += `### Legislação\n`;
      for (const ml of mod.legislation) {
        const l = ml.legislation;
        block += `**${l.diploma} — ${l.article}**`;
        if (l.epigraph) block += ` (${l.epigraph})`;
        block += `\n${l.content}\n`;
        if (ml.relevance) block += `_Relevância:_ ${ml.relevance}\n`;
        block += `\n`;
      }
    }

    // Core references
    if (mod.coreRefs.length > 0) {
      block += `### Referências cruzadas (Núcleo)\n`;
      for (const cr of mod.coreRefs) {
        block += `**${cr.legislation.diploma} — ${cr.legislation.article}**\n`;
        if (cr.context) block += `_Contexto:_ ${cr.context}\n`;
        block += `\n`;
      }
    }

    // Jurisprudence
    if (includeJurisprudence && mod.jurisprudence && mod.jurisprudence.length > 0) {
      block += `### Jurisprudência\n`;
      for (const j of mod.jurisprudence) {
        block += `**${j.court} — ${j.caseNumber} (${j.date})**\n`;
        block += `${j.summary}\n`;
        if (j.keyPassage) block += `> ${j.keyPassage}\n`;
        block += `\n`;
      }
    }

    // Doctrine
    if (includeDoctrine && mod.doctrine && mod.doctrine.length > 0) {
      block += `### Doutrina\n`;
      for (const d of mod.doctrine) {
        block += `**${d.author}**, _${d.work}_`;
        if (d.page) block += ` (p. ${d.page})`;
        if (d.year) block += ` [${d.year}]`;
        block += `\n${d.passage}\n\n`;
      }
    }

    // Platform notes
    if (mod.platformNotes.length > 0) {
      block += `### Notas práticas\n`;
      for (const n of mod.platformNotes) {
        block += `${n.content}\n\n`;
      }
    }
  }

  return block;
}

export interface ContextEngineInput {
  pecaId: string;
  userId: string;
  pecaType: "ACPAD" | "CAUTELAR";
  phase: number;
  caseData: Record<string, unknown> | null;
  documentsText: string;
  previousOutputs: Record<number, string>;
}

export interface ContextEngineOutput {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Build the complete prompt for a given phase, following the progressive
 * disclosure map from CLAUDE.md.
 */
export async function buildContext(input: ContextEngineInput): Promise<ContextEngineOutput> {
  const { phase, userId, pecaType, caseData, documentsText, previousOutputs } = input;

  const activeModules: string[] = (caseData?.modules_active as string[]) ?? [];

  // Load global rules (always present)
  const globalRules = await loadKnowledgeFile("global-rules.md");

  const systemParts: string[] = [globalRules];
  const userParts: string[] = [];

  switch (phase) {
    case 0: {
      // PHASE 0 — document analysis and routing
      const phase0Instructions = await loadKnowledgeFile("phase0-instructions.md");
      systemParts.push(phase0Instructions);

      // Module catalog (metadata only)
      const allModules = await prisma.thematicModule.findMany({
        where: { isActive: true, pecaTypes: { has: pecaType } },
        select: { code: true, name: true, description: true },
        orderBy: { sortOrder: "asc" },
      });
      let catalog = `\n## Catálogo de módulos temáticos disponíveis\n\n`;
      for (const m of allModules) {
        catalog += `- **${m.code}** — ${m.name}: ${m.description ?? ""}\n`;
      }
      systemParts.push(catalog);

      userParts.push(`## Documentos do caso\n\n${documentsText}`);
      break;
    }

    case 1: {
      // PHASE 1 — Pressupostos
      const agent = await loadKnowledgeFile("agents/pressupostos.md");
      const antiAi = await loadKnowledgeFile("anti-ai-review.md");
      const styleRefs = await loadStyleRefs(userId, pecaType, "PRESSUPOSTOS");
      systemParts.push(agent, antiAi, styleRefs);

      userParts.push(`## Documentos\n\n${documentsText}`);
      if (caseData)
        userParts.push(`## Plano do caso (caseData)\n\n${JSON.stringify(caseData, null, 2)}`);
      userParts.push(`\nRedige a Secção I — Pressupostos processuais.`);
      break;
    }

    case 2: {
      // PHASE 2 — Matéria de facto
      const agent = await loadKnowledgeFile("agents/facto-acpad.md");
      const antiAi = await loadKnowledgeFile("anti-ai-review.md");
      const styleRefs = await loadStyleRefs(userId, pecaType, "FACTOS");
      // Modules: legislation + notes only (no jurisprudence/doctrine)
      const moduleContent = await loadModuleContent(activeModules, false, false);
      systemParts.push(agent, antiAi, styleRefs);

      userParts.push(`## Documentos\n\n${documentsText}`);
      if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
      if (previousOutputs[1])
        userParts.push(`## Secção I — Pressupostos (aprovados)\n\n${previousOutputs[1]}`);
      if (moduleContent) userParts.push(moduleContent);
      userParts.push(`\nRedige a Secção II — Matéria de facto.`);
      break;
    }

    case 3: {
      // PHASE 3 — Tempestividade (conditional)
      const agent = await loadKnowledgeFile("agents/tempestividade.md");
      const antiAi = await loadKnowledgeFile("anti-ai-review.md");
      const styleRefs = await loadStyleRefs(userId, pecaType, "TEMPESTIVIDADE");
      const tempRef = await loadKnowledgeFile("references/tempestividade-cpta.md");
      const coreLeg = await loadCoreLegislation();
      systemParts.push(agent, antiAi, styleRefs);

      userParts.push(`## Documentos\n\n${documentsText}`);
      if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
      if (previousOutputs[1]) userParts.push(`## Secção I — Pressupostos\n\n${previousOutputs[1]}`);
      if (previousOutputs[2]) userParts.push(`## Secção II — Factos\n\n${previousOutputs[2]}`);
      if (coreLeg) userParts.push(coreLeg);
      if (tempRef) userParts.push(`## Referência: Tempestividade CPTA\n\n${tempRef}`);
      userParts.push(`\nRedige a Secção III — Tempestividade.`);
      break;
    }

    case 4: {
      // PHASE 4 — Matéria de direito (HEAVIEST)
      const agent = await loadKnowledgeFile("agents/direito-acpad.md");
      const antiAi = await loadKnowledgeFile("anti-ai-review.md");
      const styleRefs = await loadStyleRefs(userId, pecaType, "DIREITO");
      const coreLeg = await loadCoreLegislation();
      // Full module content: legislation + jurisprudence + doctrine + notes
      const moduleContent = await loadModuleContent(activeModules, true, true);
      systemParts.push(agent, antiAi, styleRefs);

      userParts.push(`## Documentos\n\n${documentsText}`);
      if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
      for (let p = 1; p <= 3; p++) {
        if (previousOutputs[p]) userParts.push(`## Output Fase ${p}\n\n${previousOutputs[p]}`);
      }
      if (coreLeg) userParts.push(coreLeg);
      if (moduleContent) userParts.push(moduleContent);
      userParts.push(`\nRedige a Secção de Direito.`);
      break;
    }

    case 5: {
      // PHASE 5 — Pedidos, prova e valor
      const agent = await loadKnowledgeFile("agents/pedidos-acpad.md");
      const styleRefs = await loadStyleRefs(userId, pecaType, "PEDIDOS");
      const provaRef = await loadKnowledgeFile("references/prova-administrativa.md");
      systemParts.push(agent, styleRefs);

      userParts.push(`## Documentos\n\n${documentsText}`);
      if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
      for (let p = 1; p <= 4; p++) {
        if (previousOutputs[p]) userParts.push(`## Output Fase ${p}\n\n${previousOutputs[p]}`);
      }
      if (provaRef) userParts.push(`## Referência: Prova Administrativa\n\n${provaRef}`);
      userParts.push(`\nRedige a Secção Final — Pedidos, prova documental e valor da causa.`);
      break;
    }

    default:
      logger.error({ phase }, "Unknown phase number");
      throw new Error(`Unknown phase: ${phase}`);
  }

  return {
    systemPrompt: systemParts.filter(Boolean).join("\n\n---\n\n"),
    userPrompt: userParts.filter(Boolean).join("\n\n"),
  };
}
