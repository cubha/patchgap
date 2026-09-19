// src/lib/game.ts
// 게임 스위처 + **경로 해석 단일 소스**. 게임들은 **같은 사이트**이고, 바뀌는 것은 내부 데이터와
// 테마뿐이다(PLAN-game-switcher-2026-09-17 R1·R2). 이 모듈은 그 전환의 경로 계산만 담당하는 순수
// 함수 집합이다(React·fs 의존 0 — 서버 레이아웃과 클라이언트 헤더가 함께 쓴다).
//
// **왜 게임 상태가 URL에 있나**: `next.config.ts`가 `output:'export'`(정적)이라 런타임
// 리다이렉트가 없고, 양 게임 데이터를 동시에 번들해 클라이언트에서 토글하면 "데이터 페칭은
// 빌드 타임에만 · 서버 컴포넌트 우선"(프로젝트 CLAUDE.md) 원칙과 충돌한다. 그래서 게임 =
// 경로 접두다. 저장(localStorage)은 하지 않는다 — 덕분에 FOUC 문제도 원리적으로 없다.
//
// **LoL도 접두를 갖는다(2026-09-19 사용자 지시로 번복)**: 이전 주석은 "LoL에는 접두가 없다 —
// 배포 URL·UptimeRobot 감시 대상·이미 공유된 링크가 전부 무접두라 `/lol/`을 새로 만들면 그것들이
// 한꺼번에 깨진다(PLAN X1)"였다. 사용자가 **루트에 랜딩을 두고 게임을 대칭으로 배치**하기로
// 결정하면서 그 근거는 유효하지 않게 됐다. 깨질 것들은 각각 이렇게 처리한다:
//   - 이미 공유된 링크 → `vercel.json`의 `redirects`가 구 3경로를 `/lol/**`로 넘긴다(정적
//     export라 Next 런타임 리다이렉트를 못 쓴다). 심사 기간 링크 사망은 평가 제외 사유다.
//   - UptimeRobot → 감시 대상이 `/health.txt`(루트 정적 파일)라 영향 없다.
//   - 디스코드 브리핑 링크 → `itemHref` 한 곳을 타므로 자동 반영된다.
//
// **랜딩은 어느 게임에도 속하지 않는다**: 그래서 `gameFromPathname`은 `GameId | null`이다.
// 이 null이 이 파일의 핵심 계약이다 — 랜딩에서 게임 테마·라인 카메라·인트로·활성 탭이 전부
// 꺼져야 하는데, 예전처럼 "모르면 LoL"로 떨어뜨리면 랜딩이 LoL 화면처럼 굴게 된다.

export type GameId = "lol" | "pubg";

export interface GameDef {
  id: GameId;
  /** 드롭다운·랜딩 패널에 보이는 이름 — 사용자 지정 한국어 정식 명칭. */
  label: string;
  /** 경로 접두. 반드시 `/`로 시작하고 후행 슬래시는 없다(`sectionHref`가 붙인다). */
  prefix: string;
  /** 랜딩 패널의 영문 이벤트 라벨(모노·자간). 원문 표기를 그대로 쓴다. */
  tag: string;
  /** 랜딩 패널 배경 키아트 — `public/` 기준 절대 경로. */
  art: string;
}

/** LoL이 먼저다 — 드롭다운 첫 옵션이자 랜딩 첫 패널(HANDOFF §3). */
export const GAMES: readonly GameDef[] = [
  {
    id: "lol",
    label: "리그 오브 레전드",
    prefix: "/lol",
    tag: "LEAGUE OF LEGENDS",
    art: "/bg/island.webp",
  },
  {
    id: "pubg",
    label: "배틀그라운드",
    prefix: "/pubg",
    tag: "PUBG: BATTLEGROUNDS",
    art: "/bg/pubg-key-art.webp",
  },
] as const;

function defOf(game: GameId): GameDef {
  const def = GAMES.find((g) => g.id === game);
  if (!def) throw new Error(`TODO(game): 알 수 없는 게임 "${game}" — GAMES에 추가한다.`);
  return def;
}

export function gameLabel(game: GameId): string {
  return defOf(game).label;
}

