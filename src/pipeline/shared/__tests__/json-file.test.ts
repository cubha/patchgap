// JSON 읽기 세 변종의 실패 의미(2026-10-06). 이름이 같던 일곱 사본을 모으면서 의미를 섞지 않았는지 고정한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readJsonIfExists, readJsonOrNull, readJsonRequired } from "../json-file";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-file-"));
  fs.writeFileSync(path.join(dir, "ok.json"), '{"a":1}');
  fs.writeFileSync(path.join(dir, "bad.json"), "{not json");
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const f = (name: string) => path.join(dir, name);

describe("json-file", () => {
  it("정상 파일은 세 변종 모두 같은 값을 준다", () => {
    expect(readJsonIfExists(f("ok.json"))).toEqual({ a: 1 });
    expect(readJsonOrNull(f("ok.json"))).toEqual({ a: 1 });
    expect(readJsonRequired(f("ok.json"), "x")).toEqual({ a: 1 });
  });
  it("없는 파일: IfExists·OrNull은 null, Required는 주어진 메시지로 던진다", () => {
    expect(readJsonIfExists(f("none.json"))).toBeNull();
    expect(readJsonOrNull(f("none.json"))).toBeNull();
    expect(() => readJsonRequired(f("none.json"), "먼저 집계를 돌린다")).toThrow("먼저 집계를 돌린다");
  });
  it("깨진 파일: IfExists·Required는 던지고 OrNull만 null", () => {
    expect(() => readJsonIfExists(f("bad.json"))).toThrow(SyntaxError);
    expect(() => readJsonRequired(f("bad.json"), "x")).toThrow(SyntaxError);
    expect(readJsonOrNull(f("bad.json"))).toBeNull();
  });
});
