// src/lib/meta.ts
// 라우트 메타(title·description·og·canonical) **단일 출처**(ST-1, 2026-10-11 site-review 트랙 B6).
//
// 왜 한 곳인가: 페이지마다 리터럴을 쓰던 결과가 리뷰에서 그대로 드러났다 — LoL 4라우트 title이 루트 상속 「patchgap」
// 단독으로 겹쳤고(lol-S25), TFT 7라우트 description이 LoL 시절 루트 문구를 물려받았고(tft-S25·parity-S31), 틀은 「—」와
// 「·」, 게임명은 「PUBG」와 「배틀그라운드」를 섞었으며(parity-S30), og·canonical은 전 라우트에 없었다(lol-S27·pubg-S25).
//
// 틀: `{대상명|화면} · {게임}[ {from} → {to}]` + 루트 template 「%s · patchgap」. 게임명은 `gameLabel` 하나에서만 온다 —
// 네 번째 게임도 리터럴 없이 따라온다. 브리핑(최신)은 쌍을 쓰지 않는다(쌍은 헤더 선택기가 말한다, 2026-09-21).
//
// og:title은 Next가 title에서 자동으로 만들지 않고(openGraph는 얕게 병합된다) template도 적용되지 않으므로, 사이트명까지
// 붙인 완성형을 여기서 만든다. 주소는 전부 슬래시로 끝난다 — `trailingSlash: true`라 슬래시 없는 주소는 308을 가리킨다.
import type { Metadata } from "next";
import { gameLabel, type GameId } from "./game";

/** 배포 주소 — `scripts/run-notify.ts` `DEFAULT_SITE_URL`과 같은 값이다(디스코드 링크 기준). */
export const SITE_URL = "https://patchgap.vercel.app";
export const SITE_NAME = "patchgap";

export type MetaScreen = "briefing" | "compare" | "methodology" | "detail";

export interface PageMetaInput {
  game: GameId;
  screen: MetaScreen;
  /** 이 라우트의 경로(`/lol/compare/`). 슬래시는 정규화한다. */
  path: string;
  pair?: { from: string; to: string } | null;
  /** 상세의 대상명 — 있으면 화면명을 대신한다. */
  entity?: string | null;
  /** 화면이 따로 아는 사실(비교 불가 맵 등)로 기본 문구를 대신할 때. */
  description?: string;
  /** 별칭 라우트(LoL 구 지표 경로)는 정준 대상 주소를 canonical로 가리킨다. */
  canonicalPath?: string;
}

const SCREEN_LABEL: Record<MetaScreen, string> = {
  briefing: "브리핑",
  compare: "대조표",
  methodology: "방법론",
  detail: "상세",
};

/** 공유 미리보기 이미지 — `public/og/{game|landing}.png`(1200×630, 빌드 산출물이 아닌 커밋된 정적 파일). */
export function ogImagePath(game: GameId | null): string {
  return `/og/${game ?? "landing"}.png`;
}

function normalizePath(path: string): string {
  const trimmed = path.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  return trimmed.length === 0 ? "/" : `/${trimmed}/`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${normalizePath(path)}`;
}

function spanOf(pair: PageMetaInput["pair"]): string {
  return pair ? ` ${pair.from} → ${pair.to}` : "";
}

export function pageTitle(input: PageMetaInput): string {
  const head = input.entity ?? SCREEN_LABEL[input.screen];
  return `${head} · ${gameLabel(input.game)}${spanOf(input.pair)}`;
}

function defaultDescription(input: PageMetaInput): string {
  const game = gameLabel(input.game);
  const span = input.pair ? `${input.pair.from} → ${input.pair.to} ` : "";
  switch (input.screen) {
    case "briefing":
      return `${game} ${span}패치노트가 말한 것과 실제 매치 통계가 말하는 것을 견준 브리핑 — 공지되지 않은 변화를 통계 게이트와 원천 링크로 보여 드립니다.`;
    case "compare":
      return `${game} ${span}패치노트 항목과 관측된 변화를 대상 단위로 견준 대조표입니다.`;
    case "methodology":
      return `${game} 판정 규칙 — 표본·통계 게이트·효과크기 바닥·상태 정의·표시 규칙과 검증하지 못한 것.`;
    case "detail":
      return `${input.entity ?? "대상"} — ${game} ${span}패치노트 대조와 관측 근거.`;
  }
}

export function pageMeta(input: PageMetaInput): Metadata {
  const title = pageTitle(input);
  const description = input.description ?? defaultDescription(input);
  // 공유 주소도 정준 쪽 — 별칭 경로로 공유된 링크의 미리보기가 정준 대상 주소를 말한다.
  const url = absoluteUrl(input.canonicalPath ?? input.path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      locale: "ko_KR",
      type: "website",
      images: [{ url: ogImagePath(input.game), width: 1200, height: 630 }],
    },
  };
}
