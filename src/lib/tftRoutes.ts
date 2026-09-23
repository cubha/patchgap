// src/lib/tftRoutes.ts
// TFT 상세 라우트 슬러그 — 정준키 ↔ URL 세그먼트. 순수 함수만(`pubgRoutes.ts`와 같은 자리).
//
// **왜 라우트 파일에서 옮겼나**(2026-09-23): `entitySlug`가 `app/tft/unit/[key]/page.tsx`에
// 있어서, 대조표 클라이언트 컴포넌트가 링크를 만들려면 **페이지 모듈을 import**하거나 부모가
// 함수를 prop으로 넘겨야 했다. 후자는 빌드가 막는다(「Functions cannot be passed directly to
// Client Components」 — 실측 프리렌더 실패). 경로 규칙은 화면이 아니라 lib의 것이다.
//
// `:`을 URL에 그대로 쓰지 않는 이유는 LoL `itemSlug`와 같다 — 퍼센트 인코딩 슬러그가 정적
// 서버에서 전부 404가 났던 2026-09-05 실측 때문에, 이 저장소는 **문자 치환만** 쓴다.

/** `unit:DA_18_Rakan` → `unit~DA_18_Rakan`. */
export function entitySlug(key: string): string {
  return key.replace(/:/g, "~");
}

/** `unit~DA_18_Rakan` → `unit:DA_18_Rakan`. */
export function entityKeyFromSlug(slug: string): string {
  return slug.replace(/~/g, ":");
}

export function tftEntityHref(key: string): string {
  return `/tft/unit/${entitySlug(key)}/`;
}
