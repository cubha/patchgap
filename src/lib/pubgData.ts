// src/lib/pubgData.ts
// PUBG 집계 산출물의 빌드 타임 로더 — data.ts(LoL)와 같은 역할이되 네임스페이스가 분리돼 있다.
// 런타임 외부 호출 0 원칙에 따라 여기서 읽는 것은 전부 커밋된 정적 JSON이다.
//
// **출하 게이트**(SCOPE 2026-09-16 해제 조건): 파일이 없거나 근거 딸린 판정이 0건이면
// `loadPubg()`가 null을 반환하고, 그 경우 페이지·네비 링크를 렌더하지 않는다. 빈 껍데기 탭이
// 배포되면 LoL 본편 신뢰도까지 깎이므로 "데이터가 없으면 아예 없다"가 기본값이다.
import fs from "node:fs";
import path from "node:path";
import type { MatchStatus } from "@/pipeline/types";
import type { PubgPatchAggregate } from "@/pipeline/aggregate/pubg-weapons";
import type { PubgAccuracyStat } from "@/pipeline/aggregate/pubg-accuracy";
import type { PubgMapAggregate, PubgMapDeltaRow } from "@/pipeline/aggregate/pubg-maps";
import type { PubgAssetManifest } from "@/pipeline/pubg/asset-path";
import type { PubgDeltaRow, PubgNoteItem } from "@/pipeline/match/pubg-delta";

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
  const full = path.join(PUBG_DIR, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

/**
 * 네 파일이 모두 있고 **판정이 1건 이상 근거를 가질 때만** 번들을 반환한다.
 * 하나라도 없으면 null — 호출부는 null이면 PUBG를 화면에서 완전히 뺀다.
 */
export function loadPubg(): PubgBundle | null {
  const deltas = readJson<PubgDeltasFile>("deltas.json");
  const before = readJson<PubgPatchAggregate>("weapons-42.3.json");
  const after = readJson<PubgPatchAggregate>("weapons-43.1.json");
  const notesFile = readJson<{ items: PubgNoteItem[] }>("notes-43.1.json");
  if (!deltas || !before || !after || !notesFile) return null;

  const verdicts = deltas.rows.filter((row) => isReportable(row.status)).length;
  if (verdicts === 0) return null;

  const accuracyFile = readJson<PubgAccuracyComparisonFile>("accuracy-comparison.json");

  return {
    deltas,
    before,
    after,
    notes: notesFile.items,
    accuracyComparison: accuracyFile?.rows ?? null,
  };
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
  const before = readJson<PubgMapAggregate>("maps-42.3.json");
  const after = readJson<PubgMapAggregate>("maps-43.1.json");
  const deltas = readJson<PubgMapDeltasFile>("map-deltas.json");
  if (!before || !after || !deltas) return null;
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

/** 화면 상단 "발견" 영역에 올릴 자격이 있는 판정 — 근거가 실제로 선 것만. */
export function isReportable(status: MatchStatus): boolean {
  return (
    status === "announced-consistent" ||
    status === "announced-inconsistent" ||
    status === "unannounced"
  );
}
