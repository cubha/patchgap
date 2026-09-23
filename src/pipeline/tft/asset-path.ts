// src/pipeline/tft/asset-path.ts
// TFT 엔티티 자산(Data Dragon) 경로 규칙 — 순수 함수만. 다운로드는 `scripts/run-tft-assets.ts`,
// 소비는 `src/components/tft/*`.
//
// **왜 생겼나**(UX-BRIEF §8-7 말미 자기모순): 랜딩 확장성 표가 TFT 「엔티티 자산 = Data Dragon
// tft-champion·tft-trait·tft-item (Set 18 필터)」로 **연결됨**이라 주장하는데, 실측으로 TFT 화면의
// 이미지는 **0건**이었다(상세·브리핑·대조표 전부). 표가 말한 소스는 실재했다 — 이름 카탈로그로만
// 쓰고 있었고 이미지 배선이 없었을 뿐이다. 표를 고치는 대신 배선을 한다.
//
// **런타임 외부 호출 0 원칙**: 여기서 만드는 원격 URL은 **빌드 이전 스크립트에서만** 쓴다.
// 브라우저가 보는 것은 `publicTftAssetPath`가 가리키는 `public/dd/tft/` 로컬 경로뿐이다.

/** 이 프로젝트가 자산을 갖는 TFT 대상 종류 — 델타의 `entityType`과 같은 어휘다. */
export type TftAssetKind = "unit" | "trait" | "item";

/** DDragon 카탈로그 파일 이름. `tft-catalog.ts`의 `FILES`와 같은 값이되, 여기는 자산용이다. */
export const TFT_CATALOG_FILE: Record<TftAssetKind, string> = {
  unit: "tft-champion",
  trait: "tft-trait",
  item: "tft-item",
};

/** 카탈로그 JSON 원격 URL. */
export function remoteTftCatalogUrl(version: string, kind: TftAssetKind, locale = "ko_KR"): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/data/${locale}/${TFT_CATALOG_FILE[kind]}.json`;
}

/** 이미지 원격 URL — `full`은 카탈로그 항목의 `image.full` 값이다. */
export function remoteTftImageUrl(version: string, kind: TftAssetKind, full: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/${TFT_CATALOG_FILE[kind]}/${full}`;
}

/**
 * 브라우저가 실제로 요청하는 로컬 경로.
 *
 * 파일명에 **엔티티 키의 basename**을 쓴다(카탈로그 `image.full`이 아니라). 화면은 델타의
 * `entityKey`(`DA_18_Rakan`)만 들고 있고, 카탈로그 파일명(`TFT18_Rakan_splash_centered_3.…`)은
 * 모르기 때문이다 — 이름 변환 규칙을 화면에 심으면 다음 세트에서 조용히 깨진다.
 */
export function publicTftAssetPath(kind: TftAssetKind, entityKey: string): string {
  return `/dd/tft/${kind}/${entityKey}.png`;
}

/**
 * 조달 결과 매니페스트 — 스크립트가 쓰고 화면이 읽는다.
 *
 * **왜 필요한가**: 카탈로그에 없는 대상이 실제로 있다(실측: 덩굴정령·어미 부리 등 소환수는
 * `tft-champion.json`에 아예 없다 — `tft-catalog.ts` 주석 참고). 그 경우 화면은 **설계된 폴백**을
 * 그려야 하고, 깨진 `<img>`는 폴백이 아니다. 빌드 타임에 이 파일을 읽어 미리 판정하므로
 * 클라이언트 `onError` 핸들러가 필요 없다(`PubgAssetManifest`와 같은 구조).
 */
export interface TftAssetManifest {
  generatedAt: string;
  source: string;
  /** 카탈로그를 읽은 Data Dragon 버전. */
  version: string;
  /** 조달에 성공한 엔티티 키(종류별). */
  assets: Record<TftAssetKind, string[]>;
  /** 원격에 없어서 조달하지 못한 항목 — 숨기지 않고 기록한다. */
  missing: { kind: TftAssetKind; key: string; reason: string }[];
}
