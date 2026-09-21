// src/pipeline/match/tft-catalog.ts
// TFT 엔티티 사전 — Data Dragon에서 받아 **현행 세트만** 남긴다.
//
// 왜 거르나(2026-09-20 실측): DDragon TFT 파일은 역대 전 세트를 함께 담는다
// (아이템 1187 · 증강 758 · 특성 355 · 유닛 334). 거르지 않고 쓰면 두 가지가 동시에 터진다.
//   ① **오탐** — `tft-item.json`에 「12골드」·「10골드」·「4단계」 같은 표시명이 있어서
//      「12골드 획득 요구 처치 횟수: 6회 ⇒ 8회」의 엔티티가 *아이템 「12골드」*로 잡힌다.
//      실제로 거르기 전 해소 결과의 상위 3개가 전부 이 오탐이었다.
//   ② **철 지난 이름** — Set 15·16·17의 유닛이 현행 패치 엔티티로 올라온다.
// 세트를 거르면 유닛 64 · 특성 36 · 증강 31 · 아이템 154로 줄고 위 오탐이 사라진다.
//
// 세트 판별: TFT 패치 번호와 세트 번호가 같다(18.2 ↔ Set 18). 키에 `TFTSet18/` 경로가
// 있거나 `DA_` 네임스페이스면 현행 세트다 — 현행 세트 항목은 `DA_18_Blackthorn`(검은 가시)처럼
// `DA_18_`을 쓰고, 세트 번호가 안 붙은 `DA_TheGoldenDragon`(황금 드래곤) 형태도 함께 쓴다.
import type { TftCatalog } from "./tft-notes-parser";

const DDRAGON_BASE = "https://ddragon.leagueoflegends.com";

interface DdEntry {
  name?: string;
}
interface DdFile {
  data: Record<string, DdEntry>;
}

/** 파일명 → 카탈로그 필드. */
const FILES = {
  units: "tft-champion",
  traits: "tft-trait",
  augments: "tft-augments",
  items: "tft-item",
} as const;

/**
 * 이 키가 `setNumber` 세트(= 현행)에 속하나.
 * - `…/TFTSet18/Shop/DA_Lux18_Base` — 경로에 세트가 박혀 있다(유닛·아이템).
 * - `DA_18_Blackthorn` · `DA_TheGoldenDragon` — `DA_` 네임스페이스(특성·증강).
 */
export function isCurrentSetKey(key: string, setNumber: number): boolean {
  if (key.includes(`TFTSet${setNumber}/`)) return true;
  if (!/(?:^|\/)DA_/.test(key)) return false;
  // `DA_` 항목 중 세트 번호가 박힌 것은 그 번호가 맞아야 한다 — 이걸 안 보면 세트 19에서
  // `DA_18_*`이 통째로 딸려 들어와 철 지난 엔티티가 조용히 섞인다.
  const stamped = /(?:^|\/)DA_(\d+)_/.exec(key);
  return stamped === null || Number(stamped[1]) === setNumber;
}

/** 패치 「18.2」 → 세트 18. TFT는 패치 주번호와 세트 번호가 같다. */
export function setNumberOfPatch(patch: string): number {
  const major = Number.parseInt(patch.split(".")[0] ?? "", 10);
  if (!Number.isFinite(major)) {
    throw new Error(`TFT 패치에서 세트 번호를 못 읽었다: ${patch}`);
  }
  return major;
}

/**
 * 키 → 표시명. **매치 데이터는 키로, 패치노트는 한국어 이름으로** 오기 때문에 둘을 이으려면
 * 이 매핑이 필요하다. DDragon 유닛 키는 전체 경로(`…/TFTSet18/Shop/DA_Lux18_Base`)인데
 * 매치 응답은 마지막 조각(`DA_Lux18_Base`)만 주므로 **basename으로 색인한다**(실측 확인:
 * 이 방식으로 유닛 65종 중 55종이 붙고, 나머지 10종은 전부 PvE 몬스터라 원래 제외 대상이다).
 */
export function selectCurrentSetIndex(file: DdFile, setNumber: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(file.data)) {
    if (!isCurrentSetKey(key, setNumber)) continue;
    const name = entry.name?.trim();
    if (!name) continue;
    const basename = key.slice(key.lastIndexOf("/") + 1);
    // 먼저 등록된 것을 유지한다 — 같은 basename이 두 번 나오면 앞선 항목이 더 구체적이다.
    if (!(basename in out)) out[basename] = name;
  }
  return out;
}

export function selectCurrentSetNames(file: DdFile, setNumber: number): string[] {
  const names = new Set<string>();
  for (const [key, entry] of Object.entries(file.data)) {
    if (!isCurrentSetKey(key, setNumber)) continue;
    const name = entry.name?.trim();
    if (name) names.add(name);
  }
  return [...names].sort();
}

/**
 * Community Dragon 추출본의 최소 모양 — `data/cdragon/{version}/tft.json`(수치 축이 쓰는 그 파일).
 * 이름만 읽는다. 수치는 `src/pipeline/gamedata/tft.ts`의 몫이다.
 */
export interface CdragonNameFile {
  readonly set: string;
  readonly units: Record<string, { readonly name?: string }>;
  readonly items: Record<string, { readonly name?: string }>;
}

