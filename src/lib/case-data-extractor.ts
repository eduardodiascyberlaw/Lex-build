import { createLogger } from "@/lib/logger";

const logger = createLogger("case-data-extractor");

export interface CaseDataExtractionResult {
  ok: boolean;
  caseData?: Record<string, unknown>;
  strategy?: string;
  reason?: string;
}

/**
 * Extract a structured caseData JSON from Phase 0 free-form output.
 *
 * Real-world Claude outputs vary — `\`\`\`json` fences, untagged
 * `\`\`\`` fences, raw `{...}` blocks, sometimes prose around it. The
 * original implementation only matched the first variant, which is
 * why approving Phase 2 sometimes failed with "caseData não
 * disponível": Phase 0 approved but the regex captured nothing and
 * caseData stayed null.
 *
 * Tries strategies in order; returns the first one that yields a
 * valid object with at least one expected top-level key.
 */
export function extractCaseData(content: string): CaseDataExtractionResult {
  if (!content || !content.trim()) {
    return { ok: false, reason: "empty_content" };
  }

  const candidates: { name: string; text: string }[] = [];

  // 1. ```json ... ```
  const fencedJson = content.match(/```json\s*\n?([\s\S]*?)\n?```/i);
  if (fencedJson) candidates.push({ name: "fenced_json", text: fencedJson[1] });

  // 2. ``` ... ``` (no language tag)
  const fencedAny = content.match(/```\s*\n?([\s\S]*?)\n?```/);
  if (fencedAny && (!fencedJson || fencedAny.index !== fencedJson.index)) {
    candidates.push({ name: "fenced_untagged", text: fencedAny[1] });
  }

  // 3. Greedy outer braces — last resort, picks the largest {...} block.
  const braceMatch = content.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push({ name: "outer_braces", text: braceMatch[0] });

  // 4. Whole content (in case the model returned pure JSON).
  candidates.push({ name: "whole_content", text: content.trim() });

  for (const c of candidates) {
    const parsed = tryParse(c.text);
    if (parsed && isCaseDataLike(parsed)) {
      return { ok: true, caseData: parsed, strategy: c.name };
    }
  }

  logger.warn({ candidatesTried: candidates.length }, "no extraction strategy matched");
  return { ok: false, reason: "no_match" };
}

function tryParse(text: string): Record<string, unknown> | null {
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return obj as Record<string, unknown>;
    }
  } catch {
    // not valid json — try with light cleanup (strip trailing commas, comments)
    try {
      const cleaned = text
        .replace(/\/\/.*$/gm, "") // line comments
        .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
        .replace(/,(\s*[}\]])/g, "$1"); // trailing commas
      const obj = JSON.parse(cleaned);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        return obj as Record<string, unknown>;
      }
    } catch {
      // give up
    }
  }
  return null;
}

/**
 * Heuristic to filter out unrelated JSON blobs the model might emit
 * (e.g. example payloads). A plausible caseData has at least one of
 * the well-known top-level keys we use across peca types.
 */
function isCaseDataLike(obj: Record<string, unknown>): boolean {
  const expected = [
    "tribunal",
    "tribunal_a_quo",
    "tribunal_ad_quem",
    "autor",
    "re",
    "requerente",
    "requerida",
    "exequente",
    "executada",
    "recorrente",
    "recorrido",
    "modules_active",
    "tipo_acao",
    "processo",
  ];
  return expected.some((k) => k in obj);
}
