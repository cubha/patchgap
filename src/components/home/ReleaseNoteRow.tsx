// src/components/home/ReleaseNoteRow.tsx
// 릴리즈노트 스트림 1개 그룹(엔티티)의 렌더 — HANDOFF-redesign-2026-09-10.md §4-1:
// "챔피언 카드(아이콘 56px) → 스킬 행(스펠 아이콘 40px) → `스탯: A ⇒ B` → 우측에 관측 판정 뱃지".
// 순수 프레젠테이션(서버 컴포넌트) — 상태·데이터 페칭은 page.tsx/ReleaseNoteStream이 소유한다.
// §1-2 불변식: 상태 색(--accent/--danger/--warn/--success)은 이 컴포넌트 안에서 재정의하지
// 않는다 — StatusBadge/DeltaValue가 이미 토큰을 바르게 쓰므로 그대로 위임.
//
// 2026-09-10 verify-impl 축B 반영 — 확정 시안 대비 3건:
//  1. `.rn-obs` 신설: 엔티티 이름 아래 대표 관측 1줄(지표·전/후·Δ·CI·q). 공지/미공지 공통.
//  2. `.verdict .m` 신설: 스킬 행마다 "노트=상향 · 관측=밴률 상승" 판정 근거 1줄.
//  3. `.gap-why`(추정 원인)를 metric 행 루프 **밖**으로 올렸다 — 시안은 엔티티당 1회이고,
//     행마다 반복하면 같은 문장이 카드 안에서 3~4번 되풀이된다.
//
// ── 2026-09-17 라운드(사용자 지적 4건을 이 파일이 함께 받는다) ──────────────────────────
// **B1 스킬 인라인**: 같은 스킬의 변경 줄을 한 행으로 접고 스탯을 인라인 나열한다. 이전엔
//   카시오페아 `E - 쌍독니` 5줄이 같은 아이콘·같은 뱃지로 다섯 번 반복됐다. 묶기는
//   `noteSkillGroups.ts`가 하고(특히 `skill === null`을 절대 병합하지 않는다) 여기선 그린다.
// **B2 Gap 통합**: `indirect-effect` 행이 이 카드로 들어온다 — 원인이 규명된 Gap이다. 홈 하단
//   전용 섹션이 그리던 인과 체인(`관측 ← [섹션] 원인`)을 여기로 옮겼다.
// **B3 미비한 변화 억제**: 공지 카드의 대표 관측에 유의성·효과크기 바닥 게이트를 건다
//   (`selectReportableObservation`). 미공지 카드는 이미 판정 단계에서 게이트돼 있어 그대로 둔다.
// **B4 치장 항목**: 스킨·크로마처럼 관측할 지표가 원리적으로 없는 줄에는 뱃지를 붙이지 않는다.
//   "관측 보류"는 "아직 관측 못 했다"는 뜻이라 스킨에 붙으면 거짓말에 가깝다.
//   (2026-09-18 S5: 같은 이유가 투표 결과·버그 수정 줄에도 해당해 리터럴 자체를 표시 키
//   `unpaired`("짝지은 관측 없음")로 교체했다 — 사실 서술이라 어느 줄에 붙어도 참이다.)

import Link from "next/link";
import type { DeltaRecord, LanePosition, PatchNoteItem } from "@/pipeline/types";
import EntityIcon from "@/components/EntityIcon";
import IconBox from "@/components/IconBox";
import LaneGlyph from "@/components/LaneGlyph";
import SpellIcon from "@/components/SpellIcon";
import StatusBadge from "@/components/StatusBadge";
import { displayStatus } from "@/pipeline/shared/display-status";
import { isReportableRecord } from "@/components/compare/entityRows";
import DeltaValue from "@/components/DeltaValue";
import { itemHref, metricLabel } from "@/lib/format";
import { isCosmeticGroup, isCosmeticNote } from "@/pipeline/shared/cosmetic-note";
import CosmeticSkinPreview, { type CosmeticSkinItem } from "./CosmeticSkinPreview";
import { spellIconKey } from "@/pipeline/match/spell-icon";
import {
  excludeObservation,
  formatMetricValue,
  metricKind,
  resolveGapCause,
  type GapCauseMode,
} from "./logic";
import { groupNotesBySkill, representativeRecord } from "./noteSkillGroups";
import { buildNoteVerdict, formatQ, selectEntityObservation, selectReportableObservation } from "./streamVerdict";
import type { IndirectEffectEntry } from "./indirectEffects";
import type { ReleaseStreamGroup } from "./releaseStream";
import type { StreamEntityIcon } from "./releaseStreamEntity";
import ExternalLink from "@/components/ExternalLink";

