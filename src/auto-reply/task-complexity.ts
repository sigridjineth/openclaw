/**
 * Task complexity classifier for automatic workflow routing.
 *
 * Classifies incoming messages as DIRECT/SIMPLE/FULL to determine
 * the appropriate response pipeline:
 * - DIRECT: Query/lookup → execute immediately, no pipeline
 * - SIMPLE: Short request → execute without approval
 * - FULL: Complex work → spec-first pipeline (ambiguity gate → seed → execute → evaluate)
 *
 * Inspired by:
 * - wanot-ai/ultraworker: auto-classify complexity pattern
 * - Q00/ouroboros: specification-first development with Socratic interview
 */

export type TaskComplexity = "direct" | "simple" | "full";

export type ClassifyResult = {
  complexity: TaskComplexity;
  reason: string;
};

// Patterns that indicate a query/lookup (no code change needed)
const QUERY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /(?:뭐|무엇|어떤|무슨).*(?:바뀌|변경|변경사항|차이)/i, label: "ko-change-query" },
  { pattern: /(?:확인|파악|분석|요약|정리|설명|알려|봐줘|봐주|봐 줘)/i, label: "ko-lookup" },
  {
    pattern: /\b(?:what|which|how|describe|summarize|explain|check|show|list)\b/i,
    label: "en-query",
  },
  { pattern: /(?:커밋|commit|diff|log|blame|history)/i, label: "vcs-query" },
  { pattern: /(?:리스트|목록|체크|현황|상태)/i, label: "ko-status" },
];

// Patterns that indicate complex work requiring full pipeline
const COMPLEX_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[deep\]/i, label: "[deep]-tag" },
  { pattern: /(?:아키텍처|architecture|리팩토링|refactor)/i, label: "architecture" },
  { pattern: /(?:보안\s*리뷰|security\s*review)/i, label: "security-review" },
  { pattern: /(?:마이그레이션|migration|대규모)/i, label: "migration" },
  { pattern: /(?:새\s*기능|new\s*feature|구현해|implement)/i, label: "new-feature" },
];

const SHORT_REQUEST_MAX_LINES = 5;
const SHORT_REQUEST_MAX_CHARS = 300;

/**
 * Classify a message's task complexity.
 *
 * Priority order:
 * 1. Explicit [deep] tag → FULL
 * 2. Query/lookup patterns → DIRECT
 * 3. Complex patterns → FULL
 * 4. Short request (≤5 lines, ≤300 chars) → SIMPLE
 * 5. Default → FULL
 */
export function classifyTaskComplexity(text: string): ClassifyResult {
  const stripped = text.trim();
  if (!stripped) {
    return { complexity: "direct", reason: "empty" };
  }

  // 1. Explicit [deep] tag always means full pipeline
  if (/\[deep\]/i.test(stripped)) {
    return { complexity: "full", reason: "[deep]-tag" };
  }

  // 2. Query/lookup — no pipeline needed
  for (const { pattern, label } of QUERY_PATTERNS) {
    if (pattern.test(stripped)) {
      return { complexity: "direct", reason: `query:${label}` };
    }
  }

  // 3. Complex work indicators → full pipeline
  for (const { pattern, label } of COMPLEX_PATTERNS) {
    if (pattern.test(stripped)) {
      return { complexity: "full", reason: `complex:${label}` };
    }
  }

  // 4. Short requests → simple workflow
  const lines = stripped.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= SHORT_REQUEST_MAX_LINES && stripped.length <= SHORT_REQUEST_MAX_CHARS) {
    return { complexity: "simple", reason: "short-request" };
  }

  // 5. Default → full
  return { complexity: "full", reason: "default" };
}

/**
 * Build a system prompt hint for the classified complexity.
 * This gets injected into the inbound context so the LLM knows
 * which pipeline to use.
 */
export function buildComplexityHint(result: ClassifyResult): string {
  switch (result.complexity) {
    case "direct":
      return `[Task Routing: DIRECT — execute immediately, no pipeline. Reason: ${result.reason}]`;
    case "simple":
      return `[Task Routing: SIMPLE — execute without approval. Reason: ${result.reason}]`;
    case "full":
      return `[Task Routing: FULL — use spec-first pipeline (ambiguity check → seed → execute → evaluate). Reason: ${result.reason}]`;
  }
}
