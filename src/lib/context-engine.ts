import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { readFile } from "fs/promises";
import path from "path";
import type { PecaTypeStr } from "@/lib/orchestrator";

const logger = createLogger("context-engine");

function getKnowledgeDir(pecaType: PecaTypeStr): string {
  const subdir =
    pecaType === "CAUTELAR"
      ? "cautelar"
      : pecaType === "EXECUCAO"
        ? "execucao"
        : pecaType === "RECURSO"
          ? "recurso"
          : "acpad";
  return path.join(process.cwd(), "knowledge", subdir);
}

async function loadKnowledgeFile(
  filename: string,
  pecaType: PecaTypeStr = "ACPAD"
): Promise<string> {
  try {
    return await readFile(path.join(getKnowledgeDir(pecaType), filename), "utf-8");
  } catch {
    logger.warn({ filename, pecaType }, "Knowledge file not found");
    return "";
  }
}

/**
 * Load style references for a user + section. Max 3, gold standard first.
 */
async function loadStyleRefs(
  userId: string,
  pecaType: PecaTypeStr,
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
  includeDoctrine: boolean,
  userId?: string
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
      userNotes: userId ? { where: { userId, isActive: true } } : false,
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

    // User-specific notes
    if (mod.userNotes && mod.userNotes.length > 0) {
      block += `### As suas notas pessoais\n`;
      for (const n of mod.userNotes) {
        block += `${n.content}\n\n`;
      }
    }
  }

  return block;
}

export interface ContextEngineInput {
  pecaId: string;
  userId: string;
  pecaType: PecaTypeStr;
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

  // Load global rules (always present, type-aware)
  const globalRules = await loadKnowledgeFile("global-rules.md", pecaType);

  const systemParts: string[] = [globalRules];
  const userParts: string[] = [];

