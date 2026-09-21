// src/components/gamedata/submarineText.ts
// 대조표 「바뀐 것」 열 — 수치 축(F9)의 값을 **표 한 칸**에 넣는 규칙.
//
// PLAN-submarine-patch ST-9는 「바뀐 것」 열 · 배지 · 로더 셋을 요구했는데 배지·로더만
// 만들어졌다. 그래서 대조표는 잠수함 배지를 찍어 놓고 **무엇이 바뀌었는지 말하지 않았고**,
// `row.submarineChanges`는 채워진 채 아무도 안 읽는 죽은 데이터였다(2026-09-21 사용자 지적).
//
// **왜 포맷을 이 함수 안에 가두는가**: 같은 float32 잡음이 비교 축에서는 `sameNumber()`의
// 1e-6에 막히고 표시 축에서는 아무도 안 막아 프로덕션에 나갔다(드레이븐 공격 속도
// `0.800000011920929 → 0.8500000238418579`, 커밋 2f1fe9e). 이번엔 표시 surface가 여섯 곳
// (대조표 3 + 상세 3)으로 늘어난다 — 한 곳이라도 `{change.before} → {change.after}`를 손으로
// 쓰면 같은 결함이 돌아온다. 그래서 값을 통과시키지 않고 **문자열만 내보낸다**.
//
// 세 게임이 이 함수를 공유하되 **렌더는 각자 한다** — 사용자 확정(2026-09-21): "게임별로
// 넘어오는포멧도다르고 정보도 상이하니 판정기준만 동일하게하라는말이야".
import { gameDataValue } from "@/lib/format";
import type { GameDataChange } from "@/pipeline/gamedata/types";

export interface SubmarineCell {
  /** 사람이 읽는 필드명(`"공격력"`·`"가격"`). */
  readonly field: string;
  /** 표시용 문자열 — 이미 반올림·`"없음"` 처리가 끝났다. */
  readonly before: string;
  readonly after: string;
  /** 첫 건 말고 더 있는 개수. 0이면 "외 N건"을 붙이지 않는다. */
  readonly rest: number;
}

/**
 * 표 한 칸에 들어갈 첫 건 + 나머지 개수. 비어 있으면 `null`(빈 칸은 부르는 쪽이 그린다).
 *
 * **전부를 표에 늘어놓지 않는 이유**: 엔티티당 최대 3건이다(장로 드래곤·조약돌). 칸 안에서
 * 세로로 쌓으면 그 행만 높아져 표의 행 높이가 제각각이 된다 — 대조표가 원인 문장을 칸에
 * 밀어넣지 않는 것과 같은 판단이다. 전부는 상세에서 본다.
 */
export function submarineCellText(changes: readonly GameDataChange[]): SubmarineCell | null {
  const first = changes[0];
  if (!first) return null;
  return {
    field: first.field,
    before: gameDataValue(first.before),
    after: gameDataValue(first.after),
    rest: changes.length - 1,
  };
}

/** 접지 않은 전체 목록의 한 줄. */
export type SubmarineLine = Omit<SubmarineCell, "rest">;

/**
 * **전부** 나열한다 — 상세로 갈 자리가 없는 표에서 쓴다.
 *
 * 왜 두 형태가 필요한가(2026-09-21 acceptance-critic V1): "첫 건 외 N건"은 **나머지를 상세에서
 * 본다**는 약속이다. LoL 잠수함 전용 행에는 그 상세가 없다 — 그 엔티티엔 델타가 0건이라
 * `/lol/item/[id]` 라우트 자체가 만들어지지 않는다(PLAN X1). 그 행에서 접으면 갈 곳 없는
 * 약속이 된다. X1 원문: "갈 곳이 없으므로 표에서 값을 끝까지 말한다".
 *
 * 지금 LoL 잠수함은 1건뿐이라 접든 안 접든 화면이 같다 — 그건 데이터의 우연이지 설계 근거가
 * 아니다(`feedback_structural_caps_not_current_data`).
 */
export function submarineCellLines(changes: readonly GameDataChange[]): readonly SubmarineLine[] {
  return changes.map((change) => ({
    field: change.field,
    before: gameDataValue(change.before),
    after: gameDataValue(change.after),
  }));
}

/** 「공지값 불일치」 한 줄 — 게임 값과 **노트가 적은 값**을 나란히 말해야 뜻이 선다. */
export interface MismatchLine extends SubmarineLine {
  readonly noteBefore: string;
  readonly noteAfter: string;
}

/**
 * 공지값 불일치는 **접지 않는다.**
 *
 * "외 N건"은 나머지를 상세에서 본다는 약속인데, 실측 2건(덩굴정령·어미 부리)은 PvE 몬스터라
 * 델타 행이 0건이고 따라서 상세 라우트가 없다 — 접으면 갈 곳 없는 약속이 된다(LoL 잠수함
 * 전용 행에서 이미 한 번 밟은 결함, acceptance-critic V1). 수가 적어서가 아니라 **갈 곳이
 * 없어서** 끝까지 말한다.
 *
 * 값은 여기서만 만든다 — `change.before`를 화면이 직접 찍으면 float32 잡음이 돌아온다.
 */
export function mismatchCellLines(changes: readonly GameDataChange[]): readonly MismatchLine[] {
  const out: MismatchLine[] = [];
  for (const change of changes) {
    const mismatch = change.noteMismatch;
    if (!mismatch) continue;
    out.push({
      field: change.field,
      before: gameDataValue(change.before),
      after: gameDataValue(change.after),
      noteBefore: mismatch.noteBefore,
      noteAfter: mismatch.noteAfter,
    });
  }
  return out;
}
