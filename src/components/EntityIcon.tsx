/* eslint-disable @next/next/no-img-element */
// src/components/EntityIcon.tsx
// 엔티티 아이콘 — public/dd/{champion,item}/*.png(빌드 타임 Data Dragon 다운로드, ST-08
// run-ddragon.ts 소유) 참조. next/image는 output:'export' + 외부 도메인 없음 조합에서 이점이
// 없고(images.unoptimized=true 이미 설정) onError 폴백 제어가 <img>가 더 단순해 미사용.
// objective/lane/summary 엔티티는 Data Dragon 자산이 없어 항상 폴백 박스(텍스트)로 렌더한다.
// 파일 로드 실패(404 등) 시에도 동일 폴백으로 전환 — 클라이언트 컴포넌트가 필요한 유일한 이유.
// 폴백 박스는 2026-09-12(6차, /verify-impl 재검증)부터 IconBox.tsx 공용 — 주석 참고
// (SpellIcon.tsx·NoteNavigator.tsx 등과 동일 시각 역할을 각자 재구현하던 드리프트 정리).
"use client";

import { useState } from "react";
import type { DeltaEntityType } from "@/pipeline/types";
import IconBox from "@/components/IconBox";
import type { GameId } from "@/lib/game";
import { publicTftAssetPath } from "@/pipeline/tft/asset-path";

export interface EntityIconProps {
  entityType: DeltaEntityType;
  /** champion → Data Dragon key(예: "Trundle"), item → itemId 문자열(예: "3047"). 그 외
   * entityType은 이미지가 없으므로 값이 있어도 무시된다. */
  entityKey: string;
  /** alt 텍스트이자 폴백 라벨(fallbackLabel 미지정 시 첫 글자)의 소스. */
  name: string;
  /** 폴백 박스에 표시할 텍스트를 직접 지정(오브젝트·라인 지표용, 예: "용"·"골"). 미지정 시
   * name의 첫 글자. */
  fallbackLabel?: string;
  /** 정사각 한 변(px). 기본 32(대조표·미공지 목록 행 크기). */
  size?: number;
  /** 자산 경로 계열. 기본 `"lol"`(기존 호출부 호환). */
  game?: GameId;
  /**
   * 이 대상의 자산이 **실재하지 않는다**고 호출부가 이미 아는 경우(매니페스트 조회 결과).
   * 참이면 요청 자체를 하지 않고 폴백 박스를 그린다 — 404 콘솔 오류는 설계된 상태가 아니다
   * (실측: TFT 미보유 2건이 매 페이지에서 404를 냈다, 2026-09-23).
   */
  assetMissing?: boolean;
  className?: string;
}

/**
 * 자산 경로는 **게임마다 다르다** — `item`이라는 같은 어휘가 LoL에서는 숫자 itemId,
 * TFT에서는 `DA_Artifact_*` 키를 가리키므로 한 경로 규칙으로 합칠 수 없다(2026-09-23).
 * TFT 자산은 `public/dd/tft/{kind}/{key}.png`이고 조달은 `scripts/run-tft-assets.ts`가 한다.
 */
function ddragonSrc(game: GameId, entityType: DeltaEntityType, entityKey: string): string | null {
  if (game === "tft") {
    if (entityType === "unit" || entityType === "trait" || entityType === "item") {
      return publicTftAssetPath(entityType, entityKey);
    }
    return null;
  }
  if (entityType === "champion") return `/dd/champion/${entityKey}.png`;
  if (entityType === "item") return `/dd/item/${entityKey}.png`;
  return null;
}

export default function EntityIcon({
  entityType,
  entityKey,
  name,
  fallbackLabel,
  size = 32,
  game = "lol",
  assetMissing = false,
  className = "",
}: EntityIconProps) {
  const src = assetMissing ? null : ddragonSrc(game, entityType, entityKey);
  const [errored, setErrored] = useState(false);
  const label = fallbackLabel ?? name.slice(0, 1);
  const boxClassName = `font-display text-xs font-bold ${className}`;

  if (!src || errored) {
    return (
      <IconBox size={size} className={boxClassName}>
        {label}
      </IconBox>
    );
  }

  return (
    <IconBox size={size} className={boxClassName}>
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={() => setErrored(true)}
      />
    </IconBox>
  );
}
