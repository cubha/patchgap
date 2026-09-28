// src/pipeline/match/ddragon.ts
// Data Dragon 매핑 계층 — 챔피언/아이템 한글명 ↔ ddragon key, 완성템 판정.
// 순수 읽기 함수만 담는다(네트워크 호출 없음) — 실제 다운로드는 scripts/run-ddragon.ts 몫이다
// (디렉토리 규칙: "런타임 외부 API 호출은 collect/*와 match/llm-match.ts에 한정" — ddragon.ts는
// 로컬 data/ddragon/{version}/{champion,item}.json을 읽기만 한다).
//
// 실측(2026-09-05, ddragon.leagueoflegends.com 라이브 curl):
// - `data/ko_KR/champion.json`의 `data[X].name`(한글)이 실데이터 패치노트 엔티티명과 32/32(26.17)
//   전부 정확히 일치한다(공백 포함 "아우렐리온 솔"·"문도 박사"도 그대로 일치) — 정규화 없이도
//   대부분 매칭되지만, 26.16의 "신규 아칼리" 같은 접두 변형(스킨 리메이크 공지) 대비 정규화 함수는
//   남겨둔다.
// - `championName`(ST-06 `ChampionStat.championKey`가 그대로 쓰는 값, Riot API 원문)이 ddragon의
//   `id` 필드(PascalCase, 예 "LeeSin"·"AurelionSol"·"Chogath")와 대부분 일치한다 — 그래도
//   `championId`(숫자)가 유일하게 안정적인 조인 키이므로 `byKey`를 1차 매핑 경로로 쓴다.
// - 아이템 한글명은 **게임 모드 간 충돌한다**: 예 "폭풍갈퀴"가 SR 완성템(id 3095, `maps.11===true`,
//   실제 `data/aggregated/26.17/items.json`에 등장)과 아레나 전용 변형(id 223095,
//   `maps.11===false`, 우리 집계에 등장하지 않음) 둘 다에 쓰인다. 그래서 `items.byKoName`은
//   단일 id가 아니라 **후보 배열**(itemId 오름차순)을 반환한다 — entity-match가 실제 존재하는
//   델타(entityKey)와 대조해 올바른 후보를 고른다.

import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "../shared/paths";

/** 완성템 판정에서 제외하는 태그(부츠·소모품·장신구) — PLAN ③ ST-08 행 기준. */
const EXCLUDED_COMPLETED_TAGS = new Set(["Boots", "Consumable", "Trinket"]);

/** 완성템 최소 총 가격(골드) 기준 — PLAN ③ ST-08 행 "gold.total >= 1600". */
export const COMPLETED_ITEM_MIN_GOLD = 1600;

export interface DdragonChampion {
  /** ddragon id (PascalCase 슬러그, 예 "Aatrox"). */
  id: string;
  /** 숫자 championId — Riot 매치 데이터의 championId와 직접 대응(유일하게 안정적인 조인 키). */
  key: number;
  /** 한글 표시명(ko_KR). */
  name: string;
}

export interface DdragonItemGold {
  base: number;
  purchasable: boolean;
  total: number;
  sell: number;
}

export interface DdragonItem {
  id: number;
  name: string;
  /** 이 아이템이 업그레이드되는 상위 아이템 id 목록 — 빈 배열이면 "더 이상 업그레이드 없음". */
  into: number[];
  from: number[];
  gold: DdragonItemGold;
  tags: string[];
}

export interface DdragonChampionIndex {
  byKey(numericId: number): DdragonChampion | undefined;
  byId(ddragonId: string): DdragonChampion | undefined;
  /** 한글명(정규화 후) → 챔피언. 챔피언명은 게임 모드 간 충돌이 없어 단일 결과. */
  byKoName(koName: string): DdragonChampion | undefined;
}

export interface DdragonItemIndex {
  byId(itemId: number): DdragonItem | undefined;
  /** 한글명(정규화 후) → 후보 아이템 배열(itemId 오름차순). 게임 모드 간 이름 충돌이 있어
   * 배열로 반환한다 — 소비처가 실제 존재하는 델타와 대조해 골라야 한다. */
  byKoName(koName: string): DdragonItem[];
  isCompleted(itemId: number): boolean;
}

export interface DdragonData {
  version: string;
  champions: DdragonChampionIndex;
  items: DdragonItemIndex;
}

