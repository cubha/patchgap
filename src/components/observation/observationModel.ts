// src/components/observation/observationModel.ts — 상세 공통 관측 섹션의 입력 모델(ST1, 미구현 시그니처).
import type { DeltaRecord } from "@/pipeline/types";

export interface ObservationSegment<T> {
  key: string;
  label: string;
  item: T;
}

export interface ObservationMetric<T> {
  key: string;
  label: string;
  segments: ObservationSegment<T>[];
}

export interface ObservationModel<T> {
  metrics: ObservationMetric<T>[];
  count: number;
}

export interface ObservationSelection {
  metric: string;
  segment: string;
}

export interface ObservationAxes<T> {
  metricOf(item: T): string;
  segmentOf(item: T): string;
  metricLabel(key: string, item: T): string;
  segmentLabel(key: string): string;
  metricOrder: readonly string[];
  segmentOrder: readonly string[];
}

export function groupObservations<T>(items: readonly T[], axes: ObservationAxes<T>): ObservationModel<T> {
  void items;
  void axes;
  throw new Error("TODO(ST1): groupObservations");
}

export function lolObservationModel(rows: readonly DeltaRecord[], qAlpha?: number): ObservationModel<DeltaRecord> {
  void rows;
  void qAlpha;
  throw new Error("TODO(ST1): lolObservationModel");
}

export function lolSelectionFromId(rawId: string): ObservationSelection | null {
  void rawId;
  throw new Error("TODO(ST1): lolSelectionFromId");
}

export function resolveSelection<T>(
  model: ObservationModel<T>,
  wanted: Partial<ObservationSelection> | null | undefined
): ObservationSelection | null {
  void model;
  void wanted;
  throw new Error("TODO(ST1): resolveSelection");
}