export interface ReleaseNoteRowProps {
  group: ReleaseStreamGroup;
  icon: StreamEntityIcon;
  /** loadSpellIcons()?.icons — 없으면(자산 미보유·미실행) 전부 텍스트 폴백. */
  spellIcons: Record<string, string> | null;
  /** note.id → 그 노트를 근거로 매칭된 델타(deltas.rows의 matchedNoteIds 역색인, page.tsx가
   * 구성). 매칭된 델타가 없는 노트는 이 맵에 키가 없다 — 뱃지는 "짝지은 관측 없음"(S5), 판정 문장은
   * 아예 만들지 않는다(무근거 문장 금지). */
  noteDeltas: Record<string, DeltaRecord>;
  /** note.id → 그 노트에 짝지어진 **모든** 델타 행. 2026-09-18 라운드6부터 이 카드는 비관측 사유를
   * 말하지 않아 읽지 않는다 — 호출부(ReleaseNoteStream) 계약 유지를 위해 prop만 남긴다. */
  noteDeltaRows?: Record<string, DeltaRecord[]>;
  /** 미공지 그룹의 "✕ {patch} 패치노트에 없음" 문구에 쓸 to-패치 번호. */
  patch: string | null;
  /** deltas.meta.qAlpha — 유의 판정 임계. 없으면 FDR_ALPHA 기본값(isSignificantDelta). */
  qAlpha?: number;
  /** deltaId → 인과 체인(B2). `indirect-effect` 행만 키를 갖는다. */
  causes?: Record<string, IndirectEffectEntry>;
  /**
   * note.id → 그 줄이 지목한 스킨 미리보기(ST-B6). **자산이 실제로 존재하는 것만** 들어온다 —
   * 유무 판정은 page.tsx가 빌드 타임에 끝낸다. 키가 없으면 그 줄은 이미지 없이 텍스트만.
   */
  skinPreviews?: Record<string, CosmeticSkinItem[]>;
}

const SECTION_LABELS: Record<string, string> = {
  champion: "챔피언",
  item: "아이템",
  system: "시스템",
  other: "기타",
};

/** 원인 표시 모드별 글자색 — 규명된 것만 본문색, 나머지는 회색(무근거 문장은 회색). */
const CAUSE_TONE: Record<GapCauseMode, string> = {
  verified: "text-fg-2",
  weak: "text-muted",
  candidate: "text-muted",
  none: "text-muted",
  unreviewed: "text-muted",
};

/** 카드 엔티티 아이콘(56px) — 라인 엔티티(entityType="lane", 챔피언 자산 없음)는
 * DeltaTable.tsx의 RowIcon과 동형으로 LaneGlyph 박스를 쓴다(2026-09-10 verify-impl 축B 후속:
 * EntityIcon 기본 폴백이 "바텀"의 첫 글자 "바"로 렌더돼 대조표와 불일치했던 결함).
 * 박스 마크업은 2026-09-12(6차, /verify-impl 재검증)부터 IconBox 공용 — src/components/IconBox.tsx
 * 참고(DeltaTable.tsx RowIcon과 각자 손으로 재구현하던 것을 정리). */
function CardIcon({ icon, entity }: { icon: StreamEntityIcon; entity: string }) {
  if (icon.entityType === "lane" && icon.entityKey) {
    return (
      <IconBox size={56}>
        <LaneGlyph lane={icon.entityKey as LanePosition} size={34} labelled />
      </IconBox>
    );
  }
  if (icon.entityType && icon.entityKey) {
    return <EntityIcon entityType={icon.entityType} entityKey={icon.entityKey} name={entity} size={56} />;
  }
  return (
    <IconBox size={56} className="font-display text-sm font-bold">
      {entity.slice(0, 1)}
    </IconBox>
  );
}

