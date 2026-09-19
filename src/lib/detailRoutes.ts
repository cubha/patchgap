// src/lib/detailRoutes.ts
// 어떤 관측이 **상세 라우트를 가질 자격**이 있는지 한 곳에서 정한다(2026-09-19).
//
// 왜 필요한가(최종 채점 K2-4): 노이즈 상태(표본 부족·바닥 미달·변화 없음) 상세가 1,870건
// 빌드돼 있었다. 화면 어디에서도 링크하지 않으니 사용자가 우연히 밟을 일은 없지만, 사용자 지시는
// "아예 보여주지 않도록"이었고 URL을 직접 열면 그 관측이 그대로 나왔다. 링크를 지우는 것과 파일을
// 없애는 것은 다르다 — 후자가 지시에 맞는다.
//
// 목록·표의 표시 자격은 `isReportableRecord`(유의성·바닥까지 본다)가 따로 판정한다. 여기서는
// **상태만** 본다: 판정이 선 관측(공지·이상 관측·미공지·간접 영향)은 상세를 갖고, 노이즈는 갖지
// 않는다. 둘을 하나로 합치지 않는 이유는 링크된 카드보다 상세의 자격이 넓어야 하기 때문이다 —
// 홈이 접어 둔 "유의한 관측 없음" 행도 대조표에서는 열 수 있어야 한다.
import type { DeltaRecord } from "@/pipeline/types";
import { isNoiseStatus } from "@/pipeline/shared/display-status";

/** 패치 쌍별 rows 묶음을 받아 상세를 만들 id를 중복 없이, 최신 쌍 우선 순서로 돌려준다. */
export function detailRouteIds(rowsByPair: ReadonlyArray<readonly DeltaRecord[]>): string[] {
  const ids = new Set<string>();
  for (const rows of rowsByPair) {
    for (const row of rows) {
      if (isNoiseStatus(row.status)) continue;
      ids.add(row.id);
    }
  }
  return Array.from(ids);
}
