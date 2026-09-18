// src/app/methodology/page.tsx
// 방법론/About(ST-12) — 파이프라인 4단·상태 정의·통계 게이트(id="gates")·라이엇 고지
// (UX-BRIEF §3 "04 방법론/About", 프로토타입 `docs/design/prototype/04-methodology.html`).
// 헤더는 ST-10부터 src/app/layout.tsx가 전역 렌더한다(여기서 다시 렌더하면 중복).
//
// 편차: 프로토타입 04는 id="gates"를 "데이터 파이프라인" 패널(가장 위)에 붙였지만, ST-12 지시
// 원문은 "③ 통계 게이트 카드 ... id="gates""로 명시한다 — "판정 규칙 보기 →"(항목 상세)가
// 실제로 원하는 앵커는 게이트 설명 쪽이 자연스러워 프로토타입의 배치를 오타/템플릿 잔재로 보고
// 지시 원문을 따랐다(ST-12.md 기록).
//
// "디스코드 미리보기"(id="discord") 섹션은 2026-09-14 사용자 지시로 제거했다 — 이 페이지의
// 유일한 소비처였던 `DiscordEmbedPreview.tsx`/`discordPreview.ts`(+각 테스트)도 죽은 코드로
// 남기지 않고 함께 삭제(실제 디스코드 발송 파이프라인 `pipeline/discord/webhook.ts`는 이
// 미리보기 UI와 무관한 별도 모듈이라 영향 없음). 제거 후 "통계 게이트"(좌)와 "고지"(우)만
// 남은 2컬럼 그리드에서 `items-start`(양쪽 카드가 각자 콘텐츠 높이만큼만 차지)를 제거해
// 두 카드 높이를 맞췄다 — 기본 grid는 `align-items: stretch`라 행 높이가 더 긴 카드에 맞춰
// 짧은 카드도 늘어난다. `SectionCard`에 `h-full flex flex-col`을 얹고, 늘어난 여백을 받을
// 본문 래퍼에 `flex-1`을 줘 "고지" 카드의 짧은 텍스트가 카드 하단에 눌리지 않고 자연스럽게
// 채워지도록 했다(children 자체는 SectionCard가 감싸지 않으므로 각 소비처가 이 규약을 따름).

import { isSignificantDelta } from "@/pipeline/shared/significance";
import fs from "node:fs";
import path from "node:path";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import { getDefaultPair, loadDeltas, loadNotes, loadSummary } from "@/lib/data";
import { fmtKst } from "@/lib/format";
import { EFFECT_SIZE_FLOORS, FDR_ALPHA, WIN_RATE_MIN_N } from "@/pipeline/aggregate/stats";
import { countRelevantNoteEntities } from "@/pipeline/shared/notes-count";
import AdapterMatrix from "@/components/methodology/AdapterMatrix";
import GateGrid from "@/components/methodology/GateGrid";
import PipelineDiagram from "@/components/methodology/PipelineDiagram";
import StatusDefinitionTable from "@/components/methodology/StatusDefinitionTable";
import { buildPipelineSteps } from "@/components/methodology/pipelineSteps";

/** data/ddragon/{version}/ 디렉토리 이름(내림차순 최신)에서 Data Dragon 버전을 읽는다.
 * data.ts 미소유라 같은 "로컬 레이아웃 재구현" 관례(ST-06/ST-10 선례)를 따른다. 디렉토리가
 * 없으면(빈 빌드) null. */
function latestDdragonVersion(dataRoot: string = path.resolve(process.cwd(), "data")): string | null {
  const dir = path.join(dataRoot, "ddragon");
  if (!fs.existsSync(dir)) return null;
  const versions = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (versions.length === 0) return null;
  versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  return versions[0];
}

