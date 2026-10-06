// src/app/pubg/weapon/[key]/page.tsx
// PUBG 무기 상세 — 승인 아티팩트 §4 "항목상세 스플래시"의 `무기` 탭. 사용자 지시
// ("총기류, 맵류의 상세화면 전환 및 스플레시아트 디자인이 누락됨. 보완진행", 2026-09-17).
//
// output:'export'라 generateStaticParams가 필수다. 집계가 없으면 `_placeholder` 1건을 남긴다 —
// 빈 배열을 반환하면 `next build`가 즉시 실패한다(2026-09-05 실측, `/item/[id]`와 동일).
import type { Metadata } from "next";
import PubgWeaponDetail from "@/components/pubg/PubgWeaponDetail";
import { loadPubg, loadPubgDeclaration, pubgPair } from "@/lib/pubgData";
import { weaponKeyFromSlug, weaponSlug } from "@/lib/pubgRoutes";

interface PageProps {
  params: Promise<{ key: string }>;
}

export function generateStaticParams(): Array<{ key: string }> {
  const bundle = loadPubg();
  const keys = bundle?.after.weapons.map((w) => w.weaponKey) ?? [];
  if (keys.length === 0) return [{ key: "_placeholder" }];
  return keys.map((key) => ({ key: weaponSlug(key) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { key } = await params;
  const bundle = loadPubg();
  const weaponKey = weaponKeyFromSlug(key, bundle?.after.weapons.map((w) => w.weaponKey) ?? []);
  const name = bundle?.after.weapons.find((w) => w.weaponKey === weaponKey)?.weaponName ?? "무기";
  const pair = pubgPair();
  const span = pair ? `${pair.from} → ${pair.to}` : "패치 비교";
  return {
    title: `${name} · PUBG ${span} · patchgap`,
    description: `${name}의 ${span} 획득 점유율 변화와 판정 근거.`,
  };
}

export default async function PubgWeaponPage({ params }: PageProps) {
  const { key: slug } = await params;
  const bundle = loadPubg();
  return <PubgWeaponDetail slug={slug} bundle={bundle} declaration={bundle ? null : loadPubgDeclaration()} />;
}
