import { describe, it, expect } from "vitest";
import { canonicalPatch, toDdragonMajor } from "../patches";

describe("canonicalPatch", () => {
  it("gameVersion 원문(4세그먼트)을 패치노트 표기로 정규화한다", () => {
    expect(canonicalPatch("16.17.708.1234")).toBe("26.17");
  });

  it("ddragon 버전(3세그먼트)을 패치노트 표기로 정규화한다", () => {
    expect(canonicalPatch("16.17.1")).toBe("26.17");
  });

  it("이미 패치노트 표기(2세그먼트, major>=20)면 그대로 둔다", () => {
    expect(canonicalPatch("26.17")).toBe("26.17");
  });

  it("2세그먼트 gameVersion major도 동일 오프셋으로 매핑한다", () => {
    expect(canonicalPatch("16.1")).toBe("26.1");
  });

  it("major 자릿수가 달라도 minor를 보존한다", () => {
    expect(canonicalPatch("16.9.1234.5678")).toBe("26.9");
  });

  it("형식이 맞지 않으면 throw한다", () => {
    expect(() => canonicalPatch("not-a-version")).toThrow();
    expect(() => canonicalPatch("")).toThrow();
    expect(() => canonicalPatch("26")).toThrow();
  });
});

describe("toDdragonMajor", () => {
  it("패치노트 표기를 ddragon major 표기로 역변환한다", () => {
    expect(toDdragonMajor("26.17")).toBe("16.17");
  });

  it("major<20(이미 ddragon 표기로 보이는 값)이면 throw한다", () => {
    expect(() => toDdragonMajor("16.17")).toThrow();
  });

  it("canonicalPatch ↔ toDdragonMajor 왕복이 성립한다", () => {
    const canonical = canonicalPatch("16.17.708.1234");
    expect(toDdragonMajor(canonical)).toBe("16.17");
  });
});
