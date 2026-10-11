// src/components/gapPreview.ts — 첫 화면 미공지 사례 선택(트랙 B ST-22). 구현 전 시그니처.
export interface GapPreviewItem {
  key: string;
  name: string;
  text: string;
  href: string | null;
  score: number;
}

export function pickGapPreview(items: readonly GapPreviewItem[], n: number): GapPreviewItem[] {
  void items;
  void n;
  throw new Error("TODO(gapPreview): pickGapPreview");
}