/**
 * 완성템 판정 — `into`가 없거나 빈 배열(더 이상 업그레이드 안 됨) + `gold.purchasable`
 * + `gold.total >= COMPLETED_ITEM_MIN_GOLD`(1600) + 부츠·소모품·장신구 태그 제외.
 */
export function isCompletedItem(item: Pick<DdragonItem, "into" | "gold" | "tags">): boolean {
  const hasNoUpgrade = item.into.length === 0;
  const isExcludedTag = item.tags.some((tag) => EXCLUDED_COMPLETED_TAGS.has(tag));
  return (
    hasNoUpgrade &&
    item.gold.purchasable &&
    item.gold.total >= COMPLETED_ITEM_MIN_GOLD &&
    !isExcludedTag
  );
}

/**
 * 한글 엔티티명 정규화 — 공백·중점(·/ㆍ/・)·따옴표류 제거 후 유니코드 NFKC 정규화. 패치노트
 * 엔티티명 표기 변형(예: 향후 "챔피언 · 스킬" 같은 구두점 변형)을 흡수하기 위한 방어적 계층 —
 * 실측(26.17)으로는 원문 그대로도 100% 일치했지만 26.16의 "신규 아칼리"류(스킨 리메이크 접두)는
 * 이 정규화만으로 해소되지 않아 매핑 실패 목록에 남는다(entity-match가 보고).
 */
export function normalizeKoName(input: string): string {
  // 순서 중요: NFKC 정규화가 "ㆍ"(U+318D, 한글 자모)를 "ᆞ"(U+119E, 호환 자모)로 바꿔버려
  // 정규화 뒤에 지우면 원래 문자 클래스로 못 잡는다 — 중점류를 먼저 지우고 나서 NFKC를 적용한다.
  return input
    .replace(/[\s'"'’“”`ㆍᆞ·・]/gu, "")
    .normalize("NFKC")
    .trim();
}

interface RawChampionEntry {
  id: string;
  key: string;
  name: string;
}

interface RawChampionFile {
  data: Record<string, RawChampionEntry>;
}

interface RawItemEntry {
  name: string;
  stats?: Record<string, number>;
  into?: string[] | null;
  from?: string[] | null;
  gold: DdragonItemGold;
  tags?: string[];
}

interface RawItemFile {
  data: Record<string, RawItemEntry>;
}

export interface LoadDdragonOptions {
  /** 테스트 격리용 — 기본은 shared/paths.ts의 DATA_ROOT. */
  dataRoot?: string;
}

function ddragonVersionDir(dataRoot: string, version: string): string {
  return path.join(dataRoot, "ddragon", version);
}

function readJsonFile<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ddragon data not found: ${filePath} — 먼저 실행: npx tsx scripts/run-ddragon.ts`
    );
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

/** "16.17.1" 같은 점 구분 버전 문자열 내림차순 비교(semver 근사 — ddragon 버전은 항상 숫자 3단). */
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function resolveVersion(dataRoot: string, version: string | undefined): string {
  if (version) return version;

  const base = path.join(dataRoot, "ddragon");
  if (!fs.existsSync(base)) {
    throw new Error(
      `ddragon 데이터가 없습니다(${base}) — 먼저 실행: npx tsx scripts/run-ddragon.ts`
    );
  }
  const versions = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareVersionsDesc);

  if (versions.length === 0) {
    throw new Error(
      `ddragon 버전 디렉토리가 없습니다(${base}) — 먼저 실행: npx tsx scripts/run-ddragon.ts`
    );
  }
  return versions[0];
}

/**
 * `data/ddragon/{version}/{champion,item}.json`(scripts/run-ddragon.ts가 다운로드한 로컬 파일)을
 * 읽어 매핑 인덱스를 만든다. `version` 생략 시 로컬에 다운로드된 버전 중 최신(semver 내림차순)을
 * 쓴다 — 네트워크 호출 없음(사전 인덱싱 원칙: ddragon fetch는 run-ddragon.ts 전용).
 */
export function loadDdragon(version?: string, options: LoadDdragonOptions = {}): DdragonData {
  const dataRoot = options.dataRoot ?? DATA_ROOT;
  const resolvedVersion = resolveVersion(dataRoot, version);
  const dir = ddragonVersionDir(dataRoot, resolvedVersion);

  const championFile = readJsonFile<RawChampionFile>(path.join(dir, "champion.json"));
  const itemFile = readJsonFile<RawItemFile>(path.join(dir, "item.json"));

  const champions: DdragonChampion[] = Object.values(championFile.data).map((entry) => ({
    id: entry.id,
    key: Number(entry.key),
    name: entry.name,
  }));

  const items: DdragonItem[] = Object.entries(itemFile.data)
    .map(([id, entry]) => ({
      id: Number(id),
      name: entry.name,
      into: (entry.into ?? []).map(Number),
      from: (entry.from ?? []).map(Number),
      gold: entry.gold,
      tags: entry.tags ?? [],
    }))
    .sort((a, b) => a.id - b.id);

  const championByKey = new Map<number, DdragonChampion>();
  const championById = new Map<string, DdragonChampion>();
  const championByKoName = new Map<string, DdragonChampion>();
  for (const champion of champions) {
    championByKey.set(champion.key, champion);
    championById.set(champion.id, champion);
    championByKoName.set(normalizeKoName(champion.name), champion);
  }

  const itemById = new Map<number, DdragonItem>();
  const itemByKoName = new Map<string, DdragonItem[]>();
  for (const item of items) {
    itemById.set(item.id, item);
    const key = normalizeKoName(item.name);
    const bucket = itemByKoName.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      itemByKoName.set(key, [item]);
    }
  }

  return {
    version: resolvedVersion,
    champions: {
      byKey: (numericId) => championByKey.get(numericId),
      byId: (ddragonId) => championById.get(ddragonId),
      byKoName: (koName) => championByKoName.get(normalizeKoName(koName)),
    },
    items: {
      byId: (itemId) => itemById.get(itemId),
      byKoName: (koName) => itemByKoName.get(normalizeKoName(koName)) ?? [],
      isCompleted: (itemId) => {
        const item = itemById.get(itemId);
        return item !== undefined && isCompletedItem(item);
      },
    },
  };
}

