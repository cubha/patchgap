// src/lib/pubgData.ts
// PUBG 집계 산출물의 빌드 타임 로더 — data.ts(LoL)와 같은 역할이되 네임스페이스가 분리돼 있다.
// 런타임 외부 호출 0 원칙에 따라 여기서 읽는 것은 전부 커밋된 정적 JSON이다.
//
// **출하 게이트**(SCOPE 2026-09-16 해제 조건): 파일이 없거나 근거 딸린 판정이 0건이면
// `loadPubg()`가 null을 반환하고, 그 경우 페이지·네비 링크를 렌더하지 않는다. 빈 껍데기 탭이
// 배포되면 LoL 본편 신뢰도까지 깎이므로 "데이터가 없으면 아예 없다"가 기본값이다.
import "server-only";
import path from "node:path";
import type { MatchStatus, ObservationFailure } from "@/pipeline/types";
import { isObservationStub } from "@/pipeline/shared/observation-stub";
import type { PubgPatchAggregate } from "@/pipeline/aggregate/pubg-weapons";
import type { PubgAccuracyStat } from "@/pipeline/aggregate/pubg-accuracy";
import type { PubgMapAggregate, PubgMapDeltaRow } from "@/pipeline/aggregate/pubg-maps";
import type { PubgAssetManifest } from "@/pipeline/pubg/asset-path";
import type { PubgDeltaRow, PubgNoteItem } from "@/pipeline/match/pubg-delta";
import { readJsonIfExists } from "@/pipeline/shared/json-file";

const PUBG_DIR = path.resolve(process.cwd(), "data", "aggregated", "pubg");

export interface PubgDeltasFile {
  meta: {
    game: "pubg";
    from: string;
    to: string;
    generatedAt: string;
    n: number;
    counts: Partial<Record<MatchStatus, number>>;
    effectFloor: number;
    sampleScope: string;
    window: { before: string[]; after: string[] };
  };
  rows: PubgDeltaRow[];
}

export interface PubgAccuracyComparisonRow {
  weaponKey: string;
  weaponName: string;
  nerfed: boolean;
  before: Pick<PubgAccuracyStat, "accuracy" | "attacks">;
  after: Pick<PubgAccuracyStat, "accuracy" | "attacks">;
  relChangePct: number | null;
}

export interface PubgAccuracyComparisonFile {
  meta: { generatedAt: string; note: string };
  rows: PubgAccuracyComparisonRow[];
}

export interface PubgBundle {
  deltas: PubgDeltasFile;
  before: PubgPatchAggregate;
  after: PubgPatchAggregate;
  notes: PubgNoteItem[];
  /**
   * §8 반증표 재현(ST-4) — **출하 축이 아니다**, 없어도 `loadPubg`는 정상 반환한다
   * (출하 게이트는 무기 획득 점유율 판정 건수만 본다). "버린 축" 섹션에서만 쓰인다.
   */
  accuracyComparison: PubgAccuracyComparisonRow[] | null;
}

function readJson<T>(file: string): T | null {
  return readJsonIfExists<T>(path.join(PUBG_DIR, file));
}

/**
 * 지금 화면이 보여주는 패치 쌍 — `deltas.json`의 `meta`가 단일 소스다(2026-09-27). 전에는 로더와 페이지
 * 메타데이터가 `42.3`·`43.1`을 하드코딩해, 43.2 노트와 판정이 커밋돼도 화면은 43.1에 머물렀다(결정 8 —
 * 선언 축은 항상 최신 — 을 코드가 깨는 자리).
 */
/** 맵 키 후보 — 두 구간 합집합(한쪽에만 표본이 잡힌 맵도 상세는 존재한다). 맵 상세의 정적 경로와 본문이 같은 집합을 쓴다
 * (2026-10-06 `app/pubg/map/[key]/page.tsx`에서 이관). */
export function pubgMapKeys(): string[] {
  const maps = loadPubgMaps();
  if (!maps) return [];
  return [...new Set([...maps.before.maps, ...maps.after.maps].map((m) => m.mapKey))];
}

export function pubgPair(): { from: string; to: string } | null {
  const deltas = readJson<PubgDeltasFile>("deltas.json");
  return deltas ? { from: deltas.meta.from, to: deltas.meta.to } : null;
}

/**
 * 판정·양쪽 집계·노트 네 파일이 모두 있을 때 번들을 반환한다. 하나라도 없으면 null — 호출부는 null이면
 * PUBG를 화면에서 완전히 뺀다.
 *
 * **보고 자격 판정이 0건이어도 반환한다**(2026-09-27). 전에는 0건이면 null이었는데, 새 패치의 표본이
 * 얇아 판정이 전부 표본 부족이면 **패치노트까지** 화면에서 사라졌다 — 관측 축이 선언 축을 인질로 잡는
 * 구조였다(결정 8).
 */
