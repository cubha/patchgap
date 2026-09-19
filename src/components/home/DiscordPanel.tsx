// src/components/home/DiscordPanel.tsx
// 사이드: 디스코드로 공유 — 프로토타입 `.discord-panel` 1:1(docs/design/prototype/01-briefing-home.html).
// 실제 전송은 배치 스크립트(scripts/run-notify.ts, ST-13 소유) 몫이라 버튼은 방법론 페이지로 가는
// 링크일 뿐이다(ST-11 프롬프트 명시) — 정적 export라 서버 액션도 없다. 서버 컴포넌트.
//
// 2026-09-19 문구 교정: ① 설명이 "미공지 · 공지 · 이상 관측"을 방송한다고 했는데 webhook.ts가
// 보내는 것은 **미공지 상위 N + 이상 관측 상위 3**뿐이다("공지"는 방송 대상이 아니다) ② 버튼이
// "디스코드로 브리핑 보내기"라 정적 사이트가 할 수 없는 행위를 약속했다 ③ 링크가
// `/methodology/#discord`를 가리켰는데 그 섹션은 2026-09-14 사용자 지시로 제거돼 있었다 — 일단
// 프래그먼트를 뗐다가, 방법론에 **방송 규칙 서술**을 새로 넣고 다시 그 지점을 가리키게 했다
// (2026-09-19 독립 채점 K1-2: 링크는 살았는데 도착지에 방송 이야기가 0건이었다). 되살린 것은
// 제거된 **미리보기 목업**이 아니라 "무엇이 언제 나가나"라는 사실 서술이다.
// ④ "마지막 전송"은 실제로 델타 파일 생성 시각이다.
//
// variant="glass"(2026-09-12·5차, R6 재지적): 카메라 밴드 한정 유리화(옵션 B)가 인접 패널과
// 이질감을 만든다는 지적으로 홈의 모든 패널을 유리화하는 쪽으로 바뀌었다 — 이 패널은 카메라
// 밴드(y<873px) 밖(top≈1081px)이라 뒤에 비칠 지형은 없지만, 사용자가 요구한 건 "카메라
// 노출 여부와 무관한 전면 통일"이라 예외를 두지 않는다 — ReleaseNoteStream.tsx 주석 참고.

import Link from "next/link";
import { fmtKst } from "@/lib/format";
import SectionCard from "@/components/SectionCard";

export interface DiscordPanelProps {
  /** deltas.meta.generatedAt(ISO) — "마지막 전송 시각"이 아니라 이 델타 파일이 마지막으로
   * 생성된 시각을 대신 표기한다(ST-11 프롬프트: "마지막 전송 시각은 deltas.meta.generatedAt
   * 표기"). 파일이 없으면 캡션 자체를 생략한다. */
  generatedAt: string | null;
}

export default function DiscordPanel({ generatedAt }: DiscordPanelProps) {
  return (
    <SectionCard title="디스코드로 공유" variant="glass">
      <div className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-muted">
          미공지 상위 항목과 이상 관측을 요약해 배치가 서버로 방송합니다.
        </p>
        <Link
          href="/methodology/#discord"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-accent-on transition-colors hover:bg-accent-hover"
        >
          방송 규칙 보기 →
        </Link>
        {generatedAt ? (
          <span className="text-xs text-muted">마지막 집계 {fmtKst(generatedAt)}</span>
        ) : null}
      </div>
    </SectionCard>
  );
}