/** 시안 `.rn-obs` — 엔티티 대표 관측 1줄. "밴률 26.8% → 42.4% ▲ +15.7%p CI ±1.3 · q<0.001" */
function ObservationLine({ record }: { record: DeltaRecord }) {
  const q = formatQ(record.q);
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted">
      <span className="font-bold text-fg-2">{metricLabel(record.metric)}</span>
      <span className="font-mono tabular-nums">
        {formatMetricValue(record.before, record.metric)} →{" "}
        {formatMetricValue(record.after, record.metric)}
      </span>
      <DeltaValue delta={record.delta} ci={record.ci} kind={metricKind(record.metric)} />
      {q ? <span className="font-mono">· {q}</span> : null}
    </div>
  );
}

/** 노트 그룹의 노트들에 짝지어진 델타 — 같은 델타가 노트 여러 줄에 매칭될 수 있어(ST-08
 * matchedNoteIds) id로 중복을 제거한다. */
function matchedRecords(
  noteIds: readonly string[],
  noteDeltas: Record<string, DeltaRecord>
): DeltaRecord[] {
  const seen = new Set<string>();
  const out: DeltaRecord[] = [];
  for (const id of noteIds) {
    const record = noteDeltas[id];
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    out.push(record);
  }
  return out;
}

/** 스킬 행 1개의 스탯 줄 — B1의 실체. 한 줄에 `스탯: 이전 ⇒ 이후`를 쌓고, 스탯이 없는 줄은
 * 요약문 그대로 쓴다(수치가 파싱되지 않은 항목을 수치인 척 꾸미지 않는다). */
function StatLine({ note }: { note: PatchNoteItem }) {
  if (!note.stat) return <div className="text-sm text-fg-2">{note.summary}</div>;
  return (
    <div className="text-sm text-fg-2">
      {note.stat}:{" "}
      <span className="font-mono tabular-nums text-fg">
        {note.before ?? "—"} ⇒ {note.after ?? "—"}
      </span>
    </div>
  );
}

/** 인과 체인 1줄(B2) — `IndirectEffectPanel`이 그리던 `관측 ← [섹션] 원인`을 그대로 옮겼다. */
function CauseChain({ entry, href }: { entry: IndirectEffectEntry; href: string }) {
  const { causeEntity, causeSection, causeAnchor, causeText } = entry;
  return (
    <>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-fg-2">
        <span aria-hidden="true" className="text-muted">
          ←
        </span>
        {causeEntity ? (
          <>
            <span className="text-xs text-muted">
              [{causeSection ? (SECTION_LABELS[causeSection] ?? causeSection) : "노트"}]
            </span>
            {causeAnchor ? (
              <ExternalLink href={causeAnchor} className="font-bold text-accent hover:underline">
                {causeEntity}
              </ExternalLink>
            ) : (
              <span className="font-bold text-fg">{causeEntity}</span>
            )}
            <span className="text-muted">변경의 파급</span>
          </>
        ) : (
          <span className="text-muted">원인 노트 확인 불가</span>
        )}
      </p>
      {/* 재판정 보완 3: 파급 카드도 상태 어휘("추정 원인")와 자기 관측 근거 링크를 가진다 — 다른 Gap 카드와 같은 틀. */}
      <p className="mt-1 text-xs leading-relaxed text-muted">
        추정 원인: {causeText}{" "}
        <Link href={href} className="font-bold text-accent hover:underline">
          근거 보기 →
        </Link>
      </p>
    </>
  );
}