/**
 * CDragon 추출본에서 **현행 세트** 표시명만 뽑는다.
 *
 * 왜 필요한가(2026-09-21 실측): DDragon `tft-champion.json`에는 덩굴정령·어미 부리·수호령류가
 * **아예 없다**(카직스는 있다). 그래서 파서가 그 줄들을 「대상 미해소」로 버렸고 — 노트 179줄 중
 * 60줄(34%) — 그 줄이 말한 수치 변경이 잠수함으로 잘못 잡혔다.
 * 근거: `docs/plan/VERIFY-tft-submarine-2026-09-21.md` §3·§5.
 *
 * 세트 필터는 `isCurrentSetKey` **그대로** 쓴다. CDragon도 역대 전 세트를 담기 때문에
 * (아이템 2,719개) 거르지 않으면 옛 세트 `TFT17_MarketOffering_1star4cost_Eve`의 표시명
 * 「4단계」가 엔티티로 잡힌다 — DDragon에서 이미 겪은 「12골드」 오탐과 같은 종류다.
 */
export function cdragonSetNames(
  file: CdragonNameFile,
  setNumber: number
): { units: string[]; items: string[] } {
  // 스냅숏의 세트와 패치의 세트가 어긋나면 **조용히 옛 이름을 섞지 않고** 던진다 —
  // 이 함수가 존재하는 이유 자체가 카탈로그가 조용히 틀렸던 사건이다.
  if (file.set !== `TFTSet${setNumber}`) {
    throw new Error(`CDragon 추출본의 세트가 패치와 어긋난다: ${file.set} ≠ TFTSet${setNumber}`);
  }
  const pick = (rec: Record<string, { readonly name?: string }>): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const [key, entry] of Object.entries(rec)) {
      if (!isCurrentSetKey(key, setNumber)) continue;
      const name = entry.name?.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  };
  return { units: pick(file.units), items: pick(file.items) };
}

export interface FetchTftCatalogOptions {
  patch: string;
  /** DDragon 버전. 생략하면 versions.json의 최신을 쓴다. */
  version?: string;
  locale?: string;
  fetchImpl?: typeof fetch;
  /**
   * CDragon 추출본. 주면 유닛·아이템 이름을 **더한다**(DDragon 이름은 그대로 둔다 — 두 출처의
   * 표기가 다를 수 있고, 기존에 붙던 이름이 떨어지면 커밋된 노트 id가 통째로 바뀐다).
   * 특성·증강은 추출본에 없으므로 손대지 않는다.
   */
  cdragon?: CdragonNameFile;
}

async function fetchDd(
  doFetch: typeof fetch,
  version: string,
  locale: string,
  file: string
): Promise<DdFile> {
  const res = await doFetch(`${DDRAGON_BASE}/cdn/${version}/data/${locale}/${file}.json`);
  if (!res.ok) throw new Error(`DDragon ${file} ${res.status}`);
  return (await res.json()) as DdFile;
}

async function resolveVersion(doFetch: typeof fetch, given?: string): Promise<string> {
  if (given) return given;
  const res = await doFetch(`${DDRAGON_BASE}/api/versions.json`);
  if (!res.ok) throw new Error(`DDragon versions.json ${res.status}`);
  return ((await res.json()) as string[])[0];
}

/** 키 색인 3종 — 집계가 관측 키에 표시명을 붙일 때 쓴다. */
export interface TftKeyIndex {
  units: Record<string, string>;
  traits: Record<string, string>;
  items: Record<string, string>;
}

export async function fetchTftKeyIndex(options: FetchTftCatalogOptions): Promise<TftKeyIndex> {
  const doFetch = options.fetchImpl ?? fetch;
  const locale = options.locale ?? "ko_KR";
  const setNumber = setNumberOfPatch(options.patch);
  const version = await resolveVersion(doFetch, options.version);

  const [units, traits, items] = await Promise.all([
    fetchDd(doFetch, version, locale, "tft-champion"),
    fetchDd(doFetch, version, locale, "tft-trait"),
    fetchDd(doFetch, version, locale, "tft-item"),
  ]);
  return {
    units: selectCurrentSetIndex(units, setNumber),
    traits: selectCurrentSetIndex(traits, setNumber),
    items: selectCurrentSetIndex(items, setNumber),
  };
}

/** 빌드 이전 파이프라인에서만 호출한다 — 런타임(브라우저) 호출 금지. */
export async function fetchTftCatalog(options: FetchTftCatalogOptions): Promise<TftCatalog> {
  const doFetch = options.fetchImpl ?? fetch;
  const locale = options.locale ?? "ko_KR";
  const setNumber = setNumberOfPatch(options.patch);

  let version = options.version;
  if (!version) {
    const res = await doFetch(`${DDRAGON_BASE}/api/versions.json`);
    if (!res.ok) throw new Error(`DDragon versions.json ${res.status}`);
    const versions = (await res.json()) as string[];
    version = versions[0];
  }

  const entries = await Promise.all(
    (Object.entries(FILES) as [keyof typeof FILES, string][]).map(async ([field, file]) => {
      const res = await doFetch(`${DDRAGON_BASE}/cdn/${version}/data/${locale}/${file}.json`);
      if (!res.ok) throw new Error(`DDragon ${file} ${res.status}`);
      const parsed = (await res.json()) as DdFile;
      return [field, selectCurrentSetNames(parsed, setNumber)] as const;
    })
  );

  const out: Record<string, string[]> = {};
  for (const [field, names] of entries) out[field] = names;

  // 보강은 **덧셈만** 한다 — 기존 이름을 지우면 이미 커밋된 노트 id가 전부 바뀐다.
  const extra = options.cdragon ? cdragonSetNames(options.cdragon, setNumber) : { units: [], items: [] };
  const merge = (base: string[], add: string[]): string[] => [...new Set([...base, ...add])];

  return {
    units: merge(out.units ?? [], extra.units),
    traits: out.traits ?? [],
    augments: out.augments ?? [],
    items: merge(out.items ?? [], extra.items),
  };
}
