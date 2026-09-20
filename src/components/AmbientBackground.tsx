// src/components/AmbientBackground.tsx
// 전역 앰비언트 배경 — layout.tsx에 단 한 번 렌더되는 sitewide 고정 레이어(src/styles/ambient.css).
// 확정 시안(아티팩트 "협곡 앰비언트 배경" v5)의 4개 레이어 중 이 프로젝트가 채택한 것만 구현한다:
//   LAYER 1(전역 배경·상단 앵커) — 모든 페이지 공통, 색 번짐+선명 플레이트+글로우+스크림+그레인.
//   LAYER 2(라인 카메라) — 홈(pathname === "/")에서만 useAmbient().selectedLane을 따라간다.
//   LAYER 3(인트로 리빌) — 홈 마운트마다 최대 1회 재생(영상 실패해도 정지 이미지가 항상 그
//     아래 깔려 있어 배경이 비지 않는다). 2026-09-14 이전엔 localStorage로 "사이트 최초 진입
//     1회"만 영구 재생했으나, 도그푸딩 중 이미 한 번이라도 본 브라우저는 새로고침해도 다시는
//     재생되지 않는 것을 사용자가 결함으로 지적했다(원래 의도한 "최초 1회"가 아니라 "F5해도
//     재생"이 실제로 필요한 동작이었다) — 아래 useIntroReveal 참고.
//   LAYER 4(상세 스플래시) — /lol/item/[id] 경로 + useAmbient().detailSplashUrl이 있을 때만.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { gameFromPathname, isGameHome, isItemDetailPath, type GameId } from "@/lib/game";
import { laneCameraTransform } from "@/lib/laneCamera";
import { useAmbient } from "./AmbientContext";

