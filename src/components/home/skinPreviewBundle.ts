// src/components/home/skinPreviewBundle.ts
// 기타 변경 블록의 스킨 스플래시를 **엔티티 묶음 단위로 한 번씩만** 고른다(2026-09-19).
//
// 왜 필요한가(최종 채점 K2-5): "떠오른 전설 오리아나 스킨 및 테두리" / "이벤트 크로마" /
// "앞으로 나올 스킨" 세 줄이 각각 `CosmeticSkinPreview`를 그려 **같은 그림(Orianna_40)이 세 번**
// 떴다. 줄 자체는 합칠 수 없다 — 크로마와 스킨은 다른 항목이고, 합치면 없는 항목을 만든 셈이 된다.
// 합쳐야 하는 것은 **이미지**다. CosmeticSkinPreview의 캡션은 원래 노트 문구가 아니라 매칭된
// 스킨명이므로(그 컴포넌트 주석 참고), 묶음당 한 번 그려도 캡션이 가리키는 대상은 그대로다.
import type { CosmeticSkinItem } from "./CosmeticSkinPreview";

/** `note.id`만 있으면 되므로 전체 노트 타입을 요구하지 않는다(테스트가 최소 입력으로 고정 가능). */
export interface SkinBundleNote {
  id: string;
}

/**
 * 묶음 안의 노트들이 가리키는 스킨을 `src` 기준으로 중복 제거한다. 순서는 첫 등장 순서를 지킨다 —
 * 패치노트 문서 순서가 곧 사용자가 읽는 순서다(releaseStream과 같은 관례).
 *
 * **범위 주의**: 이 함수는 호출 한 번 안에서만 중복을 본다. 기타 변경 블록처럼 여러 묶음을 잇달아
 * 그리는 자리에서는 `createSkinDeduper`를 써야 한다 — 2026-09-19 재판정에서 이 함수만으로는
 * 오리아나 스플래시가 **두 묶음에 걸쳐** 두 번 남는 것이 실측됐다(3회 → 2회에 그쳤다).
 */
export function dedupeBundleSkins(
  notes: readonly SkinBundleNote[],
  skinPreviews: Readonly<Record<string, CosmeticSkinItem[]>>
): CosmeticSkinItem[] {
  return createSkinDeduper()(notes, skinPreviews);
}

/**
 * 렌더 1회(= 사용자가 한 번에 보는 블록) 동안 이미 그린 스플래시를 기억하는 중복 제거기를 만든다.
 * 중복의 단위는 묶음이 아니라 **한 화면**이다 — 같은 그림이 두 번 보이면 그것이 결함이지, 어느
 * 묶음에 속했는지는 사용자에게 보이지 않는다.
 *
 * 모듈 수준 상태를 쓰지 않고 팩토리로 두는 이유: 서버 컴포넌트가 여러 요청을 처리하면 렌더 사이에
 * 집합이 새어 두 번째 렌더에서 그림이 통째로 사라진다.
 */
export function createSkinDeduper(): (
  notes: readonly SkinBundleNote[],
  skinPreviews: Readonly<Record<string, CosmeticSkinItem[]>>
) => CosmeticSkinItem[] {
  const seen = new Set<string>();
  return (notes, skinPreviews) => {
    const out: CosmeticSkinItem[] = [];
    for (const note of notes) {
      for (const skin of skinPreviews[note.id] ?? []) {
        if (seen.has(skin.src)) continue;
        seen.add(skin.src);
        out.push(skin);
      }
    }
    return out;
  };
}
