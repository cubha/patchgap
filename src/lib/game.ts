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

/**
 * 양쪽 게임에 **실제로 라우트가 존재하는** 섹션. 내비 3개와 1:1이다.
 * 여기 없는 경로(`/item/[id]` 등)에서 게임을 바꾸면 대응 라우트가 없으므로 브리핑으로
 * 떨어뜨린다 — 정적 export에서 없는 경로는 곧 404(빈 화면)라 조용히 깨지기 때문이다.
 */
const SHARED_SECTIONS = ["", "compare", "methodology"] as const;

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

/** 앞뒤 슬래시를 벗긴 세그먼트 배열 — `trailingSlash` 유무에 결과가 흔들리지 않게 한다. */
function segments(pathname: string): string[] {
  return pathname.split("/").filter((s) => s.length > 0);
}

/**
 * 현재 경로에서 `game`으로 전환했을 때 가야 할 경로.
 * - 같은 게임이면 현재 경로를 그대로 둔다(상세 화면에서 이탈시키지 않는다).
 * - 공용 섹션이면 같은 섹션으로 건너간다.
 * - 대응 라우트가 없으면 그 게임의 브리핑으로 떨어진다.
 */
export function gameHref(game: GameId, pathname: string): string {
  if (gameFromPathname(pathname) === game) return pathname;

  const rest = segments(pathname);
  if (rest[0] === "pubg") rest.shift();
  const section = rest.length === 0 ? "" : rest[0];
  const target = (SHARED_SECTIONS as readonly string[]).includes(section) ? section : "";

  const { prefix } = defOf(game);
  // trailingSlash:true 이므로 항상 슬래시로 끝낸다(정적 export가 그 경로로 디렉터리를 만든다).
  return `${prefix}/${target ? `${target}/` : ""}` || "/";
}