export default function MethodologyPage() {
  const pair = getDefaultPair();

  const summaryFrom = pair ? loadSummary(pair.from) : null;
  const summaryTo = pair ? loadSummary(pair.to) : null;
  const notes = pair ? loadNotes(pair.to) : null;
  const deltas = pair ? loadDeltas(pair.from, pair.to) : null;
  const ddragonVersion = latestDdragonVersion();

  // 2026-09-18(채점 라운드1 ST-5): 홈 타일 "유의 변화"와 **같은 술어**를 쓴다. 이전엔 여기만
  // `q<α` 단독이라 홈 403 vs 방법론 410으로 두 페이지가 서로를 반박했다(표본 부족 7행이 q는
  // 통과하지만 승률 게이트에서 제외되는 차이).
  const significantCount = deltas
    ? deltas.rows.filter((row) => isSignificantDelta(row, deltas.meta.qAlpha ?? FDR_ALPHA)).length
    : null;

  const steps = buildPipelineSteps({
    from: pair?.from ?? null,
    to: pair?.to ?? null,
    matchesFrom: summaryFrom?.data.matches ?? null,
    matchesTo: summaryTo?.data.matches ?? null,
    collectedAt: summaryTo?.meta.generatedAt ?? null,
    // 코디네이터 정정(2026-09-05): 홈 헤드라인("패치노트는 N개 엔티티를 말했고")과 동일 기준
    // (champion/item 섹션 고유 엔티티 수)으로 세야 두 화면의 숫자가 일치한다 — 원문 항목 수
    // (`meta.itemCount`)는 참고용으로만 병기한다.
    noteEntityCount: notes ? countRelevantNoteEntities(notes.items) : null,
    noteItemCount: notes?.meta.itemCount ?? null,
    notesFetchedAt: notes?.meta.fetchedAt ?? null,
    matchedAt: deltas?.meta.generatedAt ?? null,
    significantCount,
    judgedAt: deltas?.meta.generatedAt ?? null,
  });

  // 전 패널 유리화(2026-09-12·5차, R6 사용자 재지적 — "방법론 메뉴에 모든 섹션 전부 불투명
  // 판넬 그대로") — 이 페이지도 layout.tsx의 전역 앰비언트 배경을 받지만 첫 패널이 top≈89px
  // (헤더 바로 아래)부터 카메라 노출 밴드 전체를 불투명으로 덮고 있었다. 홈·`/compare/`와
  // 동일 근거로 6개 SectionCard 전부 `variant="glass"`.
  //
  // 2026-09-13(7차, R8 — 배치안 아티팩트 A안 "+120px", 홈 page.tsx와 동일 결정을 전 메뉴에
  // 적용): 상단 패딩만 기존 32px에서 120px 더한 값으로 분리, 하단 여백은 그대로 유지. 이
  // 페이지는 헤드라인 없이 패널이 바로 첫 블록이라 패널 자체가 120px 내려가는 것으로 홈의
  // "블록 전체가 같이 내려가야" 요구를 동일하게 만족한다.
  return (
    <div className="flex flex-1 flex-col">
      <main>
        <Container className="flex flex-col gap-6 pt-[152px] pb-8"> {/* design-lint-ignore: PLAN-deployed-ui-fix-2026-09-12.md R8 — 사용자 확정 +120px, 대응 토큰 없는 페이지별 배치 수치 */}
          <SectionCard eyebrow="신뢰" title="데이터 파이프라인" variant="glass">
            <PipelineDiagram steps={steps} />
          </SectionCard>

          <SectionCard eyebrow="해석" title="상태 정의" variant="glass">
            <StatusDefinitionTable
              minN={WIN_RATE_MIN_N}
              alpha={FDR_ALPHA}
              floors={EFFECT_SIZE_FLOORS}
            />
          </SectionCard>

          {/* 확장성의 증명 — HANDOFF-redesign-2026-09-10.md §4-4. 셀렉터가 아니라 어댑터
              매핑표로 "다른 게임에도 같은 판정 엔진을 쓸 수 있다"를 보인다. */}
          <SectionCard eyebrow="확장성" title="어댑터 매핑표 (LoL ↔ PUBG)" variant="glass">
            <AdapterMatrix />
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            <div id="gates">
              <SectionCard eyebrow="투명성" title="통계 게이트" variant="glass" className="flex h-full flex-col">
                <div className="flex flex-1 flex-col">
                  <GateGrid minN={WIN_RATE_MIN_N} alpha={FDR_ALPHA} />
                </div>
              </SectionCard>
            </div>

            <aside>
              <SectionCard title="고지" variant="glass" className="flex h-full flex-col">
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <p className="text-xs leading-relaxed text-muted">
                    patchgap isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views
                    or opinions of Riot Games or anyone officially involved in producing or
                    managing Riot Games properties. Riot Games, and all associated properties are
                    trademarks or registered trademarks of Riot Games, Inc.
                  </p>
                  <p className="text-xs text-muted">
                    데이터 출처: Riot Games Match-V5 · Timeline API
                    {ddragonVersion ? `, Data Dragon ${ddragonVersion}` : ""}, KR 서버, Master+
                    티어
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="h-2 w-2 rounded-pill bg-success" aria-hidden="true" />
                    정상 운영 · 빌드 {fmtKst(new Date().toISOString())}
                  </div>
                </div>
              </SectionCard>
            </aside>
          </div>
        </Container>
      </main>
    </div>
  );
}