function useReducedMotion(): boolean {
  // 초기값은 lazy initializer로 즉시 계산(StreamColumnLayout.tsx와 동일 패턴) — 빌드
  // 타임(SSR)엔 window가 없어 항상 false, 클라이언트 첫 렌더는 matchMedia로 즉시 판단한다.
  // effect는 이후 변경(OS 설정 토글)만 구독한다.
  const [reduced, setReduced] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * 인트로 재생 여부 — 마운트당 최대 1회(2026-09-14 정정, 이전엔 localStorage로 "브라우저당
 * 영구 1회"였다). SSR/최초 클라이언트 렌더는 항상 false(정지 상태)로 시작하고, mount 이후
 * effect에서 즉시 true로 바꾼다 — lazy initializer로 즉시 켜면 서버 렌더(항상 false)와
 * 클라이언트 첫 렌더가 갈라져 hydration mismatch가 난다. 이 setState는 "마운트 후 한 번만
 * 상태를 동기화"하는 CompareExplorer.tsx와 동일한 패턴이라 set-state-in-effect를 의도적으로
 * 허용한다.
 *
 * **localStorage 삭제 이유**: 예전엔 `patchgap:ambient-intro-seen` 플래그로 "사이트 최초
 * 진입 1회"만 영구 재생했다. 그런데 이 플래그는 한 번 세팅되면 브라우저를 초기화하기 전까진
 * 절대 지워지지 않아 — 도그푸딩 중 이미 한 번이라도 본 사람은 "아무리 새로고침해도 인트로가
 * 재생되지 않는다"는 결과를 얻었다(사용자 실측 지적, 2026-09-14). 영상 재생 자체(mount→종료)는
 * 로컬·프로덕션 둘 다 Playwright로 정상 확인됐으므로 메커니즘 결함이 아니라 영구 기억 설계가
 * 실제 요구("새로고침하면 재생")와 반대 방향이었던 것 — 그래서 기억 자체를 없앤다.
 *
 * **새 의미론이 "마운트당 최대 1회"인 이유**: 이 훅을 부르는 `AmbientBackground`의
 * `introEnded`(아래 컴포넌트 본문)는 한 번 true가 되면 리셋되지 않는다 — 재생이 끝나면
 * 정지 이미지로 영구 전환되는 기존 동작은 그대로 유지해야 하므로, localStorage만 걷어내면
 * 새 분기 없이 자동으로 이 의미론이 된다: F5(하드 리로드, 컴포넌트 재마운트)마다 재생 ✅,
 * `/lol/compare/` 등 딥링크 후 클라이언트 네비로 홈에 처음 들어와도 재생 ✅, 그 상태에서 홈↔다른
 * 페이지를 왕복해도(같은 마운트 생명주기 안이므로) 재생 안 함 ✅(1.7초 영상이 왕복마다
 * 반복되면 오히려 거슬린다). "매 홈 진입마다"까지 가려면 `introEnded`도 같이 리셋해야 하는데,
 * 그건 재생 종료 후 정지 이미지 유지라는 기존 동작과 충돌해 채택하지 않는다.
 */
/**
 * 인트로 1회 재생을 관리한다 — **어느 게임이든 같은 규칙**이다(LoL 영상 · PUBG 강하 애니메이션).
 *
 * `runToken`은 `"<게임>:<nonce>"` 형태이고, 이 토큰이 바뀔 때마다 새 재생이 시작된다.
 * 종료(영상 `onEnded` / 애니메이션 `onAnimationEnd`)는 그 시점의 토큰을 `endedToken`에 적어
 * 같은 토큰의 재재생을 막는다.
 *
 * **2026-09-17 개정 — 사용자 지적 "아직도 애니메이션은 안되는데? LOL, 배틀그라운드 둘다"**.
 * 실측으로 재현한 결함 2건을 여기서 함께 고친다:
 *
 * 1. **`prefers-reduced-motion: reduce`면 양쪽 다 아예 재생되지 않았다.** 자동 재생을 막는 것
 *    자체는 접근성상 옳지만, 그 설정을 켠 사용자에게는 인트로를 볼 수단이 **하나도 없었다**.
 *    → 자동(nonce 0)만 막고, 재생 버튼을 통한 수동 재생(nonce ≥ 1)은 허용한다. 승인 시안
 *    아티팩트도 히어로 우측에 `↻ 강하 인트로 재생` 버튼을 두고 있었다(미구현이던 항목).
 * 2. **한 세션에서 한 번만 재생됐다.** 홈 → 대조표 → 홈으로 돌아와도 재생되지 않았다(실측).
 *    브리핑 라우트를 벗어나면 `endedToken`을 비워, 재진입이 곧 새 재생이 되게 한다.
 */
function useIntroRun(game: GameId | null, nonce: number, reducedMotion: boolean) {
  const runToken = game === null ? null : `${game}:${nonce}`;
  const [activeToken, setActiveToken] = useState<string | null>(null);

  // **재생 시작은 반드시 effect에서 한다** — 서버 렌더에는 `window`가 없어 `reducedMotion`이
  // 항상 false다. 이 값을 렌더 중에 바로 쓰면 정지 상태여야 할 HTML에 재생 클래스가 박혀
  // 나가고, 하이드레이션이 그것을 되돌리지 못한다(2026-09-17 실측: reduced-motion을 켠
  // 브라우저에서 `.is-descending`이 붙은 채 `animation-name: none`이라 아무 일도 안 일어나는
  // 죽은 상태가 됐다). 첫 렌더는 항상 꺼진 상태 → mount 후 effect가 판단해 켠다.
  useEffect(() => {
    // 브리핑을 벗어났거나(결함 2 — 리셋해서 재진입이 곧 새 재생이 되게 한다),
    // 자동 재생이 reduced-motion에 걸리면(결함 1 — 버튼 재생 nonce≥1은 통과) 꺼둔다.
    const blocked = reducedMotion && nonce === 0;
    // 마운트 후에 판단해야만 하는 값(reducedMotion)에 반응하는 동기화라 effect에서 set한다 —
    // 렌더 중에 계산하면 서버 HTML과 갈라진다(위 주석 참고).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveToken(runToken === null || blocked ? null : runToken);
  }, [runToken, reducedMotion, nonce]);

  return {
    runToken,
    active: activeToken !== null && activeToken === runToken,
    markEnded: () => setActiveToken(null),
  };
}

export default function AmbientBackground() {
  const pathname = usePathname();
  const { detailSplashUrl, introNonce } = useAmbient();
  const reducedMotion = useReducedMotion();

  // 2026-09-19: 경로 판정을 전부 game.ts로 옮겼다. 예전엔 여기서 `pathname === "/"`와
  // `startsWith("/item/")`를 직접 봤는데, 루트가 랜딩으로 바뀌고 LoL이 `/lol` 접두를 받은 지금
  // 그대로 두면 **랜딩에서 협곡 인트로가 재생되고** LoL 홈에서는 안 되는 정확한 반대가 된다.
  const route = pathname ?? "/";
  const game = gameFromPathname(route);
  const isPubg = game === "pubg";
  const isTft = game === "tft";
  /** 각 게임의 브리핑만 "홈"이다 — 랜딩은 자기 배경(스플래시 월)을 직접 갖는다. */
  const isHome = game === "lol" && isGameHome(route);
  /** PUBG 브리핑 — LoL 홈과 같은 자리이며 강하 인트로가 재생되는 유일한 라우트다. */
  const isPubgHome = isPubg && isGameHome(route);
  /** TFT 브리핑 — 수렴 인트로가 재생되는 유일한 라우트. */
  const isTftHome = isTft && isGameHome(route);
  const isItemDetail = isItemDetailPath(route);
  const showDetailSplash = isItemDetail && detailSplashUrl !== null;

  // 라인 카메라(2026-09-13·6차 연속, 사용자 결정) — 라인 필터 선택에 따라 배경이 확대·이동하던
  // 동작을 제거했다. 실사용 검증 후 "시점이동하는건 없는게 맞을거같다. 오히려 어지러워" —
  // 코드는 유지 초반 "우선 유지, 다시 검증해보고 판단" 상태였는데 이번에 그 검증이 끝났다.
  // laneCamera.ts는 이제 "전체" 프레이밍(고정값)만 반환한다.
  const { tx, ty, scale } = laneCameraTransform();

  // 인트로를 소유하는 라우트는 두 게임의 **브리핑**뿐이다(LoL `/` · PUBG `/pubg/`).
  const introGame: GameId | null = isHome ? "lol" : isPubgHome ? "pubg" : isTftHome ? "tft" : null;
  const intro = useIntroRun(introGame, introNonce, reducedMotion);
  const pubgDescending = isPubgHome && intro.active;
  const tftConverging = isTftHome && intro.active;

  // 마커(바론/드래곤 둥지)는 2026-09-12 /verify-impl 실측으로 **제거**했다.
  // 시안 v5에서 마커가 보였던 것은 그 데모의 리스트가 라인 필터로 짧아지면서 아래 지형이
  // 드러나는 레이아웃이었기 때문이다. 구현의 좌측 스트림은 2026-09-11 사용자 지시로 우측 컬럼
  // 높이에 맞춘 **고정 높이 + 내부 스크롤**(StreamColumnLayout)이라 필터를 걸어도 리스트가
  // 짧아지지 않는다 → 마커가 들어설 빈 지형이 구조적으로 생기지 않는다. 실측: 마커가 켜지는
  // 세 라인(탑·원딜·서포터) 전부에서 마커 중심점의 elementFromPoint가 스트림 카드였다(즉
  // opacity .95로 켜져 있으나 화면에는 한 번도 보이지 않음). 좌표를 옮기면 "바론 둥지"가
  // 바론 둥지가 아닌 곳을 가리키게 되고, z를 콘텐츠 위로 올리면 "배경은 콘텐츠 뒤"라는 이
  // 레이어의 전제가 깨진다. 어느 쪽도 택하지 않고 제거한다 —
  // **라인 카메라의 어포던스 자체는 마커 없이도 전달된다**: 라인 전환 시 상단 배너 밴드의
  // 픽셀이 22~28% 바뀌는 것을 실측했다(전체↔탑 22.8% / 전체↔원딜 27.2% / 탑↔원딜 28.2%).
  // 자산 public/bg/{baron,drake}.png는 되살릴 때를 위해 남겨둔다(합계 96KB).

  // 랜딩(게임 없음)은 **자기 배경을 직접 갖는다**(스플래시 월, src/styles/landing.css). 전역
  // 앰비언트는 게임 화면의 것이라 여기서 그리면 협곡 워시가 랜딩 전체에 녹색 캐스트를 씌운다
  // (실측: 구현 직후 첫 렌더에서 그 상태였다). 게임이 정해지지 않은 화면에서는 아무것도 그리지
  // 않는 것이 맞다 — 특정 게임의 아트를 기본값으로 삼으면 그 게임을 주장하는 셈이다.
  if (game === null) return null;

  // PUBG는 협곡 스택(워시·카메라·인트로 영상) 대신 키아트 한 장으로 간다 — 자산도 구도도
  // 다른 사진이라 같은 레이어 구조에 끼워 넣으면 둘 다 망가진다(승인 시안 .hero-map 참고).
  if (isPubg) {
    return (
      <div className="ambient-root" aria-hidden="true">
        {/* key에 runToken을 걸어 재생 버튼을 누를 때마다 요소가 새로 마운트되게 한다 —
            같은 요소에 클래스만 다시 붙이면 브라우저가 애니메이션을 재시작하지 않는다. */}
        <div
          key={intro.runToken ?? "static"}
          className={`ambient-pubg-art${pubgDescending ? " is-descending" : ""}`}
          onAnimationEnd={intro.markEnded}
        />
        <div className="ambient-glow" />
        <div className="ambient-scrim" />
        <div className="ambient-grain" />
      </div>
    );
  }

  // TFT도 가로로 긴 키아트 한 장이라 **PUBG와 같은 모양**이다(협곡 스택 아님). 다른 것은
  // 마스크 높이·광원 위치·인트로 이름뿐이고, 그 셋은 전부 ambient.css가 갖는다.
  if (isTft) {
    return (
      <div className="ambient-root" aria-hidden="true">
        <div
          key={intro.runToken ?? "static"}
          className={`ambient-tft-art${tftConverging ? " is-converging" : ""}`}
          onAnimationEnd={intro.markEnded}
        />
        <div className="ambient-glow" />
        <div className="ambient-scrim" />
        <div className="ambient-grain" />
      </div>
    );
  }

  return (
    <div className="ambient-root" aria-hidden="true">
      <div
        className="ambient-wash"
        style={{ backgroundImage: "url(/bg/island-wash.jpg)" }}
      />

      {showDetailSplash ? (
        <div
          className="ambient-terrain-corner"
          style={{ backgroundImage: "url(/bg/island.webp)" }}
        />
      ) : (
        <div className="ambient-camera">
          <div
            className="ambient-cam-inner"
            style={
              {
                "--z": scale,
                "--tx": `${tx}%`,
                "--ty": `${ty}%`,
              } as React.CSSProperties
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ambient-island" src="/bg/island.webp" alt="" />
          </div>
        </div>
      )}

      {showDetailSplash ? (
        <div className="ambient-duo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={detailSplashUrl} alt="" />
          <div className="ambient-duo-tint" />
        </div>
      ) : null}

      {/* isHome 가드(2026-09-14) — introPlaying은 enabled(isHome&&!reducedMotion)가 true였던
          순간 켜진 뒤 리셋되지 않으므로, 재생 도중 다른 라우트로 이동해도(예: /lol/compare/) 이
          레이어가 그대로 남아 배경 위에 얹힌다. isHome을 여기서도 확인해 홈을 벗어나면 즉시
          사라지게 한다(재생 중단 자체는 <video> 언마운트가 처리). */}
      {isHome && intro.active ? (
        <div className="ambient-reveal" key={intro.runToken ?? "static"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/bg/intro-still.jpg" alt="" />
          <video
            muted
            playsInline
            autoPlay
            preload="auto"
            src="/bg/intro.webm"
            onEnded={intro.markEnded}
          />
        </div>
      ) : null}

      <div className="ambient-glow" />
      <div className="ambient-scrim" />
      <div className="ambient-grain" />
    </div>
  );
}
