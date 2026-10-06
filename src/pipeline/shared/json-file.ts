// src/pipeline/shared/json-file.ts
// JSON 파일 읽기의 세 변종(2026-10-06 단일화). 같은 이름 `readJson`이 일곱 곳에 있었는데 **실패 의미가 셋으로
// 갈렸다** — 그래서 하나로 합치지 않고 이름으로 구분한다. 빌드 타임 로더(lib)와 스크립트가 함께 쓰므로
// `server-only`를 여기서 import하지 않는다(tsx 스크립트에서 터진다 — 로더 쪽이 각자 건다).
import fs from "node:fs";

/** 없으면 `null`, 있는데 깨졌으면 **던진다** — 산출물이 아직 없는 것과 산출물이 망가진 것을 가른다. */
export function readJsonIfExists<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/** 없거나 깨졌으면 `null` — 화면이 "미연결"로 떨어지면 되는 선택적 산출물용. */
export function readJsonOrNull<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** 반드시 있어야 하는 입력 — 없으면 무엇을 먼저 돌려야 하는지 담은 메시지로 던진다. */
export function readJsonRequired<T>(file: string, missingMessage: string): T {
  if (!fs.existsSync(file)) throw new Error(missingMessage);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
