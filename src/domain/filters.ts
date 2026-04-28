import type { AnnotationMap } from "./annotations";
import type { DialogueReview, ReviewStatus } from "./types";

export type ReviewStatusFilter = ReviewStatus | "all";
export type EvaluationStatusFilter =
  | "all"
  | "fully_matched"
  | "unmatched_gold"
  | "unmatched_prediction"
  | "zero_prediction"
  | "failure";

export interface FilterInput {
  dialogues: DialogueReview[];
  annotations: AnnotationMap;
  search: string;
  reviewStatus: ReviewStatusFilter;
  evaluationStatus: EvaluationStatusFilter;
}

function reviewStatusFor(dialogue: DialogueReview, annotations: AnnotationMap): ReviewStatus {
  return annotations[dialogue.dialogue_id]?.review_status ?? "unreviewed";
}

function matchesEvaluationStatus(
  dialogue: DialogueReview,
  evaluationStatus: EvaluationStatusFilter
): boolean {
  if (evaluationStatus === "all") return true;
  if (evaluationStatus === "failure") return Boolean(dialogue.failure);

  const audit = dialogue.rowAudit;
  if (!audit) return false;

  if (evaluationStatus === "fully_matched") {
    return audit.unmatched_gold === 0 && audit.unmatched_pred === 0;
  }
  if (evaluationStatus === "unmatched_gold") return audit.unmatched_gold > 0;
  if (evaluationStatus === "unmatched_prediction") return audit.unmatched_pred > 0;
  if (evaluationStatus === "zero_prediction") {
    return audit.gold_event_count > 0 && audit.pred_event_count === 0;
  }

  return true;
}

export function filterDialogues(input: FilterInput): DialogueReview[] {
  const search = input.search.trim();

  return input.dialogues.filter((dialogue) => {
    const matchesSearch =
      search.length === 0 || dialogue.dialogue_id.includes(search);
    const matchesReview =
      input.reviewStatus === "all" ||
      reviewStatusFor(dialogue, input.annotations) === input.reviewStatus;
    const matchesEvaluation = matchesEvaluationStatus(dialogue, input.evaluationStatus);

    return matchesSearch && matchesReview && matchesEvaluation;
  });
}
