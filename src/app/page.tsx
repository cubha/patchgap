// src/app/page.tsx
// 브리핑 홈 — 프로토타입 01(docs/design/prototype/01-briefing-home.html) 구현. F5/ST-11.
// 헤더는 ST-10부터 src/app/layout.tsx가 전역 렌더한다(여기서 다시 렌더하면 중복).
// 데이터 로드는 이 서버 컴포넌트에서만 한다(src/lib/data.ts, 빌드 타임 fs) — 하위 home/*
// 컴포넌트는 전부 props만 받는 순수 렌더(상태 없음, 서버/클라이언트 경계 없음).

import type { DeltaRecord } from "@/pipeline/types";
import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import Container from "@/components/Container";
import HeroSummary from "@/components/home/HeroSummary";
import IntroReplayButton from "@/components/IntroReplayButton";
import ReleaseNoteStream, { type ReleaseStreamEntry } from "@/components/home/ReleaseNoteStream";
import StreamLaneFilter from "@/components/home/StreamLaneFilter";
import SideMatchAverages from "@/components/home/SideMatchAverages";
import DiscordPanel from "@/components/home/DiscordPanel";
import LaneGapPanel from "@/components/home/LaneGapPanel";
import StreamColumnLayout from "@/components/home/StreamColumnLayout";
import IndirectEffectPanel from "@/components/home/IndirectEffectPanel";
import { computeHeadline } from "@/components/home/logic";
import { selectIndirectEffects } from "@/components/home/indirectEffects";
import { computeLaneDistribution } from "@/components/home/laneDistribution";
import { buildReleaseStream } from "@/components/home/releaseStream";
import { resolveStreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { lanesForEntityKey } from "@/lib/lane";
import {
  getDefaultPair,
  loadDeltas,
  loadNotes,
  loadObjectives,
  loadSpellIcons,
  loadSummary,
} from "@/lib/data";

export default function Home() {
  const pair = getDefaultPair();

  const deltas = pair ? loadDeltas(pair.from, pair.to) : null;
  const notesTo = pair ? loadNotes(pair.to) : null;
  const summaryTo = pair ? loadSummary(pair.to) : null;
  const summaryFrom = pair ? loadSummary(pair.from) : null;
  const objectivesTo = pair ? loadObjectives(pair.to) : null;
  const objectivesFrom = pair ? loadObjectives(pair.from) : null;
  const spellIcons = loadSpellIcons();
  const ddragon = loadDdragonSafe();

  const headline = computeHeadline(deltas, notesTo, deltas?.meta.qAlpha);

  const streamGroups = buildReleaseStream(notesTo, deltas);
  const streamEntries: ReleaseStreamEntry[] = streamGroups.map((group) => {
    const icon = resolveStreamEntityIcon(group, ddragon);
    const lanes = icon.entityKey ? lanesForEntityKey(deltas?.rows ?? [], icon.entityKey) : [];
    return { group, icon, lanes };
  });

  // note.id → 그 노트를 근거로 매칭된 델타. 스트림 카드가 뱃지(status)뿐 아니라 관측 수치
  // (.rn-obs)와 판정 문장(.verdict .m)까지 그리므로 status가 아니라 레코드 전체를 넘긴다.
  const noteDeltas: Record<string, DeltaRecord> = {};
  for (const row of deltas?.rows ?? []) {
    for (const noteId of row.matchedNoteIds) noteDeltas[noteId] = row;
  }

  const unannouncedRows = (deltas?.rows ?? []).filter((row) => row.status === "unannounced");
  const laneDistribution = computeLaneDistribution(unannouncedRows);

  // 간접 영향(ST-IE7) — 릴리즈 스트림에는 넣지 않고(옵션 B) 하단 전용 섹션에서 인과 체인으로
  // 노출한다. 선택·해석은 indirectEffects.ts가 끝낸다.
  const indirectEffects = selectIndirectEffects(deltas, notesTo);

  return (
    <div className="flex flex-1 flex-col">
      {/* 크롬(패치 쌍·고정 표본·n/집계 캡션)은 2026-09-12(3차)부터 layout.tsx의 Header가
          1줄로 통합해 그린다 — 이 페이지가 별도로 FilterBar를 렌더하지 않는다. */}
      <main className="flex-1">
        {/* 2026-09-12(5차, R6): pt-8→pt-14 — 사용자 지적("모든 섹션판넬이 화면 상단에 너무가까워서
            BG를 가리니까")에 대한 배치 조정. HeroSummary.tsx의 gap-5→gap-8과 합쳐 최초 불투명
            패널(릴리즈노트 스트림) 등장을 늦춰 앰비언트 배경의 상단 밴드가 더 오래 노출되게 한다.
            pb-8은 그대로 유지(하단은 지적 대상이 아니었음 — Container className="width" prop과
            같은 선례로 pt/pb를 분리).

            2026-09-13(7차, R8 — 배치안 아티팩트 A안, 사용자 확정 "+120px"): pt-14(56px)→
            pt-44(176px, +120px). 처음엔 패널에만 marginTop을 줘 "헤드라인은 그대로, 패널만
            아래로" 였는데, 사용자가 "히어로 영역 텍스트도 똑같이 내려와야" — 즉 헤드라인+패널을
            한 블록으로 같이 내리는 쪽을 원했다. Container 최상단 패딩을 올리면 이 블록 전체가
            같이 내려가므로 그 요구를 그대로 만족한다. 176px은 Tailwind 표준 스케일(11rem)이라
            arbitrary 불필요. */}
        <Container className="flex flex-col gap-6 pt-44 pb-8">
          <HeroSummary stats={headline} action={<IntroReplayButton label="인트로 재생" />} />
          <StreamColumnLayout
            leftHeader={<StreamLaneFilter />}
            left={
              <ReleaseNoteStream
                entries={streamEntries}
                spellIcons={spellIcons?.icons ?? null}
                noteDeltas={noteDeltas}
                patch={pair?.to ?? null}
                qAlpha={deltas?.meta.qAlpha}
                contentCount={headline.noteItemCount}
                gapCount={headline.unannouncedCount}
              />
            }
            right={
              <>
                <SideMatchAverages
                  summaryTo={summaryTo?.data ?? null}
                  summaryFrom={summaryFrom?.data ?? null}
                  objectivesTo={objectivesTo?.data ?? null}
                  objectivesFrom={objectivesFrom?.data ?? null}
                />
                <LaneGapPanel rows={laneDistribution} />
                <DiscordPanel generatedAt={deltas?.meta.generatedAt ?? null} />
              </>
            }
          />
          <IndirectEffectPanel entries={indirectEffects} />
        </Container>
      </main>
    </div>
  );
}