export default function ReleaseNoteRow({
  group,
  icon,
  spellIcons,
  noteDeltas,
  patch,
  qAlpha,
  causes,
  skinPreviews,
}: ReleaseNoteRowProps) {
  const isUnannounced = group.kind === "unannounced";

  // B4 — 그룹 전체가 치장이면 이 카드엔 뱃지가 하나도 붙지 않는다.
  const cosmeticGroup = !isUnannounced && isCosmeticGroup(group.notes);

  // B3 — 공지 카드만 게이트를 건다. 미공지 행은 판정 단계에서 이미 바닥을 넘은 것들이다.
  // 짝 행 목록은 아래 사유 계산(S4)과 **같은 입력**이어야 하므로 한 번만 구해 재사용한다.
  const noteIds = isUnannounced ? [] : group.notes.map((n) => n.id);
  const pairedRecords = isUnannounced ? [] : matchedRecords(noteIds, noteDeltas);
  const observation = isUnannounced
    ? selectEntityObservation(group.deltas)
    : selectReportableObservation(pairedRecords, qAlpha);

  // 2026-09-18 라운드6(C1): 대표 관측이 없을 때 사유(유의차 없음 / 바닥 미달 / 혼재)를 더 이상 말하지
  // 않는다 — 그 어휘 자체가 사용자가 "아예 보여주지 않도록" 한 노이즈다. 헤더는 "유의한 관측 없음"
  // 한 마디만 하고, 수치는 항목 상세가 그대로 보여준다.
  // B2 — 이 카드의 대표 행에 규명된 원인이 있는가(indirect-effect).
  const gapRepresentative = isUnannounced ? selectEntityObservation(group.deltas) : null;
  const causeEntry = gapRepresentative ? (causes?.[gapRepresentative.id] ?? null) : null;
  const gapCause = isUnannounced && gapRepresentative && !causeEntry ? resolveGapCause(gapRepresentative) : null;

  // 헤더(ObservationLine)가 이미 보여준 대표 관측을 하단 리스트에서 제외 — 안 그러면 같은
  // 델타 행이 카드 안에서 두 번 렌더된다(2026-09-11 결함).
  const remainingDeltas = isUnannounced ? excludeObservation(group.deltas, observation) : [];

  const skillGroups = isUnannounced ? [] : groupNotesBySkill(group.notes);

  // 미공지 행 강조(2026-09-13·6차 연속) — 채움 없이 왼쪽 골드 보더 하나로만 표시한다.
  // 이력: 원래 불투명 `bg-surface-warm`이었고(미공지는 스트림 최상단 정렬이라 스크롤 없이 보이는
  // 행이 거의 전부 미공지 → 부모 <ul>의 `panel-surface-glass`가 통째로 가려졌다), 이를 반투명
  // 골드 워시(`.row-highlight`)로 한 번 바꿨더니 이번엔 좌측 패널만 금색으로 물들어 우측 패널과
  // 이질감이 생겼다(사용자 지적 "왜 좌측섹션만 금색이냐, 전부 통일하라고"). 채움을 아예 빼면
  // 배경 처리가 사이트 전체에서 동일해지고, 강조는 `border-l-accent`가 이미 충분히 수행한다.
  return (
    <li
      className={
        isUnannounced
          ? "border-b border-l-4 border-border-soft border-l-accent last:border-b-0"
          : "border-b border-border-soft last:border-b-0"
      }
    >
      {/* 기본 접힘 아코디언 — 카드 전체가 항상 펼쳐져 화면을 뒤덮던 문제(2026-09-11) 수정.
          네이티브 <details>/<summary>라 서버 컴포넌트 그대로 유지할 수 있다(JS 상태 불필요). */}
      <details className="group px-5 py-4">
        <summary className="flex cursor-pointer list-none items-center gap-4 [&::-webkit-details-marker]:hidden">
          <CardIcon icon={icon} entity={group.entity} />
          <div className="min-w-0 flex-1">
            <div className="font-display text-base font-bold text-fg">{group.entity}</div>
            {observation ? (
              <ObservationLine record={observation} />
            ) : cosmeticGroup ? (
              // B4 — 스킨·크로마엔 측정할 지표가 없다.
              <div className="mt-1 text-xs text-muted">치장 항목</div>
            ) : (
              // C1(라운드6) — 사유를 단정하지 않고 사실만: 유의하고 바닥을 넘는 관측이 없다.
              <div className="mt-1 text-xs text-muted">유의한 관측 없음</div>
            )}
          </div>
          <span
            aria-hidden="true"
            className="shrink-0 text-xs text-muted transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>

        {isUnannounced ? (
          <>
            {patch ? (
              <div className="mt-3 text-xs font-bold text-accent">
                ✕ {patch} 패치노트에 없음
              </div>
            ) : null}
            {/* B2 — 원인이 규명된 Gap은 인과 체인을, 아닌 Gap은 네 상태를 구분한 문구를 쓴다. */}
            {causeEntry ? (
              <CauseChain entry={causeEntry} href={itemHref(gapRepresentative!.id)} />
            ) : gapCause ? (
              <p className={`mt-2 text-xs ${CAUSE_TONE[gapCause.mode]}`}>
                {gapCause.mode === "verified" ? "추정 원인: " : gapCause.mode === "weak" ? "가능성(신뢰도 낮음): " : null}
                {gapCause.text}{" "}
                <Link
                  href={itemHref(gapRepresentative!.id)}
                  className="font-bold text-accent hover:underline"
                >
                  근거 보기 →
                </Link>
              </p>
            ) : null}
            {remainingDeltas.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-3">
                {remainingDeltas.map((row) => (
                  <li key={row.id} className="grid grid-cols-[1fr_1.4fr_1.4fr_auto] items-center gap-4">
                    <div className="text-xs text-muted">{metricLabel(row.metric)}</div>
                    <div className="text-xs text-muted">
                      {formatMetricValue(row.before, row.metric)} ⇒{" "}
                      <span className="font-mono tabular-nums text-fg">
                        {formatMetricValue(row.after, row.metric)}
                      </span>
                    </div>
                    <DeltaValue delta={row.delta} ci={row.ci} kind={metricKind(row.metric)} />
                    <Link href={itemHref(row.id)} className="text-xs font-bold text-accent hover:underline">
                      근거 보기 →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          // B1 — 스킬 단위 행. 같은 스킬의 스탯 변경이 여러 줄이면 한 행 안에 인라인으로 쌓인다.
          <ul className="mt-3 flex flex-col gap-3">
            {skillGroups.map((skillGroup) => {
              const filename = skillGroup.skill
                ? (spellIcons?.[spellIconKey(group.entity, skillGroup.skill)] ?? null)
                : null;
              // 뱃지는 행당 1개이고(이전엔 노트 줄마다 1개), **보고 가능한 관측**(유의·바닥 통과·노이즈
              // 아님)이 있을 때만 붙는다 — 2026-09-18 라운드6(C1·C5). "짝지은 관측 없음"·"관측 미확인"
              // 같은 부재 배지는 정보가 아니라 잡음이었다. 치장 줄은 원래 붙지 않는다(B4).
              // scope-critic ST5: `representativeRecord`(상태 우선순위)가 비보고 행을 고르면 같은 스킬에 보고
              // 가능한 형제 행이 있어도 배지가 사라진다 — 보고 가능한 행 **중에서** 대표를 고른다.
              const cosmeticRow = skillGroup.notes.every(isCosmeticNote);
              const reportableNotes = skillGroup.notes.filter((note) => {
                const r = noteDeltas[note.id];
                return r !== undefined && isReportableRecord(r, qAlpha);
              });
              const badgeRecord = representativeRecord(reportableNotes, noteDeltas);
              // 판정 문장은 여전히 **노트 줄 단위**다 — 스탯마다 노트 방향이 다를 수 있다
              // (같은 스킬에서 계수는 상향인데 마나는 하향인 경우가 실제로 있다).
              return (
                <li key={skillGroup.key} className="flex items-start gap-3">
                  {skillGroup.skill ? (
                    <SpellIcon filename={filename} name={skillGroup.skill} size={40} />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {skillGroup.skill ? (
                      <div className="text-xs font-bold text-fg-2">{skillGroup.skill}</div>
                    ) : null}
                    <div className="flex flex-col gap-0.5">
                      {skillGroup.notes.map((note) => {
                        // 판정문도 보고 가능한 관측에만 — "유의차 없음"·"바닥 미달"은 쓰지 않는다(C1).
                        const noteRecord = noteDeltas[note.id];
                        const verdict =
                          noteRecord && isReportableRecord(noteRecord, qAlpha)
                            ? buildNoteVerdict(note, noteRecord, qAlpha)
                            : null;
                        return (
                          <div key={note.id}>
                            <StatLine note={note} />
                            {/* ST-B6 — 치장 줄이 지목한 스킨의 스플래시. 못 잡은 줄(크로마·
                                아이콘·와드·휘장·칭호·정수)엔 아무것도 렌더하지 않는다. */}
                            <CosmeticSkinPreview skins={skinPreviews?.[note.id] ?? []} />
                            {verdict ? (
                              <div className="text-xs text-muted">
                                {verdict.noteLabel} · 관측=
                                <span
                                  className={
                                    verdict.kind === "up"
                                      ? "font-bold text-success"
                                      : verdict.kind === "down"
                                        ? "font-bold text-danger"
                                        : "font-bold text-muted"
                                  }
                                >
                                  {verdict.observedLabel}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {cosmeticRow || !badgeRecord ? null : <StatusBadge status={displayStatus(badgeRecord, qAlpha)} />}
                </li>
              );
            })}
          </ul>
        )}
      </details>
    </li>
  );
}
