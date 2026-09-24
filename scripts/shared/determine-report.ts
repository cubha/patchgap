// scripts/shared/determine-report.ts
// 수집 워크플로의 **판정 보고** — 세 게임의 `*-determine.ts`가 공유한다.
//
// **왜 생겼나**(2026-09-24 실측). `collect-tft.yml` 실행이 이렇게 끝나 있었다:
//
//     5. Determine patch — success
//     6~13. (전부) — skipped
//     결론: success   ← 초록불
//
// 아무것도 하지 않았는데 초록불이다. 그 자체는 옳다(Riot 제품 심사 대기 중이라 사람이 할 일이
// 없다) — 문제는 **초록불이 두 상태를 덮는다**는 것이다: "기다리는 중이라 안 했다"와 "배선이
// 고장나서 못 했다"가 화면에서 같아 보인다. 이유를 알려면 로그를 열어 `::warning::`을 찾아야
// 했고, 그건 몇 주 뒤 사람이 "왜 TFT만 18.2에 멈춰 있지"를 눈으로 발견하는 경로다.
//
// **고친 방식은 임계값이 아니다.** "N일 이상 밀리면 실패"는 값을 정직하게 고를 수 없다 —
// 심사가 몇 주면 매일 빨간불이 되고(그 알림은 곧 무시된다. 지금 고치려는 실패 양식 그대로),
// 높게 잡으면 아무것도 못 잡는다. 대신 **판정에 사유를 동반시킨다**: 사유 없는 스킵은
// `reportSkip`의 시그니처가 컴파일에서 막고(방법론 9슬롯 `Record`와 같은 장치), 사유는
// Actions 출력·경고·**실행 요약**에 동시에 나간다. 요약은 run 페이지 첫 화면이라 클릭 0회다.
//
// 이유를 **관측할 수 있는 쪽이 적는다**: 403인지 401인지는 키를 쥔 수집 워크플로만 안다
// (`tft-preflight.ts`). 키 없는 감시자(patch-watch)가 되짚을 일이 아니다 — 그쪽은 격차를
// **데이터로** 보고할 뿐 합불을 판정하지 않는다(`staleness.ts`).
//
// `emit`·`warn`은 세 determine에 **복제돼 있던 것**을 여기로 흡수했다. 복제된 규칙은 반드시
// 하나가 어긋난다(이 저장소가 반복해서 고쳐 온 결함군 — `ExternalLink`·`panelScroll`·`BriefingTabs`).

import fs from "node:fs";

export type DetermineGame = "lol" | "tft" | "pubg";

/**
 * 스킵 사유 — **닫힌 목록**이다. 자유 문자열로 두면 게임마다 다른 말을 적게 되고, 그러면
 * 기계가 집계할 수 없어 다시 사람이 로그를 읽는 자리로 돌아간다.
 *
 * 세부 사정은 `detail`(기존 `decision.reason` 문장)이 말한다 — 여기서 카테고리를 잘게 쪼개
 * 순수 판정 함수들의 반환 타입까지 건드리지 않는다. 카테고리는 **조치가 갈리는 단위**다.
 */
export type SkipReason =
  /** 캘린더에 새 패치가 없거나 이미 받았다 — **정상 no-op**. 사람이 할 일 없음. */
  | "no-run-condition"
  /** 시크릿 미설정 — 사람이 설정해야 한다. */
  | "key-missing"
  /** 개발 키 24시간 만료 — **사람이 재발급**해야 한다. */
  | "key-expired"
  /** 제품 미승인(403) — Riot 심사 대기. 사람이 할 일 없고 승인되면 자동으로 풀린다. */
  | "product-unapproved";

/** 사유별 **조치**. 문구가 아니라 "누가 무엇을 해야 하는가"가 이 표의 값이다. */
export const SKIP_ACTION: Record<SkipReason, string> = {
  "no-run-condition": "조치 불필요 — 정상 no-op",
  "key-missing": "조치 필요 — 저장소 시크릿을 설정한다",
  "key-expired": "조치 필요 — 개발 키를 재발급해 시크릿을 갱신한다",
  "product-unapproved": "조치 불필요 — Riot 제품 심사 대기(승인되면 자동으로 풀린다)",
};

const GAME_LABEL: Record<DetermineGame, string> = {
  lol: "리그 오브 레전드",
  tft: "전략적 팀 전투",
  pubg: "배틀그라운드",
};

/** GitHub Actions 출력 한 묶음. 로컬 실행(=GITHUB_OUTPUT 없음)에서는 stdout으로만 찍는다. */
export function emitOutputs(game: DetermineGame, values: Record<string, string>): void {
  const body = Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `${body}\n`);
  console.log(`[${game}-determine] ${body.replace(/\n/g, " ")}`);
}

/** Actions 로그에 접히지 않는 경고로 남긴다(로컬에서는 평문). */
export function warn(message: string): void {
  console.log(process.env.GITHUB_ACTIONS ? `::warning::${message}` : `[warning] ${message}`);
}

/**
 * 실행 요약(run 페이지 첫 화면)에 한 줄. 로그와 달리 **펼치지 않아도 보인다** — 이 모듈이
 * 존재하는 이유의 절반이 여기다.
 */
export function appendSummary(line: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) fs.appendFileSync(file, `${line}\n`);
  else console.log(`[summary] ${line}`);
}

/**
 * **수집을 건너뛴다 — 사유를 반드시 말한다.**
 *
 * `reason`이 필수 인자라, 사유 없는 스킵은 타입 체크에서 막힌다. 산문 규칙("스킵할 땐 이유를
 * 적자")은 게이트 없이 드리프트하므로 시그니처로 강제한다.
 */
export function reportSkip(
  game: DetermineGame,
  reason: SkipReason,
  detail: string,
): void {
  emitOutputs(game, { should_run: "false", skip_reason: reason });
  const action = SKIP_ACTION[reason];
  warn(`${GAME_LABEL[game]} 수집 건너뜀 [${reason}] ${detail} — ${action}`);
  appendSummary(`### ${GAME_LABEL[game]} — 건너뜀 \`${reason}\``);
  appendSummary("");
  appendSummary(`- ${detail}`);
  appendSummary(`- **${action}**`);
  appendSummary("");
}

/** 수집을 진행한다. 요약에도 남긴다 — "돌았다"와 "안 돌았다"가 같은 자리에서 읽혀야 한다. */
export function reportRun(game: DetermineGame, values: Record<string, string>): void {
  emitOutputs(game, { ...values, should_run: "true", skip_reason: "" });
  const pair = values.from && values.to ? ` ${values.from} → ${values.to}` : "";
  appendSummary(`### ${GAME_LABEL[game]} — 수집 진행${pair}`);
  appendSummary("");
}
