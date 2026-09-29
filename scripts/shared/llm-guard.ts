// scripts/shared/llm-guard.ts
// LLM을 **끈** 실행이 이미 산 LLM 결과를 회색으로 덮지 않게 하는 쓰기 게이트(2026-09-29, braintrust 실패모드 1).
// `--no-llm`은 2단을 건너뛰고도 판정 파일을 통째로 다시 쓴다 — 그 파일이 커밋되면 커밋돼 있던 원인·요약이
// 전부 사라진 채 배포된다. 게이트는 기본값이 아니라 **쓰기 지점**에 둔다(기본값만 바꾸면 우회로가 남는다).
import fs from "node:fs";

interface LlmBearingRow {
  llm?: { skipped: boolean } | null;
}

/** LLM이 실제로 답을 채운 행 수. */
export function llmResultCount(rows: readonly LlmBearingRow[]): number {
  return rows.filter((row) => row.llm !== undefined && row.llm !== null && !row.llm.skipped).length;
}

/** 기존 파일보다 LLM 결과가 적어지는 쓰기를 거부한다. 파일이 없거나 원래 0건이면 통과. */
export function assertNoLlmDowngrade(filePath: string, next: readonly LlmBearingRow[], why: string): void {
  if (!fs.existsSync(filePath)) return;
  const prev = (JSON.parse(fs.readFileSync(filePath, "utf8")) as { rows?: LlmBearingRow[] }).rows ?? [];
  const before = llmResultCount(prev);
  const after = llmResultCount(next);
  if (after < before) {
    throw new Error(
      `${why}: 기존 ${filePath}의 LLM 결과 ${before}행이 ${after}행으로 줄어드는 쓰기를 거부한다 — ` +
        `캐시로 채우려면 --no-llm 없이(캐시 전용) 다시 돌리고, 견적만 보려면 --dry-run.`
    );
  }
}
