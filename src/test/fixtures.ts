import type {
  EvaluationSummary,
  FailureRecord,
  PredictionRow,
  RowAudit
} from "../domain/types";

export const summaryFixture: EvaluationSummary = {
  artifact: "google_gemma_4_31B_it",
  overall_weighted_f1: 0.3652328807822301,
  field_f1: {
    actor: 0.7251655629139073,
    time: 0.5297418630751964,
    location: 0.5748031496062992,
    action: 0.21030042918454936
  },
  field_metrics: {
    actor: { TP: 438, FP: 75, FN: 257, precision: 0.8538, recall: 0.6302, f1: 0.7252 },
    time: { TP: 236, FP: 106, FN: 313, precision: 0.6901, recall: 0.4299, f1: 0.5297 },
    location: { TP: 73, FP: 45, FN: 63, precision: 0.6186, recall: 0.5368, f1: 0.5748 },
    action: { TP: 98, FP: 232, FN: 504, precision: 0.297, recall: 0.1628, f1: 0.2103 }
  },
  gold_events: 522,
  prediction_events: 330,
  events_evaluated: 537,
  events_matched: 315,
  unmatched_gold: 207,
  unmatched_prediction: 15,
  rows_checked: 200,
  rows_with_unmatched_gold: 140,
  rows_fully_matched: 56,
  rows_with_zero_prediction_events_despite_gold_events: 7,
  events_written: 200,
  extraction_normalization_failures: 0,
  weights: { action: 0.35, actor: 0.3, time: 0.25, location: 0.1 },
  alignment: {
    method: "same dialogue greedy one-to-one soft similarity then exact field scoring",
    threshold: 0.28
  }
};

export const predictionRowsFixture: PredictionRow[] = [
  {
    dialogue_id: "56",
    dialogue: ["speaker_1:我 8 点 起床", "speaker_2:sad"],
    events: []
  }
];

export const rowAuditsFixture: RowAudit[] = [
  {
    row_index: 0,
    dialogue_id: "56",
    gold_event_count: 1,
    pred_event_count: 0,
    matched_events: 0,
    unmatched_gold: 1,
    unmatched_pred: 0,
    events: [
      {
        weighted_f1: 0,
        active_weight: 0.9,
        fields: {
          actor: {
            gold: ["speaker_1"],
            pred: [],
            TP: 0,
            FP: 0,
            FN: 1,
            precision: null,
            recall: 0,
            f1: 0
          },
          time: {
            gold: ["8点"],
            pred: [],
            TP: 0,
            FP: 0,
            FN: 1,
            precision: null,
            recall: 0,
            f1: 0
          },
          location: {
            gold: [],
            pred: [],
            TP: 0,
            FP: 0,
            FN: 0,
            precision: null,
            recall: null,
            f1: null
          },
          action: {
            gold: ["起床"],
            pred: [],
            TP: 0,
            FP: 0,
            FN: 1,
            precision: null,
            recall: 0,
            f1: 0
          }
        },
        artifact: "google_gemma_4_31B_it",
        dialogue_id: "56",
        row_index: 0,
        match_status: "unmatched_gold",
        gold_event_index: 0,
        pred_event_index: null,
        alignment_score: 0,
        gold_event: {
          actor: ["speaker_1"],
          time: ["8点"],
          location: null,
          action: ["起床"],
          digest: "speaker_18点起床"
        },
        pred_event: null
      }
    ]
  }
];

export const failuresFixture: FailureRecord[] = [
  {
    dialogue_id: "56",
    line_number: 1,
    event_index: null,
    reason: "remote provider HTTP 504"
  }
];
