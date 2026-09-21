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

import { isReportableRecord } from "@/pipeline/shared/reportable";
import fs from "node:fs";
import path from "node:path";
import Container from "@/components/Container";
import SectionCard from "@/components/SectionCard";
import { computeLlmCauseStats, dominantConfidence } from "@/components/methodology/llmStats";
import { getDefaultPair, loadDeltas, loadNotes, loadSummary } from "@/lib/data";
import { fmtKst } from "@/lib/format";
import { EFFECT_SIZE_FLOORS, FDR_ALPHA, WIN_RATE_MIN_N } from "@/pipeline/aggregate/stats";
import { countRelevantNoteEntities } from "@/pipeline/shared/notes-count";
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

  // 2026-09-18(채점 라운드1 ST-5): 홈 타일 "유의한 관측"과 **같은 술어**를 쓴다. 이전엔 여기만
  // `q<α` 단독이라 홈 403 vs 방법론 410으로 두 페이지가 서로를 반박했다(표본 부족 7행이 q는
  // 통과하지만 승률 게이트에서 제외되는 차이).
  // 2026-09-19: 홈이 `isSignificantDelta` → `isReportableRecord`로 바뀌었으므로 여기도 같이
  // 옮긴다(효과크기 바닥 미달을 세지 않는다). 한쪽만 고치면 같은 결함이 반대 방향으로 재발한다.
  // 추정 원인 카드의 수치 — 리터럴로 적으면 재생성에 뒤처져 화면이 거짓을 말한다(독립 채점 K2-7).
  const llmStats = deltas ? computeLlmCauseStats(deltas.rows) : null;
  const dominant = llmStats ? dominantConfidence(llmStats) : null;

  const significantCount = deltas
    ? deltas.rows.filter((row) => isReportableRecord(row, deltas.meta.qAlpha ?? FDR_ALPHA)).length
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

          {/* 표시 규칙(2026-09-18 라운드6, 사용자 C3) — 각 메뉴에 흩어져 있던 "왜 이렇게 보이나"를 여기 모았다.
              브리핑·대조표·상세는 결과만 말하고, 그 결과가 어떻게 골라졌는지는 이 카드가 말한다. */}
          <SectionCard eyebrow="표시 규칙" title="화면이 고르는 것" variant="glass">
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 text-sm md:grid-cols-2">
              <div>
                <dt className="font-display font-bold text-fg">브리핑 — 패치 내용 탭</dt>
                <dd className="mt-1 leading-relaxed text-fg-2">
                  챔피언·아이템 카드는 관측이 있는 항목부터(공지 · 이상 관측 → 공지 → 유의한 관측 없음), 같은 묶음 안에서는
                  패치노트 순서. 유의한 관측이 없는 카드는 연속 구간을 1행으로 접습니다. 버그 수정·편의성 개선·신규
                  스킨·증강은 목록 끝 &ldquo;기타 변경&rdquo; 1블록에 카테고리별로 모으고 배지를 달지 않습니다. 커뮤니티
                  투표 결과 묶음은 패치 내용이 아니라 싣지 않습니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">브리핑 — 미공지 Gap 탭</dt>
                <dd className="mt-1 leading-relaxed text-fg-2">
                  패치노트에 없는 유의 변화를 |Δ| 큰 순으로. 원인은 LLM이 노트 조항을 인용해 추정하되, 인용이 실재하고
                  신뢰도가 보통 이상일 때만 본문색으로 씁니다. 나머지는 회색(가능성 · 후보 미검증 · 원인 미검토 · 설명 후보
                  없음)입니다.
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">대조표</dt>
                <dd className="mt-1 leading-relaxed text-fg-2">
                  행은 챔피언·아이템 1개씩이고 셀은 밴률·승률·픽률·채택률 중 유의하고 바닥을 넘는 지표만 채웁니다. 유의한
                  관측이 없는 엔티티는 표에 없고, 라인 골드·오브젝트·경기 시간은 홈 사이드 &ldquo;매치 평균&rdquo;에서만
                  봅니다. 전체 보기는 챔피언 전체 행을 우선하되 그 지표가 특정 라인에서만 유의하면 그 라인 행이 셀을
                  대표하고 라인을 표기합니다. 라인을 고르면 그 라인의 픽률·승률만 봅니다(밴은 라인 무관).
                </dd>
              </div>
              <div>
                <dt className="font-display font-bold text-fg">항목 상세</dt>
                <dd className="mt-1 leading-relaxed text-fg-2">
                  패치노트 대조와 추정 원인이 맨 위, 전/후 관측값이 가운데, 통계 게이트와 원천 매치가 맨 아래입니다.
                  추정 원인은 검증·신뢰도 순(높음 → 보통 → 낮음 → 인용 없음)입니다.
                </dd>
              </div>
            </dl>
          </SectionCard>

          {/* 추정 원인의 판정 기준(2026-09-19 사용자 질문: "원인후보 없음 항목이 대다수인거같은데
              LLM 판정기준이 어떻게되고 어떤 기준으로 분석하여 판정하는지?"). 화면 곳곳이 LLM 문장을
              쓰면서 그 규칙은 코드에만 있었다 — 방법론에 총망라한다는 원칙(공통3)대로 여기 적는다. */}
          <SectionCard eyebrow="추정 원인" title="LLM은 무엇을 보고 판정하나" variant="glass">
            <div className="flex flex-col gap-4 p-5 text-sm leading-relaxed text-fg-2">
              <p>
                패치노트와 짝지어지지 않았거나 노트와 방향이 어긋난 관측에 한해, 언어 모델이 <strong className="text-fg">다른
                항목의 파급 효과</strong>를 추정합니다. 직접 변경(그 챔피언·아이템 자신의 노트)은 앞 단계인 결정론 매칭이
                이미 처리하므로 후보에서 제외됩니다 — 그래서 모델이 찾는 것은 처음부터 간접 원인뿐입니다.
              </p>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
                <div>
                  <dt className="font-display font-bold text-fg">무엇을 대상으로 하나</dt>
                  <dd className="mt-1">
                    판정이 &ldquo;미공지&rdquo; 또는 &ldquo;공지 · 이상 관측&rdquo;인 관측만, 중요도 상위 120건입니다
                    (상태 우선순위 → 변화폭 내림차순). 나머지는 아예 묻지 않습니다.
                  </dd>
                </div>
                <div>
                  <dt className="font-display font-bold text-fg">무엇을 보여주나</dt>
                  <dd className="mt-1">
                    그 패치 노트 전체를 항목 id · 엔티티 · 스킬 · 변경 전/후 값 · 방향 · 섹션만 남긴 목록으로 줍니다.
                    본문 산문이 아니라 구조화된 목록이라, 모델이 인용할 수 있는 것은 실재하는 항목뿐입니다.
                  </dd>
                </div>
                <div>
                  <dt className="font-display font-bold text-fg">기각 규칙(기계가 검사)</dt>
                  <dd className="mt-1">
                    인용한 id가 목록에 없으면 기각합니다. 그 관측의 엔티티 자신을 가리키면 기각합니다. 다른 게임
                    모드(LoL 클래식 · 아수라장 · 아레나)의 항목이면 기각합니다 — 우리가 재는 것은 소환사의 협곡이기
                    때문입니다. 기각된 문장은 링크 없이 회색으로만 남습니다.
                  </dd>
                </div>
                <div>
                  <dt className="font-display font-bold text-fg">왜 &ldquo;후보 없음&rdquo;이 많나</dt>
                  <dd className="mt-1">
                    관측 변화의 상당수는 패치가 아니라 메타 이동·표본 구성 변화에서 옵니다. 그럴듯한 조항이 없을 때
                    지어내지 않는 것이 이 사이트의 규칙이라, 그런 경우는 &ldquo;설명할 조항을 찾지 못했습니다&rdquo;로
                    끝냅니다.{" "}
                    {llmStats ? (
                      <>
                        실측({pair?.to ?? "최근 패치"}): 대상 {llmStats.attempted}건 중 원인을 못 찾은 것이{" "}
                        {llmStats.withoutCause}건, 후보를 냈으나 검증에서 전부 기각된 것이{" "}
                        {llmStats.withUnverifiedCauseOnly}건, 검증을 통과한 원인을 가진 것이{" "}
                        {llmStats.withVerifiedCause}건입니다. 검증을 통과한 원인 문장{" "}
                        {llmStats.confidence.low + llmStats.confidence.medium + llmStats.confidence.high}건의
                        신뢰도는 낮음 {llmStats.confidence.low} · 보통 {llmStats.confidence.medium} · 높음{" "}
                        {llmStats.confidence.high}건으로, 가장 많은 등급은{" "}
                        <strong className="text-fg">{dominant?.label ?? "없음"}</strong>입니다 — 그 분포 자체가 이
                        추정의 한계를 말합니다.
                      </>
                    ) : null}
                  </dd>
                </div>
              </dl>
              <p className="text-muted">
                본문색으로 단언하는 것은 인용이 실재하고 신뢰도가 보통 이상인 문장뿐입니다. 그 외는 전부 회색이며,
                회색 문장은 &ldquo;근거가 약하다&rdquo;는 표시이지 판정이 아닙니다.
              </p>
            </div>
          </SectionCard>

          {/* 수치 축(2026-09-21) — 이 페이지의 다른 카드는 전부 **통계 추론**을 설명한다. 이것만
              성질이 다르다: 게임사가 배포한 원본 수치를 직접 대조하는 문서 축이다. 두 축이 왜
              다른지를 여기서 말하지 않으면 화면의 배지 하나가 근거 없이 떠 있게 된다. */}
          <SectionCard eyebrow="수치 축" title="잠수함 패치는 어떻게 찾나" variant="glass">
            <div className="flex h-full flex-col gap-3 p-5 text-sm leading-relaxed text-fg-2">
              <p>
                이 사이트가 말하는 &ldquo;미공지&rdquo;는 두 종류입니다. 하나는{" "}
                <strong className="text-fg">지표 축</strong> — 승률·픽률이 유의하게 움직였는데 짝지을
                패치노트가 없는 경우로, 통계가 근거입니다. 다른 하나는{" "}
                <strong className="text-fg">수치 축</strong> — 데미지·재사용 대기시간·가격 같은 원본
                값이 실제로 바뀌었는데 패치노트에 없는 경우이고, 통칭 잠수함 패치입니다.
              </p>
              <p>
                수치 축은 추론하지 않습니다. 게임사가 패치마다 배포하는 데이터를 패치 간 그대로
                대조하고, 바뀐 값마다 그것을 말한 패치노트 항목이 있는지 찾습니다. 짝이 없으면
                잠수함입니다. 그래서 이 판정은 반박할 수 없고,{" "}
                <strong className="text-fg">지표가 하나도 안 움직여도 발견입니다</strong> —
                바꿨는데 효과가 없었던 변경도 바뀐 것은 사실이기 때문입니다.
              </p>
              <p>
                짝이 있어도 끝이 아닙니다. 패치노트가 <strong className="text-fg">같은 항목을 말했는데 적힌
                값이 실제와 다른</strong> 경우가 있어서, 그것만 따로 「공지값 불일치」로 부릅니다. 말하지 않은
                것도, 말한 대로 한 것도 아니라 둘 중 어느 쪽에 넣어도 거짓말이 됩니다. 값을 견줄 수 있을 때만
                견줍니다 — 레벨별 배열(<span className="font-mono">75/115/155</span>)이나 합성 표현은 어느 쪽을
                대표로 삼을지 정할 근거가 없으므로 견주지 않습니다.
              </p>
              <p className="text-muted">
                증거가 다르므로 위계도 다릅니다. 잠수함 패치는 미공지·간접 영향보다 위에 옵니다.
              </p>
              <p className="text-muted">
                오탐을 막는 규칙 두 가지를 둡니다. 아이템 목록에는 칼바람·아레나 등 다른 모드의
                항목이 섞여 있으므로 <strong className="text-fg-2">소환사의 협곡에서 쓸 수 있는 것만</strong>{" "}
                봅니다. 스킬 수치는 배열 자리의 의미가 공개되지 않아, 그 스킬을 언급한 패치노트가
                하나라도 있으면 공지로 봅니다 — 근거 없이 잠수함이라 부르지 않기 위해 덜 찾는 쪽을
                고른 것입니다.
              </p>
            </div>
          </SectionCard>

          {/* 디스코드 방송 규칙(2026-09-19, 독립 채점 K1-2): 홈·항목 상세의 "방송 규칙 보기 →"가
              이 페이지로 오는데 정작 방송에 대한 서술이 0건이었다. 2026-09-14에 제거된 것은
              **미리보기 목업**이고, 무엇이 언제 나가는지에 대한 서술은 방법론이 총망라해야 한다
              (공통3). 목업을 되살리지 않고 규칙만 적는다. */}
          {/* scroll-mt: sticky 헤더(높이 ~57px)가 앵커 착지 시 카드 제목을 덮는다 — 실측 21px 가림
              (독립 채점 보완4). 착지점을 헤더 아래로 내린다. */}
          <div id="discord" className="scroll-mt-20">
            <SectionCard eyebrow="알림" title="디스코드로 무엇이 나가나" variant="glass">
              <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-fg-2">
                <p>
                  브리핑은 <strong className="text-fg">배치가 보냅니다</strong>. 이 사이트는 정적 페이지라
                  브라우저에서 아무것도 전송하지 않습니다 — 패치 수집·집계·판정이 끝난 뒤 CI가 한 번 보냅니다.
                </p>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
                  <div>
                    <dt className="font-display font-bold text-fg">보내는 것</dt>
                    <dd className="mt-1">
                      미공지 관측 상위 항목과 이상 관측(공지 방향과 반대로 움직인 관측) 상위 3건입니다.
                      <strong className="text-fg"> 공지대로 움직인 관측은 보내지 않습니다</strong> — 패치노트를
                      읽으면 아는 내용이기 때문입니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display font-bold text-fg">보내지 않는 것</dt>
                    <dd className="mt-1">
                      표본 부족 · 바닥 미달 · 변화 없음으로 판정된 관측은 화면과 마찬가지로 방송에서도 빠집니다.
                      그래서 건수가 적은 패치에는 짧은 브리핑이 갑니다.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-display font-bold text-fg">언제</dt>
                    <dd className="mt-1">패치 수집이 끝난 뒤 판정 파이프라인 마지막 단계에서 1회. 실패해도 재전송하지 않습니다.</dd>
                  </div>
                  <div>
                    <dt className="font-display font-bold text-fg">홈의 &ldquo;마지막 집계&rdquo;</dt>
                    <dd className="mt-1">전송 시각이 아니라 이 판정 파일이 마지막으로 생성된 시각입니다.</dd>
                  </div>
                </dl>
              </div>
            </SectionCard>
          </div>

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
