// src/lib/laneCamera.ts
// 앰비언트 배경 카메라 — 협곡 확정 시안(아티팩트 "협곡 앰비언트 배경" v5, LAYER 2)의 "전체"
// 초점을 고정 프레이밍으로 쓴다. AmbientBackground.tsx가 `--tx/--ty/--z` CSS 커스텀 프로퍼티로
// 그대로 꽂는다.
//
// 2026-09-13(6차 연속, 사용자 결정) — 라인 필터 선택에 따라 배경이 라인별 초점으로 확대·이동
// 하던 동작을 제거했다. 실사용 검증 후 "시점이동하는건 없는게 맞을거같다. 오히려 어지러워" —
// 세션 초반엔 "우선 유지, 다시 검증해보고 판단"이었는데 이번에 그 검증이 끝났다. 라인별 초점
// 표(TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY, fx/fy/z 실측값)는 전부 제거하고 "전체" 프레이밍만
// 고정값으로 남긴다 — 라인을 눌러도 배경은 움직이지 않는다.
//
// 2026-09-14(8차, 사용자 지적 — "애니메이션에서 보이는 화면 지점이랑 종료 후 보이는 화면
// 지점이 달라서 배경이 이동하는 것처럼 보인다") — 그때까지의 tx=2/ty=8(과거 fx=0.48/fy=0.42
// 초점 환산값)은 인트로 리빌 레이어(`.ambient-reveal`, ambient.css)의 프레이밍과 애초에
// 맞춰진 적이 없었다. 인트로 레이어는 `translateX(-50%)`만 쓰고(세로 오프셋·tx/ty 없음) 항상
// 그 프레이밍으로 재생되므로, 인트로가 끝나 이 레이어(`.ambient-camera`)가 드러나는 순간
// 같은 지형 이미지가 (구 -6%+8%≈+2% 세로, +2% 가로)만큼 튀어 보였다. "현행 애니메이션
// 기준으로 맞춰줘"(사용자 지시) — 인트로 쪽을 기준으로 삼아 이 상시 레이어를 거기 맞춘다:
// tx/ty를 0으로 바꾸고(ambient.css의 cam-inner -6% 오프셋도 0으로 정정), 결과 transform이
// 인트로 레이어와 동일한 `translateX(-50%)`가 되어 전환 시 픽셀 단위로 이어진다.

export interface LaneCameraTransform {
  /** translateX 퍼센트 — cam-inner 자기 폭 기준(양수=오른쪽 이동). */
  tx: number;
  /** translateY 퍼센트 — cam-inner 자기 높이 기준(양수=아래 이동). */
  ty: number;
  /** scale 배율. */
  scale: number;
}

const BASE_CAMERA: LaneCameraTransform = { tx: 0, ty: 0, scale: 1.0 };

/** 고정 카메라 프레이밍 — 인트로 리빌 레이어와 동일 프레이밍(이동 없음, z=1.0). */
export function laneCameraTransform(): LaneCameraTransform {
  return BASE_CAMERA;
}
