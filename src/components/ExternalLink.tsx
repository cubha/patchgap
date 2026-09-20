// src/components/ExternalLink.tsx
// 사이트 **밖으로** 나가는 링크의 단일 소유자 — 새 창 + `rel` 보호를 한 곳에서만 붙인다.
//
// **왜 컴포넌트로 빼는가**(2026-09-20, 사용자 재지적): 라운드6(`a669fb2`)에서 "패치노트 원문은
// 새 창으로 열어 달라"를 받아 `NoteContrastPanel`·`ReleaseNoteRow`·PUBG 두 화면에는 붙였는데,
// **같은 항목 상세 화면에 나란히 있는 `CausesPanel`이 빠졌다**. 그래서 추정 원인(LLM)의 인용
// 링크만 같은 탭으로 나가 버렸고 사용자는 "patchgap 다시 접근하려면 번거롭다"를 다시 말해야 했다.
// 원인은 판단 착오가 아니라 **규칙이 다섯 군데로 복제돼 있었다는 것**이다 — 이 프로젝트가
// `reportable.ts`·`headline.ts`·`panelSurface.ts`에서 반복해 고쳐 온 결함군과 같은 모양이라
// 같은 처방을 쓴다: 소비처가 이 컴포넌트를 부르는 것 말고는 외부 링크를 만들 방법이 없게 한다.
//
// 강제는 산문이 아니라 게이트가 한다 — `verify.sh` Spec 규칙이 이 파일 밖의 `target="_blank"`를
// 잡는다(PUBG 무기 키 정준화 우회 금지 규칙과 같은 자리·같은 모양).
//
// `rel`은 `noopener noreferrer`다. 현대 브라우저에서 `noreferrer`가 `noopener`를 함의하지만,
// 보호 의도를 읽는 사람에게 드러내는 값이 더 크다(기존 소비처 중 DiscordPanel이 이미 이 값이었다).

import type { ReactNode } from "react";

export interface ExternalLinkProps {
  /** 외부 절대 URL. 내부 경로는 `next/link`를 쓴다 — 새 창으로 열 이유가 없다. */
  href: string;
  className?: string;
  children: ReactNode;
}

export default function ExternalLink({ href, className, children }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
