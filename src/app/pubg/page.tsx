// src/app/pubg/page.tsx
// PUBG 브리핑 홈. 본문은 `components/pubg/PubgBriefing.tsx`에 있다(2026-10-06 — LoL·TFT와 같은 구조). 로드만 여기서 한다.
import type { Metadata } from "next";
import PubgBriefing from "@/components/pubg/PubgBriefing";
import { loadPubg, loadPubgDeclaration, newerPubgDeclaration, pubgPair } from "@/lib/pubgData";

// 패치 번호는 산출물에서 읽는다(`pubgPair`) — 하드코딩하면 다음 패치에서 설명문만 옛 패치를 말한다.
const PAIR = pubgPair();

export const metadata: Metadata = {
  // 패치쌍은 헤더 셀렉터가 말한다 — 탭 제목에서도 뺀다(2026-09-21, TFT와 같은 형식).
  title: "배틀그라운드 — patchgap",
  description: `PUBG: BATTLEGROUNDS ${PAIR ? `${PAIR.to} ` : ""}패치노트의 공지와 실제 관측 데이터를 대조합니다.`,
};

export default function PubgPage() {
  const bundle = loadPubg();
  // 홈 = 관측 쌍(PLAN-home-observed-pair). 더 새 패치노트(stub)는 배너로, 관측이 없을 때만 선언 뷰가 홈이다(C13·C14).
  return <PubgBriefing bundle={bundle} declaration={bundle ? null : loadPubgDeclaration()} newer={bundle ? newerPubgDeclaration() : null} />;
}
