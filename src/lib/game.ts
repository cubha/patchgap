// src/lib/game.ts
// 게임 스위처 — LoL과 PUBG는 **같은 사이트**이고, 바뀌는 것은 내부 데이터와 테마뿐이다
// (PLAN-game-switcher-2026-09-17 R1·R2). 이 모듈은 그 전환의 경로 계산만 담당하는 순수
// 함수 집합이다(React·fs 의존 0 — 서버 레이아웃과 클라이언트 헤더가 함께 쓴다).
//
// **왜 게임 상태가 URL에 있나**: `next.config.ts`가 `output:'export'`(정적)이라 런타임
// 리다이렉트가 없고, 양 게임 데이터를 동시에 번들해 클라이언트에서 토글하면 "데이터 페칭은
// 빌드 타임에만 · 서버 컴포넌트 우선"(프로젝트 CLAUDE.md) 원칙과 충돌한다. 그래서 게임 =
// 경로 접두다. 저장(localStorage)은 하지 않는다 — HANDOFF §3 사용자 결정("진입 시 항상 LoL,
// 다른 게임은 선택으로만 전환"). 덕분에 FOUC 문제도 원리적으로 없다.
//
// **왜 LoL에는 접두가 없나**: 배포 URL(`patchgap.vercel.app/`)·UptimeRobot 감시 대상·이미
// 공유된 링크가 전부 무접두다. `/lol/`을 새로 만들면 그것들이 한꺼번에 깨진다(PLAN X1).

export type GameId = "lol" | "pubg";

export interface GameDef {
  id: GameId;
  /** 드롭다운에 보이는 이름 — 사용자 지정 한국어 정식 명칭. */
  label: string;
  /** 경로 접두. LoL은 빈 문자열(무접두가 기본 게임). */
  prefix: string;
}

/** LoL이 먼저다 — 진입 기본값이자 드롭다운 첫 옵션(HANDOFF §3). */
export const GAMES: readonly GameDef[] = [
  { id: "lol", label: "리그 오브 레전드", prefix: "" },
  { id: "pubg", label: "배틀그라운드", prefix: "/pubg" },
] as const;

function defOf(game: GameId): GameDef {
  const def = GAMES.find((g) => g.id === game);
  if (!def) throw new Error(`TODO(game): 알 수 없는 게임 "${game}" — GAMES에 추가한다.`);
  return def;
}

export function gameLabel(game: GameId): string {
  return defOf(game).label;
}

/** 경로 → 현재 게임. `/pubgfoo/`처럼 접두가 아닌 유사 경로를 오인하지 않도록 경계까지 본다. */
export function gameFromPathname(pathname: string): GameId {
  return pathname === "/pubg" || pathname.startsWith("/pubg/") ? "pubg" : "lol";
}

/**
 * 현재 경로에서 `game`으로 전환했을 때 가야 할 경로.
 * - 같은 게임이면 현재 경로를 그대로 둔다(상세 화면에서 이탈시키지 않는다).
 * - 다른 게임이면 **항상 그 게임의 브리핑**(`/` 또는 `/pubg/`)이다 — 2026-09-18 라운드6(사용자 C2
 *   "테마전환될때마다 초기화되도록. 브리핑 메뉴가 기본값"). 이전엔 공용 섹션(대조표·방법론)이면 같은
 *   섹션으로 건너뛰었는데, 게임이 바뀌면 보던 맥락(엔티티·패치 쌍)이 전부 바뀌므로 진입점으로 돌아가는
 *   쪽이 맞다. 정적 export에서 없는 경로는 곧 404라, 브리핑은 언제나 실재하는 착지점이기도 하다.
 */
export function gameHref(game: GameId, pathname: string): string {
  if (gameFromPathname(pathname) === game) return pathname;
  const { prefix } = defOf(game);
  // trailingSlash:true 이므로 항상 슬래시로 끝낸다(정적 export가 그 경로로 디렉터리를 만든다).
  return `${prefix}/`;
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
