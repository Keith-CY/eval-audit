import type { AnnotationMap } from "../domain/annotations";
import type { EvaluationStatusFilter, ReviewStatusFilter } from "../domain/filters";
import { formatOptionalMetric } from "../domain/format";
import type { DialogueReview } from "../domain/types";

interface DialogueListProps {
  dialogues: DialogueReview[];
  activeDialogueId: string | null;
  annotations: AnnotationMap;
  search: string;
  reviewStatus: ReviewStatusFilter;
  evaluationStatus: EvaluationStatusFilter;
  onSearchChange: (value: string) => void;
  onReviewStatusChange: (value: ReviewStatusFilter) => void;
  onEvaluationStatusChange: (value: EvaluationStatusFilter) => void;
  onSelectDialogue: (dialogueId: string) => void;
}

function dialogueF1(dialogue: DialogueReview): number | null {
  const events = dialogue.rowAudit?.events ?? [];
  if (events.length === 0) return null;

  return events.reduce((total, event) => total + event.weighted_f1, 0) / events.length;
}

export function DialogueList(props: DialogueListProps) {
  return (
    <aside className="dialogue-sidebar" aria-label="Dialogue list">
      <div className="filters">
        <input
          aria-label="Search dialogue id"
          value={props.search}
          onChange={(event) => props.onSearchChange(event.target.value)}
          placeholder="Search dialogue_id"
        />
        <select
          aria-label="Review status filter"
          value={props.reviewStatus}
          onChange={(event) => props.onReviewStatusChange(event.target.value as ReviewStatusFilter)}
        >
          <option value="all">All review statuses</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="accepted">Accepted</option>
          <option value="has_issue">Has issue</option>
          <option value="skip">Skipped</option>
        </select>
        <select
          aria-label="Evaluation status filter"
          value={props.evaluationStatus}
          onChange={(event) =>
            props.onEvaluationStatusChange(event.target.value as EvaluationStatusFilter)
          }
        >
          <option value="all">All evaluation results</option>
          <option value="fully_matched">Fully matched</option>
          <option value="unmatched_gold">Unmatched gold</option>
          <option value="unmatched_prediction">Unmatched prediction</option>
          <option value="zero_prediction">Zero prediction</option>
          <option value="failure">Failure</option>
        </select>
      </div>
      <div className="dialogue-list">
        {props.dialogues.length === 0 ? (
          <p className="empty-list">No matching dialogues</p>
        ) : (
          props.dialogues.map((dialogue) => {
            const audit = dialogue.rowAudit;
            const status = props.annotations[dialogue.dialogue_id]?.review_status ?? "unreviewed";

            return (
              <button
                key={dialogue.dialogue_id}
                aria-current={dialogue.dialogue_id === props.activeDialogueId ? "true" : undefined}
                className={
                  dialogue.dialogue_id === props.activeDialogueId
                    ? "dialogue-list-item active"
                    : "dialogue-list-item"
                }
                type="button"
                onClick={() => props.onSelectDialogue(dialogue.dialogue_id)}
              >
                <span>Dialogue {dialogue.dialogue_id}</span>
                <small>
                  gold {audit?.gold_event_count ?? "-"} / pred {audit?.pred_event_count ?? "-"} /
                  matched {audit?.matched_events ?? "-"} / F1{" "}
                  {formatOptionalMetric(dialogueF1(dialogue))}
                </small>
                <small>
                  {status}
                  {dialogue.failure ? " / failure" : ""}
                </small>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
