// src/pipeline/shared/observation-stub.ts
// 관측 stub 판정 파일(2026-09-28, C14 — 사용자 결정 D5). 순수 함수만.
//
// **왜 필요한가.** 화면은 판정 파일(`deltas-*.json`)로 패치쌍을 고른다. 관측 단계(매치 수집·판정)가
// 대기 중이거나 키가 없거나 죽으면 판정 파일이 안 생기고, 그러면 **이미 받아 둔 패치노트도** 화면이
// 새 쌍을 못 골라 안 보인다 — 결과가 결정 8 위반과 같다. 그래서 관측 없이도 선언 축을 실을 판정 파일을
// 쓴다: rows는 비어 있고 `meta.observationFailed`가 사유를 든다. 화면은 관측 영역을 회색 사유로 그린다.
// 지어낸 관측은 없다 — 0건 관측이 아니라 **관측 없음**이다(그래서 보드·무기 집계 파일을 만들지 않는다).
import type { ObservationFailure, ObservationFailReason, ObservationProgress } from "../types";
import { PATCH_ID_PATTERN } from "./patches";

export interface ObservationStubFile {
  meta: {
    game: "tft" | "pubg";
    from: string;
    to: string;
    generatedAt: string;
    /** 이 쌍의 노트 항목 수 — 선언 축이 실렸다는 증거. */
    noteCount: number;
    observationFailed: ObservationFailure;
  };
  rows: [];
}

export function buildObservationStub(
  game: "tft" | "pubg",
  from: string,
  to: string,
  failure: ObservationFailure,
  noteCount: number
): ObservationStubFile {
  return {
    meta: { game, from, to, generatedAt: new Date().toISOString(), noteCount, observationFailed: failure },
    rows: [],
  };
}

/** 판정 파일 meta가 stub인가. */
export function isObservationStub(meta: unknown): boolean {
  return (
    typeof meta === "object" &&
    meta !== null &&
    "observationFailed" in meta &&
    typeof (meta as { observationFailed: unknown }).observationFailed === "object" &&
    (meta as { observationFailed: unknown }).observationFailed !== null
  );
}

/**
 * 이 쌍의 판정 파일 상태. 파일이 없거나 **다른 쌍**이면(PUBG `deltas.json`은 한 파일이다) `none`,
 * stub이면 `stub` — stub은 산출물로 치지 않는다(관측이 스스로 갱신되도록, §6 C13·C14).
 */
export function deltasStateOf(
  file: unknown,
  from: string,
  to: string
): { kind: "none" } | { kind: "stub" } | { kind: "observed" } {
  if (typeof file !== "object" || file === null || !("meta" in file)) return { kind: "none" };
  const meta = (file as { meta: unknown }).meta;
  if (typeof meta !== "object" || meta === null) return { kind: "none" };
  const pair = meta as { from?: unknown; to?: unknown };
  if (pair.from !== from || pair.to !== to) return { kind: "none" };
  return isObservationStub(meta) ? { kind: "stub" } : { kind: "observed" };
}

/** 화면 회색 사유 문구 — 조치가 필요한지까지 말한다(초록불이 대기와 고장을 같이 덮지 않게). */
export function observationReasonLabel(reason: ObservationFailReason): string {
  switch (reason) {
    case "awaiting-observation":
      return "관측 대기 — 패치 직후라 표본이 쌓이는 중입니다. 패치노트는 먼저 반영했습니다.";
    case "key-expired":
      return "관측 중단 — API 키가 만료돼 매치를 수집하지 못했습니다(키 재발급 필요). 패치노트는 반영했습니다.";
    case "product-unapproved":
      return "관측 중단 — API 제품 승인 대기로 매치를 수집하지 못했습니다. 패치노트는 반영했습니다.";
    case "key-missing":
      return "관측 중단 — API 키가 설정돼 있지 않습니다. 패치노트는 반영했습니다.";
    case "crashed":
      return "관측 실패 — 수집·판정 단계가 오류로 멈췄습니다. 패치노트는 반영했습니다.";
    case "window-lost":
      return "관측 불가 — 원천 데이터 보존 기간이 지나 이 패치쌍은 관측할 수 없습니다. 패치노트는 반영했습니다.";
    case "collecting":
      return "관측 수집 중 — 표본이 목표에 못 미쳐 다음 수집이 이어서 모읍니다. 패치노트는 반영했습니다.";
  }
}

/**
 * 부분 수집 진행 문구 — 목표에 못 미친 패치만 「18.4 813/2,500매치」. 찬 패치(`from` 쪽)는 말하지 않는다(무엇이 남았는지가 요점).
 * 진행이 없거나 전부 찼으면 null — 숫자를 지어내지 않는다.
 */
export function observationProgressText(progress: readonly ObservationProgress[] | undefined): string | null {
  const open = (progress ?? []).filter((p) => p.stored < p.target);
  if (open.length === 0) return null;
  return `${open.map((p) => `${p.patch} ${p.stored.toLocaleString("en-US")}/${p.target.toLocaleString("en-US")}`).join(" · ")}매치`;
}

/** 워크플로 출력(`progress=` JSON) → 진행. 이 값은 판정 파일에 그대로 실리므로 형식이 틀리면 던진다. */
export function parseObservationProgress(raw: string): ObservationProgress[] {
  const fail = (): never => {
    throw new Error(`parseObservationProgress: progress 형식이 올바르지 않다: ${raw.slice(0, 120)}`);
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail();
  }
  if (!Array.isArray(parsed)) return fail();
  return parsed.map((e: unknown) => {
    if (typeof e !== "object" || e === null) return fail();
    const { patch, stored, target } = e as Record<string, unknown>;
    const count = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
    if (typeof patch !== "string" || !PATCH_ID_PATTERN.test(patch) || !count(stored) || !count(target) || target === 0) return fail();
    return { patch, stored, target };
  });
}
