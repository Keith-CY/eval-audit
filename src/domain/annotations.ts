import { stringifyJsonl } from "./jsonl";
import type { Annotation, RowAudit } from "./types";

export type AnnotationMap = Record<string, Annotation>;

export function annotationStorageKey(artifact: string): string {
  return `evaluation-review:${artifact}:annotations`;
}

export function loadAnnotations(artifact: string): AnnotationMap {
  const raw = localStorage.getItem(annotationStorageKey(artifact));
  if (!raw) return {};

  try {
    return JSON.parse(raw) as AnnotationMap;
  } catch {
    return {};
  }
}

export function saveAnnotations(artifact: string, annotations: AnnotationMap): void {
  localStorage.setItem(annotationStorageKey(artifact), JSON.stringify(annotations));
}

export function clearAnnotations(artifact: string): void {
  localStorage.removeItem(annotationStorageKey(artifact));
}

export function getExportableAnnotations(annotations: AnnotationMap): Annotation[] {
  return Object.values(annotations).filter(
    (annotation) =>
      annotation.review_status !== "unreviewed" ||
      annotation.review_note.trim().length > 0
  );
}

export interface ExportAnnotationsInput {
  annotations: AnnotationMap;
  rowsByDialogueId: Map<string, RowAudit>;
  exportedAt: string;
}

export function exportAnnotations(input: ExportAnnotationsInput): string {
  const records = getExportableAnnotations(input.annotations).map((annotation) => {
    const row = input.rowsByDialogueId.get(annotation.dialogue_id);

    return {
      artifact: annotation.artifact,
      dialogue_id: annotation.dialogue_id,
      row_index: annotation.row_index,
      review_status: annotation.review_status,
      review_note: annotation.review_note,
      gold_event_count: row?.gold_event_count ?? null,
      pred_event_count: row?.pred_event_count ?? null,
      matched_events: row?.matched_events ?? null,
      unmatched_gold: row?.unmatched_gold ?? null,
      unmatched_pred: row?.unmatched_pred ?? null,
      exported_at: input.exportedAt
    };
  });

  return stringifyJsonl(records);
}