/** 전부 undefined/빈 배열을 반환하는 무해 폴백 — `loadDdragonSafe`가 ddragon 데이터 부재 시
 * 반환한다. 모든 필드가 함수(클로저 상태 없음)라 여러 소비처가 동시에 공유해도 안전하다. */
export const EMPTY_DDRAGON: DdragonData = {
  version: "",
  champions: { byKey: () => undefined, byId: () => undefined, byKoName: () => undefined },
  items: { byId: () => undefined, byKoName: () => [], isCompleted: () => false },
};

/** `loadDdragon`이 데이터 부재(run-ddragon.ts 미실행 등)로 throw해도 페이지가 크래시하지
 * 않게 하는 안전 래퍼 — 아이콘 해석이 홈(page.tsx)·대조표(compare/page.tsx) 양쪽에서 쓴다. */
export function loadDdragonSafe(version?: string, options: LoadDdragonOptions = {}): DdragonData {
  try {
    return loadDdragon(version, options);
  } catch {
    return EMPTY_DDRAGON;
  }
}

/** 로컬 DDragon 버전 목록(내림차순). 디렉터리가 없으면 빈 배열. */
export function listDdragonVersions(options: LoadDdragonOptions = {}): string[] {
  const base = path.join(options.dataRoot ?? DATA_ROOT, "ddragon");
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(compareVersionsDesc);
}

/**
 * 아이템 이름 → DDragon 수치 표(2026-09-28, C2 합친 이름 노트 분해용). 이름 정규화는 `byKoName`과 같다.
 * 파일이 없으면 **던진다** — 조용히 빈 표를 주면 분해가 「검증할 수치 없음」으로 떨어져 결함이 숨는다.
 */
export function loadItemStatTable(version: string, options: LoadDdragonOptions = {}): {
  byName(name: string): { id: string; stats: Record<string, number> }[];
} {
  const file = path.join(ddragonVersionDir(options.dataRoot ?? DATA_ROOT, version), "item.json");
  const raw = readJsonFile<RawItemFile>(file);
  const byName = new Map<string, { id: string; stats: Record<string, number> }[]>();
  for (const [id, entry] of Object.entries(raw.data)) {
    const key = normalizeKoName(entry.name);
    byName.set(key, [...(byName.get(key) ?? []), { id, stats: entry.stats ?? {} }]);
  }
  return { byName: (name) => byName.get(normalizeKoName(name)) ?? [] };
}