  if (pecaType === "CAUTELAR") {
    switch (phase) {
      case 0: {
        const phase0Instructions = await loadKnowledgeFile("phase0-instructions.md", pecaType);
        const playbookRef = await loadKnowledgeFile(
          "references/playbook-indeferimento-nav.md",
          pecaType
        );
        systemParts.push(phase0Instructions);
        if (playbookRef) systemParts.push(playbookRef);

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
        // CAUTELAR skips phase 1 — safety return
        break;
      }

      case 2: {
        // CAUTELAR PHASE 2 — Matéria de facto (agents/facto.md)
        const agent = await loadKnowledgeFile("agents/facto.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "FACTOS");
        const moduleContent = await loadModuleContent(activeModules, false, false, userId);

        // Load cautelar-specific references based on caseData modules
        const refParts: string[] = [];
        if (activeModules.includes("sis-indicacao")) {
          refParts.push(await loadKnowledgeFile("references/sis-aima.md", pecaType));
        }
        if (activeModules.includes("abandono-voluntario")) {
          refParts.push(await loadKnowledgeFile("references/abandono-voluntario.md", pecaType));
        }
        if (
          activeModules.includes("proporcionalidade") ||
          activeModules.includes("integracao-socioprofissional")
        ) {
          refParts.push(await loadKnowledgeFile("references/proporcionalidade.md", pecaType));
        }
        if (activeModules.includes("meios-subsistencia-agregado")) {
          refParts.push(
            await loadKnowledgeFile("references/meios-subsistencia-agregado.md", pecaType)
          );
        }

        systemParts.push(agent, antiAi, styleRefs, ...refParts.filter(Boolean));

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (moduleContent) userParts.push(moduleContent);
        userParts.push(`\nRedige a secção "DOS FACTOS" em articulados numerados.`);
        break;
      }

      case 3: {
        // CAUTELAR skips phase 3 — safety return
        break;
      }

      case 4: {
        // CAUTELAR PHASE 4 — Direito — 3 pilares (agents/direito.md)
        const agent = await loadKnowledgeFile("agents/direito.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "DIREITO");
        const jurisRef = await loadKnowledgeFile("references/jurisprudencia.md", pecaType);
        const playbookRef = await loadKnowledgeFile(
          "references/playbook-indeferimento-nav.md",
          pecaType
        );
        const meiosRef = activeModules.includes("meios-subsistencia-agregado")
          ? await loadKnowledgeFile("references/meios-subsistencia-agregado.md", pecaType)
          : "";
        const coreLeg = await loadCoreLegislation();
        const moduleContent = await loadModuleContent(activeModules, true, true, userId);
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[2])
          userParts.push(`## Secção DOS FACTOS (aprovada)\n\n${previousOutputs[2]}`);
        if (coreLeg) userParts.push(coreLeg);
        if (moduleContent) userParts.push(moduleContent);
        if (meiosRef)
          userParts.push(`## Referência: Meios de subsistência por agregado\n\n${meiosRef}`);
        if (playbookRef) userParts.push(`## Referência: Playbook estratégico\n\n${playbookRef}`);
        if (jurisRef) userParts.push(`## Referência: Jurisprudência citável\n\n${jurisRef}`);
        userParts.push(
          `\nRedige a secção "DO DIREITO" com os 3 pilares (fumus, periculum, ponderação).`
        );
        break;
      }

      case 5: {
        // CAUTELAR PHASE 5 — Pedidos (agents/pedidos.md)
        const agent = await loadKnowledgeFile("agents/pedidos.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "PEDIDOS");
        systemParts.push(agent, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[2]) userParts.push(`## Secção DOS FACTOS\n\n${previousOutputs[2]}`);
        if (previousOutputs[4]) userParts.push(`## Secção DO DIREITO\n\n${previousOutputs[4]}`);
        userParts.push(
          `\nRedige a secção "DOS PEDIDOS" com pedidos cautelares, prova e valor da causa.`
        );
        break;
      }

      default:
        logger.error({ phase, pecaType }, "Unknown phase number");
        throw new Error(`Unknown phase: ${phase}`);
    }
  } else if (pecaType === "EXECUCAO") {
    switch (phase) {
      case 0: {
        const phase0Instructions = await loadKnowledgeFile("phase0-instructions.md", pecaType);
        systemParts.push(phase0Instructions);

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
        // EXECUCAO PHASE 1 — Sentença Exequenda (agents/sentenca-exequenda.md)
        const agent = await loadKnowledgeFile("agents/sentenca-exequenda.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "FACTOS");
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        userParts.push(`\nRedige a Secção I — DA SENTENÇA EXEQUENDA em articulados numerados.`);
        break;
      }

      case 2: {
        // EXECUCAO PHASE 2 — Incumprimento (agents/incumprimento.md)
        const agent = await loadKnowledgeFile("agents/incumprimento.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "FACTOS");
        const moduleContent = await loadModuleContent(activeModules, false, false, userId);

        // Conditional refs
        const refParts: string[] = [];
        if (activeModules.includes("sis-indicacao")) {
          refParts.push(await loadKnowledgeFile("references/sis-aima.md", pecaType));
        }

        systemParts.push(agent, antiAi, styleRefs, ...refParts.filter(Boolean));

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[1])
          userParts.push(`## Secção I — DA SENTENÇA EXEQUENDA (aprovada)\n\n${previousOutputs[1]}`);
        if (moduleContent) userParts.push(moduleContent);
        userParts.push(
          `\nRedige a Secção II — DO INCUMPRIMENTO em articulados numerados, continuando a numeração.`
        );
        break;
      }

      case 3: {
        // EXECUCAO skips phase 3 — safety return
        break;
      }

      case 4: {
        // EXECUCAO PHASE 4 — Direito (agents/direito.md)
        const agent = await loadKnowledgeFile("agents/direito.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "DIREITO");
        const coreLeg = await loadCoreLegislation();
        const moduleContent = await loadModuleContent(activeModules, true, true, userId);

        // Always load regime-execucao-cpta and jurisprudencia-execucao
        const regimeRef = await loadKnowledgeFile("references/regime-execucao-cpta.md", pecaType);
        const jurisRef = await loadKnowledgeFile("references/jurisprudencia-execucao.md", pecaType);
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[1])
          userParts.push(`## Secção I — Sentença Exequenda\n\n${previousOutputs[1]}`);
        if (previousOutputs[2])
          userParts.push(`## Secção II — Incumprimento\n\n${previousOutputs[2]}`);
        if (coreLeg) userParts.push(coreLeg);
        if (moduleContent) userParts.push(moduleContent);
        if (regimeRef) userParts.push(`## Referência: Regime de execução CPTA\n\n${regimeRef}`);
        if (jurisRef) userParts.push(`## Referência: Jurisprudência de execução\n\n${jurisRef}`);

        // Conditional references based on modulos_direito
        const modulosDireito = (caseData?.modulos_direito as string[]) ?? [];
        if (modulosDireito.includes("M3")) {
          const sancaoRef = await loadKnowledgeFile("references/sancao-pecuniaria.md", pecaType);
          if (sancaoRef)
            userParts.push(`## Referência: Sanção pecuniária compulsória\n\n${sancaoRef}`);
        }
        if (modulosDireito.includes("M4")) {
          const tutelaRef = await loadKnowledgeFile("references/tutela-jurisdicional.md", pecaType);
          if (tutelaRef)
            userParts.push(`## Referência: Tutela jurisdicional efectiva\n\n${tutelaRef}`);
        }
        if (modulosDireito.includes("M5")) {
          const causaRef = await loadKnowledgeFile(
            "references/causa-legitima-inexecucao.md",
            pecaType
          );
          if (causaRef)
            userParts.push(`## Referência: Causa legítima de inexecução\n\n${causaRef}`);
        }

        userParts.push(`\nRedige a Secção III — DO DIREITO, continuando a numeração.`);
        break;
      }

      case 5: {
        // EXECUCAO PHASE 5 — Pedidos (agents/pedidos.md)
        const agent = await loadKnowledgeFile("agents/pedidos.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "PEDIDOS");
        systemParts.push(agent, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[1])
          userParts.push(`## Secção I — Sentença Exequenda\n\n${previousOutputs[1]}`);
        if (previousOutputs[2])
          userParts.push(`## Secção II — Incumprimento\n\n${previousOutputs[2]}`);
        if (previousOutputs[4]) userParts.push(`## Secção III — Direito\n\n${previousOutputs[4]}`);

        // Sancao pecuniaria ref for pedidos if M3 active
        const modulosDireito = (caseData?.modulos_direito as string[]) ?? [];
        if (modulosDireito.includes("M3")) {
          const sancaoRef = await loadKnowledgeFile("references/sancao-pecuniaria.md", pecaType);
          if (sancaoRef)
            userParts.push(`## Referência: Sanção pecuniária compulsória\n\n${sancaoRef}`);
        }

        userParts.push(
          `\nRedige a Secção IV — DO PEDIDO com pedidos, lista de documentos, data e assinatura.`
        );
        break;
      }

      default:
        logger.error({ phase, pecaType }, "Unknown phase number");
        throw new Error(`Unknown phase: ${phase}`);
    }
  } else if (pecaType === "RECURSO") {
    // ─── RECURSO DE APELAÇÃO ───────────────────────────────────────────────
    switch (phase) {
      case 0: {
        // Viabilidade e teses — lê sistema-recursorio.md obrigatoriamente
        const phase0Instructions = await loadKnowledgeFile("phase0-instructions.md", pecaType);
        const sistemaRef = await loadKnowledgeFile("references/sistema-recursorio.md", pecaType);
        systemParts.push(phase0Instructions);
        if (sistemaRef) systemParts.push(`## Referência: Sistema recursório\n\n${sistemaRef}`);

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
        // Requerimento de interposição
        const agent = await loadKnowledgeFile("agents/requerimento.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "REQUERIMENTO");
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        userParts.push(`\nRedige o Requerimento de Interposição do Recurso de Apelação.`);
        break;
      }

      case 2: {
        // Objeto e delimitação do recurso
        const agent = await loadKnowledgeFile("agents/objeto-delimitacao.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "OBJETO");
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[1])
          userParts.push(`## Requerimento aprovado\n\n${previousOutputs[1]}`);
        userParts.push(`\nRedige a secção "OBJETO E DELIMITAÇÃO DO RECURSO" das alegações.`);
        break;
      }

      case 3: {
        // Impugnação da matéria de facto (condicional — skip se impugna_factos === false)
        // Guard: this phase should never be active if impugna_factos is false
        if (!caseData?.impugna_factos) {
          logger.error({ pecaId: input.pecaId, phase }, "RECURSO phase 3 reached but impugna_factos is false — phase should have been skipped");
          throw new Error("Fase 3 não aplicável para este recurso (impugna_factos is false)");
        }
        const agent = await loadKnowledgeFile("agents/facto-recurso.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "IMPUGNACAO_FACTO");
        const factRef = await loadKnowledgeFile("references/materia-de-facto.md", pecaType);
        const novaProvaRef = caseData?.novos_meios_prova
          ? await loadKnowledgeFile("references/novos-meios-prova.md", pecaType)
          : "";
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[2]) userParts.push(`## Objeto e delimitação\n\n${previousOutputs[2]}`);
        if (factRef) userParts.push(`## Referência: Impugnação da matéria de facto\n\n${factRef}`);
        if (novaProvaRef)
          userParts.push(`## Referência: Novos meios de prova\n\n${novaProvaRef}`);
        userParts.push(
          `\nRedige a secção "IMPUGNAÇÃO DA MATÉRIA DE FACTO" seguindo o ónus do art. 640.º n.º 1 CPC.`
        );
        break;
      }

      case 4: {
        // Matéria de direito — teses identificadas na Fase 0
        const agent = await loadKnowledgeFile("agents/direito-recurso.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "DIREITO_RECURSO");
        const coreLeg = await loadCoreLegislation();
        const moduleContent = await loadModuleContent(activeModules, true, true, userId);

        // Jurisdiction-specific references
        const jurisdicao = (caseData?.jurisdicao as string) ?? "";
        const jurisAdmRef =
          jurisdicao === "administrativa"
            ? await loadKnowledgeFile("references/jurisdicao-administrativa.md", pecaType)
            : "";
        const jurisLabRef =
          jurisdicao === "laboral"
            ? await loadKnowledgeFile("references/jurisdicao-laboral.md", pecaType)
            : "";
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[2]) userParts.push(`## Objeto e delimitação\n\n${previousOutputs[2]}`);
        if (previousOutputs[3])
          userParts.push(`## Impugnação da matéria de facto\n\n${previousOutputs[3]}`);
        if (coreLeg) userParts.push(coreLeg);
        if (moduleContent) userParts.push(moduleContent);
        if (jurisAdmRef)
          userParts.push(
            `## Referência: Especificidades CPTA (arts. 140.º-148.º)\n\n${jurisAdmRef}`
          );
        if (jurisLabRef)
          userParts.push(`## Referência: Especificidades CPT (arts. 79.º-81.º)\n\n${jurisLabRef}`);
        userParts.push(`\nRedige a secção "MATÉRIA DE DIREITO" com as teses identificadas na Fase 0.`);
        break;
      }

      case 5: {
        // Conclusões + pedido final
        const agent = await loadKnowledgeFile("agents/conclusoes-recurso.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "CONCLUSOES_RECURSO");
        const conclusoesRef = await loadKnowledgeFile("references/conclusoes.md", pecaType);
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[2]) userParts.push(`## Objeto e delimitação\n\n${previousOutputs[2]}`);
        if (previousOutputs[3])
          userParts.push(`## Impugnação da matéria de facto\n\n${previousOutputs[3]}`);
        if (previousOutputs[4]) userParts.push(`## Matéria de direito\n\n${previousOutputs[4]}`);
        if (conclusoesRef) userParts.push(`## Referência: Técnica das conclusões\n\n${conclusoesRef}`);
        userParts.push(
          `\nRedige as CONCLUSÕES (15-35 proposições numeradas em I., II., III., ...) e o Pedido Final.`
        );
        break;
      }

      default:
        logger.error({ phase, pecaType }, "Unknown phase number");
        throw new Error(`Unknown phase: ${phase}`);
    }
  } else {
    // ACPAD — original logic
    switch (phase) {
      case 0: {
        const phase0Instructions = await loadKnowledgeFile("phase0-instructions.md", pecaType);
        systemParts.push(phase0Instructions);

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
        const agent = await loadKnowledgeFile("agents/pressupostos.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "PRESSUPOSTOS");
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData)
          userParts.push(`## Plano do caso (caseData)\n\n${JSON.stringify(caseData, null, 2)}`);
        userParts.push(`\nRedige a Secção I — Pressupostos processuais.`);
        break;
      }

      case 2: {
        const agent = await loadKnowledgeFile("agents/facto-acpad.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "FACTOS");
        const moduleContent = await loadModuleContent(activeModules, false, false, userId);
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
        const agent = await loadKnowledgeFile("agents/tempestividade.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "TEMPESTIVIDADE");
        const tempRef = await loadKnowledgeFile("references/tempestividade-cpta.md", pecaType);
        const coreLeg = await loadCoreLegislation();
        systemParts.push(agent, antiAi, styleRefs);

        userParts.push(`## Documentos\n\n${documentsText}`);
        if (caseData) userParts.push(`## Plano do caso\n\n${JSON.stringify(caseData, null, 2)}`);
        if (previousOutputs[1])
          userParts.push(`## Secção I — Pressupostos\n\n${previousOutputs[1]}`);
        if (previousOutputs[2]) userParts.push(`## Secção II — Factos\n\n${previousOutputs[2]}`);
        if (coreLeg) userParts.push(coreLeg);
        if (tempRef) userParts.push(`## Referência: Tempestividade CPTA\n\n${tempRef}`);
        userParts.push(`\nRedige a Secção III — Tempestividade.`);
        break;
      }

      case 4: {
        const agent = await loadKnowledgeFile("agents/direito-acpad.md", pecaType);
        const antiAi = await loadKnowledgeFile("anti-ai-review.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "DIREITO");
        const coreLeg = await loadCoreLegislation();
        const moduleContent = await loadModuleContent(activeModules, true, true, userId);
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
        const agent = await loadKnowledgeFile("agents/pedidos-acpad.md", pecaType);
        const styleRefs = await loadStyleRefs(userId, pecaType, "PEDIDOS");
        const provaRef = await loadKnowledgeFile("references/prova-administrativa.md", pecaType);
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
  }

  return {
    systemPrompt: systemParts.filter(Boolean).join("\n\n---\n\n"),
    userPrompt: userParts.filter(Boolean).join("\n\n"),
  };
}
