// src/app/page.tsx
// 브리핑 홈 — 프로토타입 01(docs/design/prototype/01-briefing-home.html) 구현. F5/ST-11.
// 헤더는 ST-10부터 src/app/layout.tsx가 전역 렌더한다(여기서 다시 렌더하면 중복).
// 데이터 로드는 이 서버 컴포넌트에서만 한다(src/lib/data.ts, 빌드 타임 fs) — 하위 home/*
// 컴포넌트는 전부 props만 받는 순수 렌더(상태 없음, 서버/클라이언트 경계 없음).

import type { DeltaRecord } from "@/pipeline/types";
import { loadDdragonSafe } from "@/pipeline/match/ddragon";
import Container from "@/components/Container";
import HeroSummary from "@/components/home/HeroSummary";
import ReleaseNoteStream, { type ReleaseStreamEntry } from "@/components/home/ReleaseNoteStream";
import StreamLaneFilter from "@/components/home/StreamLaneFilter";
import SideMatchAverages from "@/components/home/SideMatchAverages";
import DiscordPanel from "@/components/home/DiscordPanel";
import LaneGapPanel from "@/components/home/LaneGapPanel";
import StreamColumnLayout from "@/components/home/StreamColumnLayout";
import SubmarineSection from "@/components/gamedata/SubmarineSection";
import { gameDataEntityCount, loadGameDataDiff, summarizeGameData } from "@/lib/gamedata";
import type { CosmeticSkinItem } from "@/components/home/CosmeticSkinPreview";
import { computeHeadline, isGapStatus } from "@/components/home/logic";
import { isCosmeticNote } from "@/pipeline/shared/cosmetic-note";
import { matchSkinsInSummary, skinSplashPath } from "@/pipeline/shared/cosmetic-skin";
import { indexIndirectCauses } from "@/components/home/indirectEffects";
import { computeLaneDistribution } from "@/components/home/laneDistribution";
import {
  buildReleaseStream,
  contentTier,
  sortMatchedGroups,
  type MatchedStreamGroup,
  type ReleaseStreamGroup,
} from "@/components/home/releaseStream";
import { isSectionBundle } from "@/components/home/sectionBundle";
import { buildMiscSections } from "@/components/home/miscSections";
import { isExcludedNote, isModeSectionNote } from "@/pipeline/shared/excluded-notes";
import type { StreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { indexNoteDeltas, indexNoteDeltaRows } from "@/components/home/noteDeltaIndex";
import { resolveStreamEntityIcon } from "@/components/home/releaseStreamEntity";
import { lanesForEntityKey } from "@/lib/lane";
import {
  getDefaultPair,
  listAvailableSplashes,
  loadDeltas,
  loadNotes,
  loadObjectives,
  loadSkinIndex,
  loadSpellIcons,
  loadSummary,
} from "@/lib/data";

export default function Home() {
  const pair = getDefaultPair();

  const deltas = pair ? loadDeltas(pair.from, pair.to) : null;
  // 잠수함 패치(F9) — 판정 산출물과 별도 파일이고, 없으면 섹션이 통째로 빠진다.
  const submarine = pair ? summarizeGameData(loadGameDataDiff("lol", pair.from, pair.to)) : null;
  const notesTo = pair ? loadNotes(pair.to) : null;
  const summaryTo = pair ? loadSummary(pair.to) : null;
  const summaryFrom = pair ? loadSummary(pair.from) : null;
  const objectivesTo = pair ? loadObjectives(pair.to) : null;
  const objectivesFrom = pair ? loadObjectives(pair.from) : null;
  const spellIcons = loadSpellIcons();
  const ddragon = loadDdragonSafe();

  const headline = computeHeadline(deltas, notesTo, deltas?.meta.qAlpha);

  // 2026-09-18(ST-8): 공지 그룹은 3티어(불일치 → 일치 → 관측 없음 → 치장)로, Gap 그룹은 그대로.
  // note.id → 그 노트를 근거로 매칭된 델타. 스트림 카드가 뱃지(status)뿐 아니라 관측 수치
  // (.rn-obs)와 판정 문장(.verdict .m)까지 그리므로 status가 아니라 레코드 전체를 넘긴다.
  // 2026-09-18(라운드3 G1): last-wins → best-row. 선택 규칙은 noteDeltaIndex.ts 한 곳.
  const noteDeltas: Record<string, DeltaRecord> = indexNoteDeltas(deltas?.rows ?? [], deltas?.meta.qAlpha);
  // S4 후속 — 카드 헤더의 **사유 계산**은 대표 1행이 아니라 짝 전수를 봐야 한다(noteDeltaIndex 주석).
  const noteDeltaRows: Record<string, DeltaRecord[]> = indexNoteDeltaRows(deltas?.rows ?? []);

  // 2026-09-18 라운드6(L1): 의회 투표 결과 묶음은 스트림에서 뺀다 — 엔티티 수(`countRelevantNoteEntities`)도
  // 같은 술어(excluded-notes.ts)로 세므로 히어로·탭 배지·카드 수가 같은 집합을 본다.
  const rawGroups = buildReleaseStream(notesTo, deltas).filter(
    (group) => group.kind !== "matched" || !group.notes.every(isExcludedNote)
  );
  // 아이콘 해석은 정렬 **앞**에서 한 번 — 섹션 묶음 판별이 그 결과를 쓰고, 정렬도 같은 집합을 봐야
  // 카드 위계와 자리가 어긋나지 않는다.
  const icons = new Map<ReleaseStreamGroup, StreamEntityIcon>(
    rawGroups.map((group) => [group, resolveStreamEntityIcon(group, ddragon)])
  );
  const matchedGroups = rawGroups.filter((g): g is MatchedStreamGroup => g.kind === "matched");
  const sectionBundles = new Set(
    matchedGroups
      .filter((group) => isSectionBundle(group, icons.get(group)!, noteDeltaRows))
      .map((group) => group.entity)
  );
  const sortedMatched = sortMatchedGroups(matchedGroups, deltas, deltas?.meta.qAlpha, sectionBundles);
  // 2026-09-18 라운드6(L2): tier 3(섹션 묶음)·tier 4(치장)는 카드가 아니라 목록 끝 "기타 변경" 1블록으로
  // 모은다(miscSections.ts). tier 0~2(챔피언·아이템 밸런스 줄)는 카드 그대로 — 패치 내용은 누락하지 않는다.
  // 게임 모드 섹션 묶음(클래식 "피오라" 65줄)은 관측이 짝지어져 있어도 카드가 아니라 기타 변경이다 —
  // SR 챔피언 공지가 아니다(라운드6 재판정 보완 1, excluded-notes.ts).
  const isModeGroup = (group: MatchedStreamGroup) => group.notes.every(isModeSectionNote);
  const tierOf = (group: MatchedStreamGroup) => contentTier(group, noteDeltas, deltas?.meta.qAlpha, sectionBundles);
  const cardGroups = sortedMatched.filter((group) => tierOf(group) <= 2 && !isModeGroup(group));
  const miscSections = buildMiscSections(sortedMatched.filter((group) => tierOf(group) >= 3 || isModeGroup(group)));
  const streamGroups = [...cardGroups, ...rawGroups.filter((g) => g.kind !== "matched")];
  const streamEntries: ReleaseStreamEntry[] = streamGroups.map((group) => {
    const icon = icons.get(group)!;
    const lanes = icon.entityKey ? lanesForEntityKey(deltas?.rows ?? [], icon.entityKey) : [];
    const tier = group.kind === "matched" ? tierOf(group) : undefined;
    return { group, icon, lanes, tier };
  });
  // 탭 배지 = 화면에 실제로 실리는 줄 수(카드 줄 + 기타 변경 줄). 이전엔 `meta.itemCount`(181)였는데
  // 의회 34줄을 뺀 지금은 그 숫자가 화면과 어긋난다.
  const contentLineCount =
    cardGroups.reduce((sum, group) => sum + group.notes.length, 0) +
    miscSections.reduce((sum, section) => sum + section.notes.length, 0);

  // Gap 정의는 한 곳(`isGapStatus`)만 본다 — 라인 분포 패널이 히어로 타일·탭 배지와 다른
  // 모수를 쓰면 화면이 스스로를 반박한다(2026-09-17 B2 통합).
  const unannouncedRows = (deltas?.rows ?? []).filter((row) => isGapStatus(row.status));
  const laneDistribution = computeLaneDistribution(unannouncedRows);

  // 간접 영향(2026-09-17, B2) — 하단 전용 섹션을 없애고 **Gap 탭 안**에서 인과 체인으로 그린다.
  // 사용자 지적: "미공지 Gap 탭의 데이터와 노트에 없는 파급효과/간접 영향 섹션의 데이터가
  // 동일한 목적으로 보이는데 다른영역에 별도로 표기되니 혼돈됨". 판별 결과 실제로 같은
  // 뿌리였다(indirect-effect는 unannounced의 재분류) — 근거는 PLAN-gap-display-unify §3.
  const indirectCauses = indexIndirectCauses(deltas, notesTo);

  // 치장 스킨 미리보기(ST-B6, 2026-09-18) — note.id → 스플래시 목록.
  // **자산이 실제로 존재하는 것만** 넣는다: Data Dragon은 크로마를 스킨 목록에 넣어 두면서도
  // 스플래시 파일은 배포하지 않아(26.18 크로마 줄 5건 전부 404) 인덱스만 믿으면 깨진 이미지가
  // 나간다. 정적 export라 파일 유무를 빌드 타임에 확정할 수 있고, 그래서 클라이언트 onError
  // 핸들러 없이 서버 컴포넌트 경계를 유지한다.
  const skinIndex = loadSkinIndex();
  const availableSplashes = listAvailableSplashes();
  const skinPreviews: Record<string, CosmeticSkinItem[]> = {};
  for (const note of notesTo?.items ?? []) {
    if (!isCosmeticNote(note)) continue;
    const items = matchSkinsInSummary(note.summary, skinIndex?.skins ?? [])
      .filter((skin) => availableSplashes.has(`${skin.championId}_${skin.num}.jpg`))
      .map((skin) => ({ name: skin.name, src: skinSplashPath(skin) }));
    if (items.length > 0) skinPreviews[note.id] = items;
  }

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
          <HeroSummary stats={headline} />
          <StreamColumnLayout
            leftHeader={<StreamLaneFilter />}
            left={
              <ReleaseNoteStream
                entries={streamEntries}
                spellIcons={spellIcons?.icons ?? null}
                noteDeltas={noteDeltas}
                noteDeltaRows={noteDeltaRows}
                patch={pair?.to ?? null}
                qAlpha={deltas?.meta.qAlpha}
                contentCount={contentLineCount}
                gapCount={headline.unannouncedCount + gameDataEntityCount(submarine)}
                causes={indirectCauses}
                skinPreviews={skinPreviews}
                miscSections={miscSections}
                /* 수치 축(2026-09-21) — 미공지 Gap 탭의 **위쪽 갈래**. 세 번째 탭이 아닌
                   이유는 잠수함도 미공지이기 때문이다(잠수함 > 미공지 위계를 같은 탭 안에서
                   위아래로 표현한다). 산출물이 없는 쌍에서는 통째로 빠진다.
                   상세 링크를 걸지 않는 이유: LoL 잠수함 전용 엔티티(폭풍갈퀴)는 델타가
                   0건이라 `/lol/item/[id]` 라우트가 없다 — 없는 링크를 만들지 않는다. */
                gapLead={submarine ? <SubmarineSection summary={submarine} /> : undefined}
                gameDataCount={gameDataEntityCount(submarine)}
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

        </Container>
      </main>
    </div>
  );
}
