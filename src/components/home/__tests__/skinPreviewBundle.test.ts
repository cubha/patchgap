// src/components/home/__tests__/skinPreviewBundle.test.ts
// 2026-09-19 최종 채점 K2-5(低): 기타 변경 › 신규 스킨·치장에서 "떠오른 전설 오리아나 스킨 및
// 테두리" / "이벤트 크로마" / "앞으로 나올 스킨" 세 줄이 **같은 스플래시(Orianna_40)를 세 번**
// 띄웠다. 세 줄은 서로 다른 항목이라 줄 자체는 합칠 수 없지만(크로마와 스킨은 다른 것이다),
// 이미지는 같은 그림이므로 묶음당 한 번만 보이면 된다.
import { describe, expect, it } from "vitest";
import { dedupeBundleSkins, createSkinDeduper } from "../skinPreviewBundle";

const ORIANNA = { name: "떠오른 전설 오리아나", src: "/dd/splash/Orianna_40.jpg" };
const TALIYAH = { name: "떠오른 전설 탈리야", src: "/dd/splash/Taliyah_1.jpg" };

describe("dedupeBundleSkins", () => {
  it("같은 src는 한 번만 남긴다 — 등장 순서 유지", () => {
    const out = dedupeBundleSkins(
      [{ id: "n1" }, { id: "n2" }, { id: "n3" }],
      { n1: [ORIANNA], n2: [ORIANNA], n3: [ORIANNA, TALIYAH] }
    );
    expect(out.map((s) => s.src)).toEqual([ORIANNA.src, TALIYAH.src]);
  });

  it("매칭된 스킨이 없는 줄은 아무것도 더하지 않는다", () => {
    expect(dedupeBundleSkins([{ id: "n1" }, { id: "n2" }], { n1: [] })).toEqual([]);
  });

  it("서로 다른 스킨은 전부 남긴다", () => {
    const out = dedupeBundleSkins([{ id: "n1" }, { id: "n2" }], { n1: [ORIANNA], n2: [TALIYAH] });
    expect(out).toHaveLength(2);
  });
});

// 2026-09-19 재판정(K2-5 4/5 유지): 묶음 **안**에서만 중복을 제거해 3회가 2회로 줄었을 뿐이다.
// 지적된 3행("스킨 및 테두리"·"이벤트 크로마"·"앞으로 나올 스킨")은 애초에 **두 묶음에 걸쳐**
// 있었다 — 같은 그림이 한 화면에 두 번 뜨는 것은 그대로였다. 중복 제거의 범위는 사용자가 한 번에
// 보는 단위, 즉 기타 변경 블록 전체여야 한다.
describe("createSkinDeduper — 블록 전체 범위", () => {
  it("묶음이 달라도 같은 src는 한 번만 남긴다", () => {
    const dedupe = createSkinDeduper();
    const first = dedupe([{ id: "n1" }], { n1: [ORIANNA] });
    const second = dedupe([{ id: "n2" }], { n2: [ORIANNA, TALIYAH] });
    expect(first.map((s) => s.src)).toEqual([ORIANNA.src]);
    expect(second.map((s) => s.src)).toEqual([TALIYAH.src]);
  });

  it("deduper가 다르면 상태를 공유하지 않는다(다음 렌더가 오염되지 않는다)", () => {
    expect(createSkinDeduper()([{ id: "n1" }], { n1: [ORIANNA] })).toHaveLength(1);
    expect(createSkinDeduper()([{ id: "n1" }], { n1: [ORIANNA] })).toHaveLength(1);
  });
});
