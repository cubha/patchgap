import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { envValue, isMainModule, parseCliArgs, PATCH_ID_PATTERN } from "../cli";

describe("isMainModule", () => {
  it("process.argv[1]을 pathToFileURL로 변환한 값과 일치하면 true", () => {
    // 테스트 러너(vitest) 자체가 엔트리 파일이라 process.argv[1]은 항상 존재한다 — 그 값을
    // 그대로 pathToFileURL에 통과시켜 넘기면 정의상 반드시 true여야 한다.
    expect(process.argv[1]).toBeDefined();
    const entryUrl = pathToFileURL(process.argv[1] as string).href;
    expect(isMainModule(entryUrl)).toBe(true);
  });

  it("process.argv[1]과 다른 URL이면 false", () => {
    expect(isMainModule("file:///not/the/entry.ts")).toBe(false);
  });
});

describe("parseCliArgs", () => {
  const spec = [
    { name: "patch", type: "string" as const, required: true },
    { name: "target", type: "number" as const, default: 10000 },
    { name: "dataRoot", type: "string" as const },
    { name: "noLlm", type: "boolean" as const, default: false },
    { name: "llmMax", type: "number" as const, default: 50 },
  ];

  it("필수 옵션 누락 시 스크립트명을 포함한 에러", () => {
    expect(() => parseCliArgs("run-x", [], spec)).toThrow(/run-x: --patch/);
  });

  it("옵션을 camelCase 키로 파싱한다(kebab-case 플래그 자동 유도)", () => {
    const values = parseCliArgs("run-x", ["--patch", "26.17", "--data-root", "/tmp/x", "--llm-max", "10"], spec);
    expect(values).toEqual({ patch: "26.17", target: 10000, dataRoot: "/tmp/x", noLlm: false, llmMax: 10 });
  });

  it("boolean 플래그는 값 없이 true", () => {
    const values = parseCliArgs("run-x", ["--patch", "26.17", "--no-llm"], spec);
    expect(values.noLlm).toBe(true);
  });

  it("숫자 타입 변환 실패 시 플래그명을 포함한 에러", () => {
    expect(() => parseCliArgs("run-x", ["--patch", "26.17", "--target", "abc"], spec)).toThrow(
      /run-x: --target must be a number/
    );
  });

  it("알 수 없는 플래그는 에러", () => {
    expect(() => parseCliArgs("run-x", ["--patch", "26.17", "--bogus"], spec)).toThrow(
      /run-x: unknown argument "--bogus"/
    );
  });

  it("기본값은 플래그 미지정 시에만 적용된다", () => {
    const values = parseCliArgs("run-x", ["--patch", "26.17", "--target", "0"], spec);
    expect(values.target).toBe(0);
  });
});

describe("parseCliArgs — type: 'patch' (패치 ID 형식 강제, security-auditor Warning 대응)", () => {
  const patchSpec = [{ name: "patch", type: "patch" as const, required: true }];

  it("정상 형식(26.17)은 그대로 통과한다", () => {
    const values = parseCliArgs("run-x", ["--patch", "26.17"], patchSpec);
    expect(values).toEqual({ patch: "26.17" });
  });

  it("경로 조작 문자열(../etc)은 거부한다", () => {
    expect(() => parseCliArgs("run-x", ["--patch", "../etc"], patchSpec)).toThrow(
      /run-x: --patch must look like 26.17/
    );
  });

  it("마이너 버전이 없는 형식(26)은 거부한다", () => {
    expect(() => parseCliArgs("run-x", ["--patch", "26"], patchSpec)).toThrow(
      /run-x: --patch must look like 26.17/
    );
  });
});

describe("envValue / PATCH_ID_PATTERN — determine 세 진입점 공용(2026-10-06 단일화)", () => {
  it("공백을 걷고 빈 값은 undefined", () => {
    expect(envValue("X", { X: "  26.19 " })).toBe("26.19");
    expect(envValue("X", { X: "   " })).toBeUndefined();
    expect(envValue("X", {})).toBeUndefined();
  });
  it("패치 ID 형식만 통과한다", () => {
    expect(PATCH_ID_PATTERN.test("26.19")).toBe(true);
    expect(PATCH_ID_PATTERN.test("18.3")).toBe(true);
    expect(PATCH_ID_PATTERN.test("26.19; rm -rf /")).toBe(false);
    expect(PATCH_ID_PATTERN.test("../26.19")).toBe(false);
  });
});
