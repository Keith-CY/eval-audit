import { stringifyJsonl } from "./jsonl";
import {
  REVIEW_STATUSES,
  type Annotation,
  type EventNote,
  type ReviewStatus,
  type RowAudit
} from "./types";

export type AnnotationMap = Record<string, Annotation>;

const REVIEW_STATUS_SET = new Set<string>(REVIEW_STATUSES);

function getLocalStorage(): Storage | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return localStorage;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && REVIEW_STATUS_SET.has(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isEventNote(value: unknown): value is EventNote {
  if (!isPlainRecord(value)) return false;

  return (
    typeof value.event_key === "string" &&
    typeof value.event_index === "number" &&
    typeof value.match_status === "string" &&
    isNullableNumber(value.gold_event_index) &&
    isNullableNumber(value.pred_event_index) &&
    typeof value.note === "string"
  );
}

function normalizeAnnotation(value: unknown): Annotation | null {
  if (!isPlainRecord(value)) return null;

  const eventNotes = value.event_notes;
  const normalizedEventNotes =
    eventNotes === undefined
      ? []
      : Array.isArray(eventNotes) && eventNotes.every(isEventNote)
        ? eventNotes
        : null;

  if (!normalizedEventNotes) return null;

  if (
    typeof value.artifact === "string" &&
    typeof value.dialogue_id === "string" &&
    typeof value.row_index === "number" &&
    isReviewStatus(value.review_status) &&
    typeof value.review_note === "string" &&
    typeof value.updated_at === "string"
  ) {
    return {
      artifact: value.artifact,
      dialogue_id: value.dialogue_id,
      row_index: value.row_index,
      review_status: value.review_status,
      review_note: value.review_note,
      event_notes: normalizedEventNotes,
      updated_at: value.updated_at
    };
  }

  return null;
}

export function annotationStorageKey(artifact: string): string {
  return `evaluation-review:${artifact}:annotations`;
}

export function loadAnnotations(artifact: string): AnnotationMap {
  try {
    const storage = getLocalStorage();
    if (!storage) return {};

    const raw = storage.getItem(annotationStorageKey(artifact));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainRecord(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, value]) => {
        const annotation = normalizeAnnotation(value);
        return annotation ? [[key, annotation]] : [];
      })
    );
  } catch {
    return {};
  }
}

export function saveAnnotations(artifact: string, annotations: AnnotationMap): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage) return false;

    storage.setItem(annotationStorageKey(artifact), JSON.stringify(annotations));
    return true;
  } catch {
    return false;
  }
}

export function clearAnnotations(artifact: string): boolean {
  try {
    const storage = getLocalStorage();
    if (!storage) return false;

    storage.removeItem(annotationStorageKey(artifact));
    return true;
  } catch {
    return false;
  }
}

export function getExportableAnnotations(annotations: AnnotationMap): Annotation[] {
  return Object.values(annotations).filter(
    (annotation) =>
      annotation.review_status !== "unreviewed" ||
      annotation.review_note.trim().length > 0 ||
      exportableEventNotes(annotation).length > 0
  ).sort((left, right) => {
    const rowIndexDifference = left.row_index - right.row_index;
    if (rowIndexDifference !== 0) return rowIndexDifference;

    if (left.dialogue_id < right.dialogue_id) return -1;
    if (left.dialogue_id > right.dialogue_id) return 1;
    return 0;
  });
}

function exportableEventNotes(annotation: Annotation): EventNote[] {
  return (annotation.event_notes ?? []).filter((eventNote) => eventNote.note.trim().length > 0);
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
      event_notes: exportableEventNotes(annotation),
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
