// src/pipeline/collect/tft-preflight.ts
// TFT 수집 전 권한 확인 — **한 번의 싼 호출로 "오늘 돌 수 있는가"를 판정한다.**
//
// **왜 필요한가.** TFT 제품은 Riot 심사 대기 중이고(2026-09-20 신규 등록), 그동안 이 프로젝트가
// 쓰는 개발 키는 **24시간마다 만료**된다. 즉 주간 cron이 발화하는 시점에 키가 죽어 있거나
// 제품이 아직 미승인일 가능성이 상시 존재한다. 프리플라이트 없이 들어가면 수집 루프 한가운데서
// 죽고, 그게 Actions에 **빨간 X**로 남는다 — 예선 심사 기간(9/21~10/5) 중 매주 반복되는 빨간 X는
// 진짜 실패를 가린다.
//
// **키가 LoL과 다르다**(2026-09-20 실측). 승인된 LoL 제품 키(PATCHDRIFT)는 TFT에 403을 준다 —
// 즉 CI의 `RIOT_API_KEY`를 그대로 쓰면 **매주 조용히 스킵**된다. TFT는 `RIOT_TFT_API_KEY`를
// 따로 받는다. 실측 표:
//
//   RIOT_TFT_API_KEY (24h 개발 키)   TFT 200 · LoL 200
//   RIOT_PERSONAL_KEY (PATCHDRIFT)   TFT 403 · LoL 200
//   만료된 개발 키                    TFT 401 · LoL 401
//
// **401과 403은 조치가 다르다**(2026-09-20 실측으로 구분 확인):
//
//   401  개발 키 만료(24h)     → 사용자가 재발급해야 한다
//   403  TFT 제품 미승인       → 사람이 할 일이 없다. Riot 심사 대기
//
// 둘 다 **잡을 실패시키지 않는다**(`fatal: false`). 그 외(429·5xx·네트워크)는 진짜 실패라
// 그대로 터뜨린다 — 조용히 삼키면 "정기 수집이 돌고 있다"는 착각을 만든다.

export type TftPreflightKind = "ok" | "key-expired" | "product-unapproved" | "error";

export interface TftPreflightResult {
  kind: TftPreflightKind;
  /** 수집을 진행해도 되는가. */
  proceed: boolean;
  /** 잡을 실패(빨간 X)시켜야 하는가. 권한 문제는 false — 경고로 끝낸다. */
  fatal: boolean;
  /** 워크플로 로그·annotation에 그대로 실리는 문장. **키를 담지 않는다.** */
  message: string;
}

/** HTTP 상태 하나로 판정한다 — 순수 함수라 규칙이 테스트로 고정된다. */
export function classifyTftPreflight(status: number): TftPreflightResult {
  if (status === 401) {
    return {
      kind: "key-expired",
      proceed: false,
      fatal: false,
      message:
        "TFT 프리플라이트 401 — 개발 키가 만료됐다(24시간). " +
        "developer.riotgames.com에서 키를 재발급해 **RIOT_TFT_API_KEY** 시크릿을 갱신한다 " +
        "(LoL용 RIOT_API_KEY와 다른 키다 — 그 키는 TFT에 403이다).",
    };
  }
  if (status === 403) {
    return {
      kind: "product-unapproved",
      proceed: false,
      fatal: false,
      message:
        "TFT 프리플라이트 403 — 이 키에 TFT 제품 권한이 없다. " +
        "Riot 제품 심사 대기 중이면 사람이 할 일은 없다(승인 후 자동으로 풀린다). " +
        "키 자체는 유효하다 — 401과 구분된 신호다.",
    };
  }
  if (status >= 200 && status < 300) {
    return { kind: "ok", proceed: true, fatal: false, message: "TFT 프리플라이트 OK" };
  }
  return {
    kind: "error",
    proceed: false,
    fatal: true,
    message: `TFT 프리플라이트 실패 status=${status} — 권한 문제가 아니다. 이 실패는 삼키지 않는다.`,
  };
}

export interface TftPreflightOptions {
  apiKey: string;
  /** 플랫폼 라우팅(예: "kr"). */
  platform: string;
  fetchImpl?: typeof fetch;
}

/**
 * 가장 싼 TFT 엔드포인트를 1회 친다. `tft-league-v1/challenger`를 고른 이유는 매치 조회보다
 * 싸면서 **권한 신호가 동일**하기 때문이다(제품 미승인이면 여기서도 403).
 *
 * 던지지 않는다 — 호출부(워크플로 determine)가 결과를 보고 깨끗이 스킵할 수 있어야 한다.
 */
export async function runTftPreflight(options: TftPreflightOptions): Promise<TftPreflightResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `https://${options.platform}.api.riotgames.com/tft/league/v1/challenger`;
  try {
    const res = await fetchImpl(url, { headers: { "X-Riot-Token": options.apiKey } });
    return classifyTftPreflight(res.status);
  } catch (error) {
    // 네트워크 실패를 권한 문제로 오인하면 "제품 미승인"이라는 틀린 결론이 로그에 남는다.
    return {
      kind: "error",
      proceed: false,
      fatal: true,
      message: `TFT 프리플라이트 네트워크 오류: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
