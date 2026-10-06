// src/pipeline/shared/patches.ts
// 패치 표기 양방향 매핑. 실측(2026-09-05): 패치노트 major = gameVersion/Data Dragon major + 10
// (예: gameVersion "16.17.708.1234" · ddragon "16.17.1" ↔ 패치노트 "26.17"). PLAN ② 근거.

import type { PatchId } from "../types";

/** 패치노트 major(예: 26)와 gameVersion/ddragon major(예: 16) 사이의 고정 오프셋. */
export const PATCH_MAJOR_OFFSET = 10;

const VERSION_PATTERN = /^(\d+)\.(\d+)(?:\.\d+)*$/;

function extractMajorMinor(input: string): { major: number; minor: number } {
  const match = VERSION_PATTERN.exec(input.trim());
  if (!match) {
    throw new Error(`invalid version format (expected "major.minor[...]"): "${input}"`);
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

/**
 * 임의 형식의 버전 문자열을 패치노트 정규 표기(PatchId, 예: "26.17")로 정규화한다.
 * 입력 예: "16.17.708.1234"(gameVersion) · "16.17.1"(ddragon) · "26.17"(패치노트) → 전부 "26.17".
 * major < 20이면 gameVersion/ddragon 표기로 간주해 +PATCH_MAJOR_OFFSET, 이미 20 이상이면
 * 패치노트 표기로 간주해 그대로 둔다(세그먼트 개수가 아니라 major 크기로 판별).
 */
export function canonicalPatch(input: string): PatchId {
  const { major, minor } = extractMajorMinor(input);
  const canonicalMajor = major < 20 ? major + PATCH_MAJOR_OFFSET : major;
  return `${canonicalMajor}.${minor}`;
}

/** 패치노트 정규 표기(major>=20)를 gameVersion/ddragon major 표기("major.minor")로 역변환한다. */
export function toDdragonMajor(patch: PatchId): string {
  const { major, minor } = extractMajorMinor(patch);
  if (major < 20) {
    throw new Error(`toDdragonMajor expects a canonical patch (major>=20): "${patch}"`);
  }
  return `${major - PATCH_MAJOR_OFFSET}.${minor}`;
}
