import { stringifyJsonl } from "./jsonl";
import {
  REVIEW_STATUSES,
  type Annotation,
  type ReviewStatus,
  type RowAudit
} from "./types";

export type AnnotationMap = Record<string, Annotation>;

const REVIEW_STATUS_SET = new Set<string>(REVIEW_STATUSES);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && REVIEW_STATUS_SET.has(value);
}

function isAnnotation(value: unknown): value is Annotation {
  if (!isPlainRecord(value)) return false;

  return (
    typeof value.artifact === "string" &&
    typeof value.dialogue_id === "string" &&
    typeof value.row_index === "number" &&
    isReviewStatus(value.review_status) &&
    typeof value.review_note === "string" &&
    typeof value.updated_at === "string"
  );
}

export function annotationStorageKey(artifact: string): string {
  return `evaluation-review:${artifact}:annotations`;
}

export function loadAnnotations(artifact: string): AnnotationMap {
  const raw = localStorage.getItem(annotationStorageKey(artifact));
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, Annotation] =>
        isAnnotation(entry[1])
      )
    );
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
  ).sort((left, right) => {
    const rowIndexDifference = left.row_index - right.row_index;
    if (rowIndexDifference !== 0) return rowIndexDifference;

    if (left.dialogue_id < right.dialogue_id) return -1;
    if (left.dialogue_id > right.dialogue_id) return 1;
    return 0;
  });
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
