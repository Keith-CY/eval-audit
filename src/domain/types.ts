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

export interface EventNote {
  event_key: string;
  event_index: number;
  match_status: string;
  gold_event_index: number | null;
  pred_event_index: number | null;
  note: string;
}

export interface Annotation {
  artifact: string;
  dialogue_id: string;
  row_index: number;
  review_status: ReviewStatus;
  review_note: string;
  event_notes: EventNote[];
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

export interface FlatEventRecord extends ExtractedEvent {
  source: string;
  dialogue_id: string;
  outcome: string | null;
  typed_score: number | null;
  event_index: number | null;
}

export interface FlatEventsDialogue {
  dialogue_id: string;
  outcome: string | null;
  outcomes: string[];
  typedScores: Record<string, number | null>;
  eventsBySource: Record<string, FlatEventRecord[]>;
  totalEvents: number;
  dialogue?: string[] | null;
}

export interface FlatEventsDataset {
  artifact: string;
  totalEvents: number;
  sources: string[];
  sourceCounts: Record<string, number>;
  outcomeCounts: Record<string, number>;
  dialogues: FlatEventsDialogue[];
  warnings: string[];
  hasDialogueText?: boolean;
}

export type SemanticAuditImportSource =
  | {
      kind: "zip";
      fileName: string;
      size: number;
      lastModified: number;
    }
  | {
      kind: "github";
      owner: string;
      repo: string;
      ref: string;
      path: string;
    };

export interface SemanticFieldMetric {
  weight: number;
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
}

export interface SemanticAuditSummary {
  overallWeightedF1: number;
  strictEventRowAverageF1: number;
  softSemanticEventPrecision: number;
  softSemanticEventRecall: number;
  softSemanticEventF1: number;
  matchedEventQuality: number;
  eventsEvaluated: number;
  eventsMatched: number;
  eventsUnmatchedGold: number;
  eventsUnmatchedPred: number;
  fieldMetrics: Record<FieldName, SemanticFieldMetric>;
  judgeModelId: string | null;
  judgePromptVersion: string | null;
}

export interface SemanticMatch {
  gold_value: string;
  pred_value: string;
  score: number;
}

export interface SemanticFieldComparison {
  gold: string[];
  pred: string[];
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  semantic_matches?: SemanticMatch[];
}

export interface SemanticJudgeAudit {
  dialogue_id: string;
  kind: "event" | "field" | (string & {});
  field_name: FieldName | null;
  comparison_type: string | null;
  gold_event_index: number | null;
  pred_event_index: number | null;
  gold_value: string | null;
  pred_value: string | null;
  gold_values?: string[] | null;
  pred_values?: string[] | null;
  equivalent: boolean | null;
  confidence: number | null;
  reason_code: string | null;
  short_reason: string | null;
  source: string | null;
  status: string | null;
  cache_key: string | null;
}

export interface SemanticCandidateScore {
  gold_event_index: number;
  pred_event_index: number;
  alignment_score: number;
  accepted: boolean;
  source: string | null;
  reason_code: string | null;
  local_alignment_score: number | null;
}

export interface SemanticRowAudit {
  dialogue_id: string;
  alignment_strategy: string | null;
  gold_event_count: number;
  pred_event_count: number;
  matched_pairs: Array<{
    gold_event_index: number;
    pred_event_index: number;
    alignment_score: number;
  }>;
  unmatched_gold_indices: number[];
  unmatched_pred_indices: number[];
  candidate_scores: SemanticCandidateScore[];
  low_quality_alignment: boolean;
  low_quality_alignment_threshold: number | null;
  low_quality_alignment_pairs: unknown[];
}

export type SemanticMatchStatus = "matched" | "unmatched_gold" | "unmatched_pred" | (string & {});

export interface SemanticEventComparison {
  dialogue_id: string;
  event_index: number;
  gold_event_index: number | null;
  pred_event_index: number | null;
  match_status: SemanticMatchStatus;
  weighted_f1: number;
  active_weight: number;
  alignment_score: number;
  semantic_alignment_score: number;
  alignment_fields: Partial<Record<FieldName, number>>;
  fields: Record<FieldName, SemanticFieldComparison>;
  goldEvent: FlatEventRecord | null;
  predEvent: FlatEventRecord | null;
  eventJudge: SemanticJudgeAudit | null;
  fieldJudges: Record<FieldName, SemanticJudgeAudit[]>;
}

export interface SemanticAuditDialogue {
  dialogue_id: string;
  outcome: string | null;
  typedScores: Record<string, number | null>;
  goldEvents: FlatEventRecord[];
  predEvents: FlatEventRecord[];
  baseEvents: FlatEventRecord[];
  comparisons: SemanticEventComparison[];
  rowAudit: SemanticRowAudit | null;
  totalEvents: number;
  unmatchedGold: number;
  unmatchedPred: number;
  matched: number;
  averageWeightedF1: number;
  hasLowQualityAlignment: boolean;
}

export interface SemanticEventAuditDataset {
  artifact: string;
  artifactId: string;
  importSource: SemanticAuditImportSource;
  runId: string | null;
  targetSource: "lora";
  summary: SemanticAuditSummary;
  dialogues: SemanticAuditDialogue[];
  warnings: string[];
}

export interface GoldTopicWarning {
  code: string;
  message: string;
}

export interface GoldTopic {
  gold_topic_id: string;
  label: string;
  description: string;
  required_message_ids: string[];
  topic_weight: number | null;
  boundary_mode: string | null;
  criticality: string | null;
  optional_bridge_message_ids: string[];
  allowed_multi_topic_message_ids: string[];
  may_merge_with: string[];
  may_split_into: string[];
}

export interface GoldTopicMessage {
  message_id: string;
  sender: string;
  text: string;
  timestamp: string | null;
  requiredTopicIds: string[];
  isForbiddenUnassigned: boolean;
  isAllowedUnassigned: boolean;
}

export interface GoldTopicCase {
  gold_case_id: string;
  source_dialogue_id: string | null;
  source_conversation_id: string | null;
  expected_topic_count_range: [number, number] | null;
  allowed_duplicate_message_ids: string[];
  allowed_fallback_reasons: string[];
  expected_skip_or_fallback_reasons: string[];
  allowed_unassigned_message_ids: string[];
  forbidden_unassigned_message_ids: string[];
  notes: string[];
  slices: string[];
  gold_version: string | null;
  case_weight: number | null;
  messages: GoldTopicMessage[];
  topics: GoldTopic[];
  warnings: GoldTopicWarning[];
  attentionScore: number;
  attentionReasons: string[];
}

export interface GoldTopicDatasetSummary {
  totalCases: number;
  totalMessages: number;
  totalTopics: number;
  averageMessagesPerCase: number;
  averageTopicsPerCase: number;
  casesWithWarnings: number;
  casesWithAllowedUnassigned: number;
  casesWithFallback: number;
}

export interface GoldTopicDataset {
  artifact: string;
  cases: GoldTopicCase[];
  summary: GoldTopicDatasetSummary;
  warnings: GoldTopicWarning[];
}

export type GoldTopicNoteScope = "case" | "message";

export interface GoldTopicNoteExport {
  artifact: string;
  gold_case_id: string;
  source_dialogue_id: string | null;
  scope: GoldTopicNoteScope;
  message_id: string | null;
  note: string;
  updated_at: string;
}
