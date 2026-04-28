export type ReviewStatus = "unreviewed" | "accepted" | "has_issue" | "skip";

export const REVIEW_STATUSES: ReviewStatus[] = [
  "unreviewed",
  "accepted",
  "has_issue",
  "skip"
];

export type FieldName = "actor" | "time" | "location" | "action";

export type KnownMatchStatus = "matched" | "unmatched_gold" | "unmatched_prediction";

export interface ExtractedEvent {
  actor?: string[] | null;
  time?: string[] | null;
  location?: string[] | null;
  action?: string[] | null;
  digest?: string;
  source_order?: number;
}

export interface PredictionRow {
  dialogue_id: string;
  dialogue: string[];
  events: ExtractedEvent[];
}

export interface FieldComparison {
  gold: string[];
  pred: string[];
  TP: number;
  FP: number;
  FN: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface EventComparison {
  weighted_f1: number;
  active_weight: number;
  fields: Record<FieldName, FieldComparison>;
  artifact: string;
  dialogue_id: string;
  row_index: number;
  match_status: KnownMatchStatus | (string & {});
  gold_event_index: number | null;
  pred_event_index: number | null;
  alignment_score: number;
  gold_event: ExtractedEvent | null;
  pred_event: ExtractedEvent | null;
}

export interface RowAudit {
  row_index: number;
  dialogue_id: string;
  gold_event_count: number;
  pred_event_count: number;
  matched_events: number;
  unmatched_gold: number;
  unmatched_pred: number;
  events: EventComparison[];
}

export interface FieldMetrics {
  TP: number;
  FP: number;
  FN: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvaluationSummary {
  artifact: string;
  overall_weighted_f1: number;
  field_f1: Record<FieldName, number>;
  field_metrics: Record<FieldName, FieldMetrics>;
  gold_events: number;
  prediction_events: number;
  events_evaluated: number;
  events_matched: number;
  unmatched_gold: number;
  unmatched_prediction: number;
  rows_checked: number;
  rows_with_unmatched_gold: number;
  rows_fully_matched: number;
  rows_with_zero_prediction_events_despite_gold_events: number;
  events_written: number;
  extraction_normalization_failures: number;
  weights: Record<FieldName, number>;
  alignment: {
    method: string;
    threshold: number;
  };
}

export interface FailureRecord {
  dialogue_id: string;
  line_number: number;
  event_index: number | null;
  reason: string;
}

export interface Annotation {
  artifact: string;
  dialogue_id: string;
  row_index: number;
  review_status: ReviewStatus;
  review_note: string;
  updated_at: string;
}

export interface DialogueReview {
  row_index: number;
  dialogue_id: string;
  dialogue: string[];
  goldEvents: ExtractedEvent[];
  predEvents: ExtractedEvent[];
  rowAudit: RowAudit | null;
  failure: FailureRecord | null;
}

export interface ReviewDataset {
  artifact: string;
  summary: EvaluationSummary;
  dialogues: DialogueReview[];
  warnings: string[];
}