/** 경로를 세그먼트 배열로 — 선행·후행 슬래시와 빈 칸을 흡수한다. */
function segmentsOf(pathname: string): string[] {
  return pathname.split("/").filter((seg) => seg.length > 0);
}

/**
 * 경로 → 현재 게임. 게임에 속하지 않으면 `null`(랜딩, 그리고 리다이렉트 대상인 구 경로).
 * `/pubgfoo/`처럼 접두가 아닌 유사 경로를 오인하지 않도록 **세그먼트 단위**로 본다.
 */
export function gameFromPathname(pathname: string): GameId | null {
  const first = segmentsOf(pathname)[0];
  if (first === undefined) return null;
  return GAMES.find((g) => g.prefix === `/${first}`)?.id ?? null;
}

/**
 * 현재 경로에서 `game`으로 전환했을 때 가야 할 경로.
 * - 같은 게임이면 현재 경로를 그대로 둔다(상세 화면에서 이탈시키지 않는다).
 * - 다른 게임이면 **항상 그 게임의 브리핑**이다 — 2026-09-18 라운드6(사용자 C2
 *   "테마전환될때마다 초기화되도록. 브리핑 메뉴가 기본값"). 게임이 바뀌면 보던 맥락(엔티티·
 *   패치 쌍)이 전부 바뀌므로 진입점으로 돌아가는 쪽이 맞다. 정적 export에서 없는 경로는 곧
 *   404라, 브리핑은 언제나 실재하는 착지점이기도 하다.
 * - 랜딩(게임 없음)에서 골랐다면 "다른 게임" 분기다.
 */
export function gameHref(game: GameId, pathname: string): string {
  if (gameFromPathname(pathname) === game) return pathname;
  return sectionHref(game, "");
}

/**
 * 같은 게임 안에서 섹션(브리핑·대조표·방법론)으로 가는 경로.
 *
 * **왜 gameHref와 나뉘어 있나**(2026-09-19 회귀 수정): 헤더 내비가 `gameHref(game, "/"+section)`
 * 으로 링크를 만들고 있었다. gameHref는 "지금 있는 경로에서 **게임을 바꾸면** 어디로 가나"를
 * 답하는 함수인데, 넘긴 `/compare`는 무접두라 항상 LoL로 읽히고, 현재 게임이 PUBG면 "다른
 * 게임" 분기를 타 `/pubg/`(브리핑)를 돌려줬다. 그래서 PUBG에서는 대조표·방법론을 눌러도
 * 브리핑에 그대로 머물렀다(사용자 보고). 섹션 이동과 게임 전환은 다른 계산이다.
 */
export function sectionHref(game: GameId, section: string): string {
  const { prefix } = defOf(game);
  // trailingSlash:true — 정적 export가 그 경로로 디렉터리를 만든다.
  return section.length === 0 ? `${prefix}/` : `${prefix}/${section}/`;
}

/**
 * 헤더 활성 탭용 섹션 키. 게임 접두를 벗긴 첫 세그먼트이며, 게임 브리핑은 `""`다.
 * 게임에 속하지 않는 경로(랜딩·구 경로)는 `null` — 활성 탭이 없다는 뜻이다.
 *
 * Header.tsx가 `rest[0] === "pubg"`를 하드코딩해 직접 파싱하고 있었다. 접두가 둘로 늘어난
 * 지금 그 하드코딩을 남겨두면 LoL 경로의 섹션을 `"lol"`로 읽어 활성 탭을 전부 잃는다.
 */
export function sectionOfPathname(pathname: string): string | null {
  if (gameFromPathname(pathname) === null) return null;
  return segmentsOf(pathname)[1] ?? "";
}

/** 게임 브리핑(각 게임의 진입 화면)인가. 랜딩은 홈이 **아니다**. */
export function isGameHome(pathname: string): boolean {
  return gameFromPathname(pathname) !== null && segmentsOf(pathname).length === 1;
}

/** LoL 항목 상세(`/lol/item/{slug}/`)인가 — 앰비언트 상세 스플래시(LAYER 4) 게이트. */
export function isItemDetailPath(pathname: string): boolean {
  const segments = segmentsOf(pathname);
  return gameFromPathname(pathname) === "lol" && segments[1] === "item";
}
