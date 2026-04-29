import type {
  EvaluationSummary,
  EventComparison,
  ExtractedEvent,
  FieldComparison,
  FieldMetrics,
  FieldName,
  PredictionRow,
  RowAudit
} from "./types";

const fields: FieldName[] = ["actor", "time", "location", "action"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function numberValue(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" ? value : null;
}

function nullableNumberValue(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return value === null || typeof value === "number" ? value : null;
}

function numberValueAny(record: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = numberValue(record, key);
    if (value !== null) return value;
  }

  return fallback;
}

function arrayValue<T = unknown>(record: Record<string, unknown>, key: string): T[] {
  const value = record[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function recordValue(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  return isRecord(value) ? value : {};
}

function normalizeFieldComparison(value: unknown): FieldComparison {
  const record = isRecord(value) ? value : {};

  return {
    gold: arrayValue<string>(record, "gold"),
    pred: arrayValue<string>(record, "pred"),
    TP: numberValueAny(record, ["TP", "tp"]),
    FP: numberValueAny(record, ["FP", "fp"]),
    FN: numberValueAny(record, ["FN", "fn"]),
    precision: numberValue(record, "precision"),
    recall: numberValue(record, "recall"),
    f1: numberValue(record, "f1")
  };
}

function normalizeFieldMetrics(value: unknown): FieldMetrics {
  const record = isRecord(value) ? value : {};

  return {
    TP: numberValueAny(record, ["TP", "tp"]),
    FP: numberValueAny(record, ["FP", "fp"]),
    FN: numberValueAny(record, ["FN", "fn"]),
    precision: numberValue(record, "precision") ?? 0,
    recall: numberValue(record, "recall") ?? 0,
    f1: numberValue(record, "f1") ?? 0
  };
}

function eventsByDialogueId(rows: PredictionRow[]): Map<string, ExtractedEvent[]> {
  return new Map(rows.map((row) => [row.dialogue_id, row.events]));
}

function eventByIndex(
  eventsByDialogue: Map<string, ExtractedEvent[]>,
  dialogueId: string,
  index: number | null
): ExtractedEvent | null {
  if (index === null) return null;
  return eventsByDialogue.get(dialogueId)?.[index] ?? null;
}

export interface NormalizeEvaluationArtifactsInput {
  summary: unknown;
  summaryPath: string;
  rowAudits: unknown[];
  eventDetails: unknown[];
  predictionRows: PredictionRow[];
  goldRows: PredictionRow[];
}

function artifactFromSummaryPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const reportsIndex = parts.lastIndexOf("reports");
  if (reportsIndex >= 0 && parts[reportsIndex + 1]) {
    return parts[reportsIndex + 1];
  }

  return parts.at(0) ?? "evaluation";
}

function normalizeSummary(
  rawSummary: unknown,
  summaryPath: string,
  rowAudits: RowAudit[],
  predictionRows: PredictionRow[]
): EvaluationSummary {
  const summary = isRecord(rawSummary) ? rawSummary : {};
  const rawFieldMetrics = recordValue(summary, "field_metrics");
  const rawWeights = recordValue(summary, "weights");
  const weights = Object.fromEntries(
    fields.map((field) => [
      field,
      numberValue(rawWeights, field) ?? numberValue(recordValue(rawFieldMetrics, field), "weight") ?? 0
    ])
  ) as Record<FieldName, number>;
  const fieldMetrics = Object.fromEntries(
    fields.map((field) => [field, normalizeFieldMetrics(rawFieldMetrics[field])])
  ) as Record<FieldName, FieldMetrics>;
  const fieldF1 = Object.fromEntries(
    fields.map((field) => [field, fieldMetrics[field].f1])
  ) as Record<FieldName, number>;
  const goldEvents = rowAudits.reduce((total, row) => total + row.gold_event_count, 0);
  const predictionEvents =
    numberValue(summary, "prediction_events") ??
    predictionRows.reduce((total, row) => total + row.events.length, 0);
  const unmatchedGold =
    numberValue(summary, "unmatched_gold") ??
    numberValue(summary, "events_unmatched_gold") ??
    rowAudits.reduce((total, row) => total + row.unmatched_gold, 0);
  const unmatchedPrediction =
    numberValue(summary, "unmatched_prediction") ??
    numberValue(summary, "events_unmatched_pred") ??
    rowAudits.reduce((total, row) => total + row.unmatched_pred, 0);
  const alignment = recordValue(summary, "alignment");
  const eventAlignment = recordValue(summary, "event_alignment");

  return {
    artifact: stringValue(summary, "artifact", artifactFromSummaryPath(summaryPath)),
    overall_weighted_f1: numberValue(summary, "overall_weighted_f1") ?? 0,
    field_f1: fieldF1,
    field_metrics: fieldMetrics,
    gold_events: numberValue(summary, "gold_events") ?? goldEvents,
    prediction_events: predictionEvents,
    events_evaluated: numberValue(summary, "events_evaluated") ?? goldEvents + predictionEvents,
    events_matched:
      numberValue(summary, "events_matched") ??
      rowAudits.reduce((total, row) => total + row.matched_events, 0),
    unmatched_gold: unmatchedGold,
    unmatched_prediction: unmatchedPrediction,
    rows_checked: numberValue(summary, "rows_checked") ?? rowAudits.length,
    rows_with_unmatched_gold:
      numberValue(summary, "rows_with_unmatched_gold") ??
      rowAudits.filter((row) => row.unmatched_gold > 0).length,
    rows_fully_matched:
      numberValue(summary, "rows_fully_matched") ??
      rowAudits.filter((row) => row.unmatched_gold === 0 && row.unmatched_pred === 0).length,
    rows_with_zero_prediction_events_despite_gold_events:
      numberValue(summary, "rows_with_zero_prediction_events_despite_gold_events") ??
      rowAudits.filter((row) => row.gold_event_count > 0 && row.pred_event_count === 0).length,
    events_written: numberValue(summary, "events_written") ?? predictionEvents,
    extraction_normalization_failures:
      numberValue(summary, "extraction_normalization_failures") ??
      numberValue(summary, "failure_count") ??
      0,
    weights,
    alignment: {
      method:
        stringValue(alignment, "method") ||
        stringValue(summary, "alignment_strategy") ||
        stringValue(eventAlignment, "alignment_strategy", "unknown"),
      threshold:
        numberValue(alignment, "threshold") ??
        numberValue(eventAlignment, "alignment_score_threshold") ??
        0
    }
  };
}

function normalizeEventComparison(
  rawEvent: unknown,
  artifact: string,
  rowIndexByDialogue: Map<string, number>,
  goldEventsByDialogue: Map<string, ExtractedEvent[]>,
  predEventsByDialogue: Map<string, ExtractedEvent[]>
): EventComparison {
  const event = isRecord(rawEvent) ? rawEvent : {};
  const dialogueId = stringValue(event, "dialogue_id");
  const goldEventIndex = nullableNumberValue(event, "gold_event_index");
  const predEventIndex = nullableNumberValue(event, "pred_event_index");
  const rawFields = recordValue(event, "fields");
  const normalizedFields = Object.fromEntries(
    fields.map((field) => [field, normalizeFieldComparison(rawFields[field])])
  ) as Record<FieldName, FieldComparison>;
  const goldEvent = isRecord(event.gold_event)
    ? (event.gold_event as unknown as ExtractedEvent)
    : eventByIndex(goldEventsByDialogue, dialogueId, goldEventIndex);
  const predEvent = isRecord(event.pred_event)
    ? (event.pred_event as unknown as ExtractedEvent)
    : eventByIndex(predEventsByDialogue, dialogueId, predEventIndex);

  return {
    weighted_f1: numberValue(event, "weighted_f1") ?? 0,
    active_weight: numberValue(event, "active_weight") ?? 0,
    fields: normalizedFields,
    artifact: stringValue(event, "artifact", artifact),
    dialogue_id: dialogueId,
    row_index: numberValue(event, "row_index") ?? rowIndexByDialogue.get(dialogueId) ?? 0,
    match_status: stringValue(event, "match_status", "unknown"),
    gold_event_index: goldEventIndex,
    pred_event_index: predEventIndex,
    alignment_score:
      numberValue(event, "alignment_score") ?? numberValue(event, "semantic_alignment_score") ?? 0,
    gold_event: goldEvent,
    pred_event: predEvent
  };
}

function normalizeRowAudit(rawAudit: unknown, index: number): RowAudit {
  const audit = isRecord(rawAudit) ? rawAudit : {};
  const matchedPairs = arrayValue(audit, "matched_pairs");
  const unmatchedGoldIndices = arrayValue(audit, "unmatched_gold_indices");
  const unmatchedPredIndices = arrayValue(audit, "unmatched_pred_indices");

  return {
    row_index: numberValue(audit, "row_index") ?? index,
    dialogue_id: stringValue(audit, "dialogue_id"),
    gold_event_count: numberValue(audit, "gold_event_count") ?? 0,
    pred_event_count: numberValue(audit, "pred_event_count") ?? 0,
    matched_events: numberValue(audit, "matched_events") ?? matchedPairs.length,
    unmatched_gold: numberValue(audit, "unmatched_gold") ?? unmatchedGoldIndices.length,
    unmatched_pred:
      numberValue(audit, "unmatched_pred") ??
      numberValue(audit, "unmatched_prediction") ??
      unmatchedPredIndices.length,
    events: []
  };
}

export function normalizeEvaluationArtifacts(
  input: NormalizeEvaluationArtifactsInput
): {
  summary: EvaluationSummary;
  rowAudits: RowAudit[];
  eventDetails: EventComparison[];
} {
  const initialRowAudits = input.rowAudits.map(normalizeRowAudit);
  const summary = normalizeSummary(
    input.summary,
    input.summaryPath,
    initialRowAudits,
    input.predictionRows
  );
  const rowIndexByDialogue = new Map(
    initialRowAudits.map((rowAudit) => [rowAudit.dialogue_id, rowAudit.row_index])
  );
  const goldEventsByDialogue = eventsByDialogueId(input.goldRows);
  const predEventsByDialogue = eventsByDialogueId(input.predictionRows);
  const eventDetails = input.eventDetails.map((event) =>
    normalizeEventComparison(
      event,
      summary.artifact,
      rowIndexByDialogue,
      goldEventsByDialogue,
      predEventsByDialogue
    )
  );

  return { summary, rowAudits: initialRowAudits, eventDetails };
}
