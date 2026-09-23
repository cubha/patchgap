// src/components/methodology/slots.ts
// 방법론 **9슬롯** — 순서와 제목을 코드가 소유한다(UX-BRIEF §8-4).
//
// **왜 코드가 소유하나**(§8-6 "새 게임을 붙일 때 빠진 슬롯이 **빌드에서 드러나야** 한다"):
// 세 방법론이 각자 `SectionCard`를 손으로 나열하고 있었고, 그래서 같은 축이 게임마다 있거나
// 없거나 이름이 달랐다 — 실측(2026-09-22 13화면):
//   - LoL: 표본 없음 · 한계 없음 · 파이프라인은 STEP 다이어그램
//   - PUBG: 추정 원인 없음 · 파이프라인은 번호 리스트
//   - TFT: 파이프라인·게이트·표시 규칙·추정 원인 넷 다 없음
// 이제 `MethodologySlots`가 `Record<MethodologySlotKey, …>`라 **하나라도 비우면 tsc가 막는다**.
// 랜딩 확장성 표가 `Record<GameId, string>`으로 같은 일을 하고 있는 것과 같은 방식이다.
//
// 쓰지 않는 축은 **빈칸이 아니라 그 자리에서 말한다**(§8-4). `unusedAxis()`가 그 문장을 만든다.

export const METHODOLOGY_SLOTS = [
  { key: "sample", eyebrow: "표본", title: "무엇을 셌나", anchor: null },
  { key: "pipeline", eyebrow: "신뢰", title: "데이터 파이프라인", anchor: null },
  // 앵커 `#gates` — 상세 화면의 「판정 규칙 보기 →」가 여기로 착지한다. 바꾸면 그 링크가 죽는다.
  { key: "gate", eyebrow: "게이트", title: "통계 게이트와 효과크기 바닥", anchor: "gates" },
  { key: "verdict", eyebrow: "해석", title: "판정은 무엇을 뜻하나", anchor: null },
  { key: "display", eyebrow: "표시 규칙", title: "화면이 고르는 것", anchor: null },
  { key: "cause", eyebrow: "추정 원인", title: "원인은 무엇을 보고 짚나", anchor: null },
  { key: "gamedata", eyebrow: "수치 축", title: "잠수함 패치는 어떻게 찾나", anchor: null },
  // 앵커 `#discord` — 세 홈의 디스코드 패널이 여기로 착지한다(§8-1).
  { key: "notify", eyebrow: "알림", title: "디스코드로 무엇이 나가나", anchor: "discord" },
  { key: "limits", eyebrow: "한계", title: "먼저 밝히는 것", anchor: null },
] as const;

// `anchor`를 **전 슬롯이 가진다**(없으면 `null`). 선택 필드로 두면 유니온 멤버마다 필드 유무가
// 갈려 `slot.anchor` 접근이 타입 에러가 된다 — 실측으로 빌드가 막혔다(2026-09-23).

export type MethodologySlotKey = (typeof METHODOLOGY_SLOTS)[number]["key"];

/**
 * 이 게임이 그 축을 쓰지 않을 때의 본문. **문자열 한 줄만 받는다** — 사유를 적게 강제하려는
 * 것이다. "해당 없음"으로 칸을 메우는 것과, 왜 없는지를 말하는 것은 다르다.
 */
export interface UnusedAxis {
  readonly unused: string;
}

export function isUnusedAxis(value: unknown): value is UnusedAxis {
  return typeof value === "object" && value !== null && "unused" in value;
}

/** 슬롯 정의를 키로 찾는다(앵커·제목이 필요한 곳). */
export function slotDef(key: MethodologySlotKey) {
  const hit = METHODOLOGY_SLOTS.find((s) => s.key === key);
  if (!hit) throw new Error(`slotDef: 등록되지 않은 슬롯 ${key}`);
  return hit;
}