export function loadPubg(): PubgBundle | null {
  const deltas = readJson<PubgDeltasFile>("deltas.json");
  // 관측 stub(C14)이면 관측 번들이 아니다 — 선언 축은 `loadPubgDeclaration()`이 준다.
  if (!deltas || isObservationStub(deltas.meta)) return null;
  const { from, to } = deltas.meta;
  const before = readJson<PubgPatchAggregate>(`weapons-${from}.json`);
  const after = readJson<PubgPatchAggregate>(`weapons-${to}.json`);
  const notesFile = readJson<{ items: PubgNoteItem[] }>(`notes-${to}.json`);
  if (!before || !after || !notesFile) return null;

  const accuracyFile = readJson<PubgAccuracyComparisonFile>("accuracy-comparison.json");

  return {
    deltas,
    before,
    after,
    notes: notesFile.items,
    accuracyComparison: accuracyFile?.rows ?? null,
  };
}

/** 선언 축만 있는 최신 쌍(C13·C14) — 수기 노트와 관측이 없는 사유. */
export interface PubgDeclaration {
  from: string;
  to: string;
  generatedAt: string;
  notes: PubgNoteItem[];
  failure: ObservationFailure;
}

/**
 * `deltas.json`이 관측 stub이면 그 쌍의 선언 축을 준다. 관측 쌍이거나 노트가 없으면 null. 화면은
 * `loadPubg()`가 null일 때 이것을 본다 — 수기로 넣은 노트가 비교 구간을 기다리느라 숨지 않게(결정 8).
 */
export function loadPubgDeclaration(): PubgDeclaration | null {
  const stub = readJson<{ meta: { from: string; to: string; generatedAt: string; observationFailed?: ObservationFailure } }>(
    "deltas.json"
  );
  if (!stub || !stub.meta.observationFailed) return null;
  const notesFile = readJson<{ items: PubgNoteItem[] }>(`notes-${stub.meta.to}.json`);
  if (!notesFile) return null;
  return { from: stub.meta.from, to: stub.meta.to, generatedAt: stub.meta.generatedAt, notes: notesFile.items, failure: stub.meta.observationFailed };
}

export interface PubgMapDeltasFile {
  meta: {
    game: "pubg";
    from: string;
    to: string;
    generatedAt: string;
    n: number;
    note: string;
    /** 한쪽 구간에만 표본이 잡힌 맵 — 비교행을 만들지 않은 사실을 숨기지 않는다. */
    onlyBefore: string[];
    onlyAfter: string[];
  };
  rows: PubgMapDeltaRow[];
}

export interface PubgMapBundle {
  before: PubgMapAggregate;
  after: PubgMapAggregate;
  deltas: PubgMapDeltasFile;
}

/**
 * 맵 축(2026-09-17, A4) — **무기 축과 독립적으로 없을 수 있다**. 맵 집계는 판정을 만들지
 * 않으므로 출하 게이트(`loadPubg`의 판정 건수 검사)에 참여하지 않는다. 없으면 맵 상세 라우트가
 * 0개 생성될 뿐이고 나머지 화면은 그대로 산다.
 */
export function loadPubgMaps(): PubgMapBundle | null {
  const deltas = readJson<PubgMapDeltasFile>("map-deltas.json");
  if (!deltas) return null;
  // 쌍은 산출물 meta에서 읽는다 — 하드코딩하면 다음 패치에서 조용히 옛 쌍을 보여준다(`pubgPair` 참고).
  const before = readJson<PubgMapAggregate>(`maps-${deltas.meta.from}.json`);
  const after = readJson<PubgMapAggregate>(`maps-${deltas.meta.to}.json`);
  if (!before || !after) return null;
  return { before, after, deltas };
}

/**
 * 자산 매니페스트 — `scripts/run-pubg-assets.ts` 산출물. 없으면 **자산이 하나도 없다고 본다**
 * (있다고 가정하고 깨진 `<img>`를 내보내는 것보다 폴백이 정직하다).
 *
 * 실측(2026-09-17): 무기 47종 중 38종만 공식 렌더가 존재한다 — RPD·권총류·JS9·M79는
 * `pubg/api-assets`에 아예 없다. 하필 RPD는 이 패치의 대표 판정 대상이라, 폴백은 예외 처리가
 * 아니라 **정상 경로**다.
 */
export function loadPubgAssets(): PubgAssetManifest | null {
  return readJson<PubgAssetManifest>("assets.json");
}

// `isReportable`은 클라이언트 번들 안전 모듈(pipeline/shared/pubg-status.ts)에 있다 — 서버 호출부 호환용 재export.
export { isReportable } from "@/pipeline/shared/pubg-status";
