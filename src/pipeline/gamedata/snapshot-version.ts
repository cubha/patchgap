// src/pipeline/gamedata/snapshot-version.ts
// 수치 축(F9)이 **어느 두 게임 버전을 대조할지** 고르는 순수 규칙.
//
// 왜 필요한가(2026-09-21): cron은 "지금 라이브인 패치"(26.19·18.3)만 안다. 그런데 수치 스냅숏은
// 게임 버전(16.19.1·16.19)으로 이름이 붙는다. 그 대응은 **규칙이 아니라 사실**이라 계산할 수
// 없다 — TFT 18.2 ↔ 16.18, LoL 26.18 ↔ 16.18.1처럼 게임마다 다른 축이다.
//
// 대신 그 사실은 이미 저장소에 있다. ① `versionFrom`은 **직전 쌍 산출물의 `meta.source.to`**다
// (실측: `gamedata/lol/26.17_26.18.json`의 source.to = "16.18.1"). ② `versionTo`는 같은 잡의 앞
// 스텝(`run-ddragon`·`run-cdragon`)이 방금 받아 둔 **가장 새 스냅숏 디렉터리**다.
//
// 그래서 새 매핑 파일도, 사람이 손으로 채우는 표도 필요 없다. 여기는 디렉터리 이름 목록과 파일
// 이름 목록만 받는 순수 함수고, fs는 호출부(`scripts/run-gamedata-diff.ts`)가 갖는다.

/** `16.18.1`·`16.18`처럼 점으로 나뉜 숫자만 버전으로 본다(`patch-versions.json` 같은 이웃 제외). */
const VERSION_LABEL = /^\d+(?:\.\d+)*$/;

/**
 * 버전 라벨 내림차순 비교. **문자열 정렬을 쓰면 안 된다** — `"16.9.1" > "16.18.1"`이 되어
 * 한 자리 마이너가 두 자리를 이긴다(16.9가 나오는 해에 조용히 틀린다).
 * 자릿수가 다르면 없는 자리를 0으로 본다(`16.18` < `16.18.1`).
 */
export function compareVersionDesc(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = left[i] ?? 0;
    const y = right[i] ?? 0;
    if (x !== y) return y - x;
  }
  return 0;
}

/** 후보 디렉터리 이름 중 가장 새 버전. 없으면 `null` — 호출부가 사유를 붙여 던진다. */
export function newestVersion(versions: readonly string[]): string | null {
  const sorted = versions.filter((v) => VERSION_LABEL.test(v)).sort(compareVersionDesc);
  return sorted[0] ?? null;
}

/**
 * 그 패치를 **`to`로 삼은** 산출물 파일명(`{from}_{patch}.json`). 방향이 중요하다 — `{patch}_{...}`를
 * 집으면 버전이 한 칸 밀려 전 패치의 값을 이번 패치 것으로 읽는다.
 *
 * 패치가 건너뛰어져도(26.18 → 26.20) 이 함수는 26.18을 `to`로 가진 쌍을 찾으므로 그대로 성립한다.
 * 같은 `to`가 여럿이면 `from`이 가장 나중인 것 — 가장 가까운 직전 쌍이다.
 */
export function diffFileEndingAt(files: readonly string[], patch: string): string | null {
  const suffix = `_${patch}.json`;
  const matched = files
    .filter((f) => f.endsWith(suffix))
    .sort((a, z) => compareVersionDesc(a.slice(0, -suffix.length), z.slice(0, -suffix.length)));
  return matched[0] ?? null;
}
