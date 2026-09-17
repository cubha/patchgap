// src/pipeline/shared/cosmetic-skin.ts
// 치장 노트 → Data Dragon 스킨 매칭(순수 함수). I/O 없음 — 인덱스 생성·자산 조달은
// `scripts/run-ddragon.ts`, 렌더는 `components/home/CosmeticSkinPreview.tsx`.
//
// **왜 이게 성립하는가**(2026-09-17 실측): 패치노트가 쓰는 스킨 이름이 Data Dragon ko_KR
// 스킨명과 **글자 그대로 같다**. "떠오른 전설 오리아나" → `Orianna` skins[40]
// `"떠오른 전설 오리아나"`. 유추·정규화·유사도 계산이 전혀 필요 없고, 그래서 이 매칭은
// **결정론적**이다. 이름을 추측해야 했다면 이 기능 자체를 만들지 않았을 것이다
// (`docs/plan/COSMETIC-SPLASH-FEASIBILITY-2026-09-17.md` 판정).
//
// **최장 일치를 쓰는 이유**: 한 챔피언의 스킨명은 접두를 공유한다 — `창공 아칼리` ·
// `창공 아칼리 (루비)` · `창공 아칼리 (질서)` …. 요약문에 `창공 아칼리 (질서)`가 있으면
// 그쪽이 정답이고, 짧은 쪽을 먼저 잡으면 더 구체적인 이름을 놓친다.
//
// **못 잡는 것을 채우지 않는다**: 크로마·아이콘·감정표현·와드·휘장·칭호·정수는 Data Dragon
// 배포 범위 밖이라 자산이 **없다**. 비슷한 이미지를 대신 넣으면 "그 크로마를 보여준다"는
// 거짓이 되므로, 매칭 실패는 이미지 없음으로 끝낸다(무근거 문장은 회색과 같은 규율).

/** 스킨 1종 — 인덱스 파일의 행이자 매칭 결과. */
export interface SkinRef {
  /** Data Dragon 챔피언 id(`Orianna`) — 스플래시 파일명의 앞부분. */
  championId: string;
  /** 스킨 번호 — 스플래시 파일명의 뒷부분(`Orianna_40.jpg`). */
  num: number;
  /** ko_KR 스킨명(`떠오른 전설 오리아나`). */
  name: string;
}

/**
 * ⚠️ 필드를 늘리지 않는다 — 이 파일은 9,120행이라 필드 하나가 곧 수십 KB다.
 * 챔피언 한국어명은 **넣지 않았다**: ko_KR 스킨명이 이미 챔피언명을 품고 있어
 * ("떠오른 전설 오리아나") 소비자가 없다. 소비자 없는 필드로 커밋 JSON을 부풀리지 않는다는
 * 기존 관례(`stats.ts` proportionNumerator 주석)와 같은 판단이다.
 */
export interface SkinIndexFile {
  meta: {
    /** 인덱스를 만든 Data Dragon 버전. */
    version: string;
    generatedAt: string;
    /** 전체 스킨 수(기본 스킨 제외). */
    count: number;
  };
  skins: SkinRef[];
}

/**
 * 매칭 후보에서 제외할 스킨.
 *
 * - `num === 0` / `"default"`: 기본 스킨은 "신규 스킨"이 아니다.
 * - 이름이 너무 짧음: 2글자 이하 스킨명은 무관한 문장에 우연히 포함될 위험이 실익보다 크다.
 */
export function isMatchableSkin(skin: SkinRef): boolean {
  if (skin.num === 0) return false;
  if (skin.name === "default") return false;
  return skin.name.trim().length >= 3;
}

/**
 * 요약문에 **글자 그대로 등장하는** 스킨을 전부 찾는다.
 *
 * 한 줄이 여러 스킨을 나열하는 경우가 실제로 있다("프렐요드 탈리야, 나무정령 르블랑,
 * 창공 아칼리 스킨") — 그래서 단일 값이 아니라 배열을 돌려준다.
 *
 * 규칙:
 *  1. 후보는 `isMatchableSkin`을 통과한 것만.
 *  2. **이름 긴 순**으로 검사해, 이미 잡힌 구간과 겹치면 버린다(최장 일치).
 *  3. 결과는 **요약문에 나타난 순서**로 정렬한다 — 사람이 읽는 순서와 화면 순서를 맞춘다.
 *  4. 같은 스킨이 두 번 나와도 한 번만 돌려준다.
 */
export function matchSkinsInSummary(
  summary: string,
  skins: readonly SkinRef[],
  limit = 6
): SkinRef[] {
  const candidates = skins.filter(isMatchableSkin);
  // 긴 이름부터 — 짧은 접두가 먼저 자리를 차지하면 구체적인 이름을 잃는다.
  const byLengthDesc = [...candidates].sort((a, b) => b.name.length - a.name.length);

  const taken: Array<[number, number]> = [];
  const found: Array<{ at: number; skin: SkinRef }> = [];
  const seen = new Set<string>();

  for (const skin of byLengthDesc) {
    const at = summary.indexOf(skin.name);
    if (at < 0) continue;
    const end = at + skin.name.length;
    if (taken.some(([s, e]) => at < e && s < end)) continue; // 이미 더 긴 이름이 먹은 구간
    const key = `${skin.championId}:${skin.num}`;
    if (seen.has(key)) continue;
    seen.add(key);
    taken.push([at, end]);
    found.push({ at, skin });
  }

  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, limit)
    .map((f) => f.skin);
}

/** 스플래시 자산의 공개 경로 — `public/dd/splash/{championId}_{num}.jpg` 계약.
 * 기본 스킨(`_0`)은 이미 `heroSplash.ts`가 쓰던 같은 규약이라 디렉토리를 공유한다. */
export function skinSplashPath(skin: Pick<SkinRef, "championId" | "num">): string {
  return `/dd/splash/${skin.championId}_${skin.num}.jpg`;
}
