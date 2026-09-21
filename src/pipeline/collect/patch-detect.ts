// src/pipeline/collect/patch-detect.ts
// 새 패치 **탐지 규칙**(2026-09-21). 순수 함수만 — fetch는 `scripts/patch-watch.ts`가 한다.
//
// `tft-patch-calendar.ts` 헤더가 적어 둔 "노트 인덱스를 크롤링해 자동 발견하는 것이 궁극적
// 해법"의 실행분이다. 다만 인덱스를 크롤링하지 않는다 — **다음 후보 URL이 존재하는지**만 본다.
// 인덱스 마크업은 바뀌지만 글 URL 규칙(`…patch-26-19-notes/`·`…patch-18-3/`)은 안 바뀌고,
// 200/404는 파싱할 것이 없다.
//
// **날짜는 추측하지 않는다.** 그 페이지의 JSON-LD `datePublished`가 캘린더 값과 정확히 같다
// (실측: LoL 26.18 → 2026-09-09T18:00Z → KST 2026-09-10 = `liveKst`, TFT 18.2 → 같은 시각 =
// `startMs`). 그래서 "탐지한 날"을 쓰는 대신 페이지가 주는 값을 그대로 적는다 — 감시자가
// 며칠 늦게 돌아도 캘린더는 정확하다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const TELEMETRY_LABEL = /^pc-\d{4}-(\d+)$/;

/**
 * 다음 패치 후보 **둘** — 마이너 +1과 메이저 롤오버(`{메이저+1}.1`).
 *
 * 하나만 보면 연말·세트 교체에서 끊긴다(26.24 다음이 26.25가 아니라 27.1이고, TFT 18.x 다음이
 * 19.1이다). 요청 하나 더 쓰고 그 구멍을 없앤다.
 */
export function nextPatchCandidates(last: string): string[] {
  const [major, minor] = last.split(".").map(Number);
  return [`${major}.${minor + 1}`, `${major + 1}.1`];
}

/**
 * 페이지의 발행 시각(ISO). **첫 `datePublished`만** 쓴다 — 같은 페이지에 추천 글 목록이 딸려
 * 있어 다른 글의 `publishedAt`이 여럿 섞인다(실측: TFT 18.2 페이지에 4건 더 있었다).
 */
export function extractDatePublished(html: string): string | null {
  const m = /"datePublished"\s*:\s*"([^"]+)"/.exec(html);
  if (!m) return null;
  return ISO_INSTANT.test(m[1]) ? m[1] : null;
}

/** 발행 시각 → `liveKst`(`YYYY-MM-DD`). */
export function kstDateOf(iso: string): string {
  return new Date(Date.parse(iso) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** `pc-2018-43` → 43. 형식이 아니면 null. */
export function telemetryMajor(label: string): number | null {
  const m = TELEMETRY_LABEL.exec(label);
  return m ? Number(m[1]) : null;
}

/**
 * 라벨 → 패치 표기. **언제나 `{메이저}.1`이다** — 라벨이 메이저까지만 담기 때문에
 * 43.2 같은 마이너는 애초에 탐지할 수 없다(그리고 넣어서도 안 된다: 두 창의 라벨이 같아지면
 * 피해 격자가 한 배열로 붕괴해 대조가 언제나 0건이 된다).
 */
export function pubgPatchOfLabel(label: string): string | null {
  const major = telemetryMajor(label);
  return major === null ? null : `${major}.1`;
}

/** KST 목요일. 이 프로젝트가 관측한 LoL 라이브 요일이 전부 목요일이다(`collect.yml` cron 주석). */
const LOL_LIVE_WEEKDAY_KST = 4;

/**
 * LoL 발행 시각 → **KR 라이브일**(`liveKst`).
 *
 * `kstDateOf`를 그냥 쓰면 안 된다 — `datePublished`는 **기사 발행 시각**이고 KR 라이브일보다
 * 하루 이를 수 있다(실측: 26.16·26.17은 KST 수요일 발행, 캘린더는 목요일). 그대로 적으면
 * 그 값이 **직전 패치의 `endTime`**이 되어 시간창이 하루 일찍 닫히고 마지막 날 매치를 잃는다.
 *
 * 규칙은 이 저장소가 이미 적어 둔 관측이다 — 라이브 요일이 전부 KST 목요일. 발행일(KST) 이후
 * **당일 포함 첫 목요일**을 쓴다. 커밋된 26.16·26.17·26.18 세 건을 전부 복원한다.
 */
export function lolLiveKstOf(iso: string): string {
  const kstMs = Date.parse(iso) + KST_OFFSET_MS;
  const day = new Date(kstMs).getUTCDay();
  const ahead = (LOL_LIVE_WEEKDAY_KST - day + 7) % 7;
  return new Date(kstMs + ahead * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Steam 공지 제목 → 패치 표기. `Patch Notes - Update 43.1` → `43.1`.
 *
 * **PUBG 탐지의 유일한 신호다.** PUBG 자체 API에는 패치 필드가 없고(매치 `attributes`·`/status`
 * 전부 확인), 공지 사이트는 SPA라 없는 패치도 200을 준다(`patch-notes-99-9`가 43-1과 동일 바이트).
 * Steam 뉴스 피드(`ISteamNews/GetNewsForApp`, appid 578080)는 키가 필요 없고 구조화 JSON을 주며,
 * 항목의 타임스탬프 UTC 날짜가 캘린더 `liveFrom`과 정확히 일치한다(실측 42.3·43.1 2/2).
 *
 * **같은 날 이웃 공지가 섞여 있다** — `Map Service Report - Update 43.1`·`September Store Update
 * 2026` 등. 그래서 제목 전체를 고정 형태로 맞춘다(부분 일치를 쓰면 저 둘을 집는다).
 */
export function pubgPatchOfSteamTitle(title: string): string | null {
  const m = /^Patch Notes - Update (\d{2}\.\d{1,2})$/.exec(title.trim());
  return m ? m[1] : null;
}

/**
 * 직전 라벨에서 새 텔레메트리 라벨을 만든다 — `pc-2018-43` + `44.1` → `pc-2018-44`.
 *
 * 연도 자리(`2018`)는 게임 출시 연도에서 온 **레거시 상수**라 바뀌지 않지만, 여기 박아 두는 대신
 * **직전 라벨에서 그대로 가져온다**. 언젠가 바뀌면 캘린더의 마지막 항목이 먼저 알려 줄 것이고,
 * 지어낸 값이 캘린더에 들어가는 것보다 낫다.
 * 마이너 패치는 같은 라벨이 나온다(텔레메트리가 마이너를 구분하지 않는다) — 의도한 결과다.
 */
export function telemetryLabelFor(lastLabel: string, patch: string): string | null {
  const m = /^(pc-\d{4}-)\d+$/.exec(lastLabel);
  if (!m) return null;
  const major = Number(patch.split(".")[0]);
  return Number.isFinite(major) ? `${m[1]}${major}` : null;
}
