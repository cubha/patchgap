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
import { itemHref, itemSlug } from "@/lib/format";

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

/**
 * 이 행이 속한 **대상**의 키 — `champion:MonkeyKing`. 지표도 라인도 키에 들어가지 않는다.
 * `components/compare/entityRows.ts`가 표에서 쓰는 키와 같은 형태다(두 화면이 같은 단위를 센다).
 */
export function entityKeyOf(row: DeltaRecord): string {
  return `${row.entityType}:${row.entityKey}`;
}

/**
 * 상세 라우트의 **정준 단위 = 대상**(UX-BRIEF §8-5 「라우트 단위도 대상」, §8-7 #10).
 *
 * 전에는 LoL만 지표 단위였다 — `champion~MonkeyKing~JUNGLE~winRate` 실측 137건이 제각각
 * 한 화면씩 차지했고, 같은 챔피언을 보려면 지표마다 다른 URL을 열어야 했다. TFT·PUBG는 이미
 * 대상 단위였으므로 이쪽을 맞춘다. 지표는 **그 화면 안의 구획**이 된다.
 */
export function detailEntityKeys(rowsByPair: ReadonlyArray<readonly DeltaRecord[]>): string[] {
  const keys = new Set<string>();
  for (const rows of rowsByPair) {
    for (const row of rows) {
      if (isNoiseStatus(row.status)) continue;
      keys.add(entityKeyOf(row));
    }
  }
  return Array.from(keys);
}

/**
 * 빌드할 슬러그 전부 — **정준(대상) + 별칭(구 지표 id)**.
 *
 * **왜 별칭을 살리나**: 구 지표 경로는 이미 디스코드 알림으로 나갔다(`pipeline/discord/webhook.ts`가
 * `itemHref`를 쓴다). 이 사이트는 `output:'export'`라 런타임 리다이렉트가 없고, `vercel.json`
 * 정규식은 로컬 빌드로 검증할 수 없다 — 반면 별칭 페이지는 **빌드가 직접 증명한다**. 심사 기간에
 * 링크가 조용히 404가 되는 쪽이 정적 파일 137장보다 비싸다.
 *
 * 별칭 경로도 같은 대상 화면을 그린다(내용이 같으니 정보가 갈리지 않는다).
 */
export function detailRouteSlugs(rowsByPair: ReadonlyArray<readonly DeltaRecord[]>): string[] {
  const slugs = new Set<string>();
  for (const key of detailEntityKeys(rowsByPair)) slugs.add(itemSlug(key));
  for (const id of detailRouteIds(rowsByPair)) slugs.add(itemSlug(id));
  return Array.from(slugs);
}

/** 대상 상세로 가는 정준 링크. 화면은 전부 이것을 쓴다(구 지표 링크는 별칭으로만 남는다). */
export function lolEntityHref(row: Pick<DeltaRecord, "entityType" | "entityKey">): string {
  return itemHref(`${row.entityType}:${row.entityKey}`);
}
