import { formatOptionalMetric } from "../domain/format";
import type {
  DialogueReview,
  EventComparison,
  FieldComparison,
  FieldName
} from "../domain/types";

interface DialogueDetailProps {
  dialogue: DialogueReview | null;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

const fields: FieldName[] = ["actor", "time", "location", "action"];
const emptyFieldComparison: FieldComparison = {
  gold: [],
  pred: [],
  TP: 0,
  FP: 0,
  FN: 0,
  precision: null,
  recall: null,
  f1: null
};

function values(valuesToRender: string[] | null | undefined): string {
  return Array.isArray(valuesToRender) && valuesToRender.length > 0
    ? valuesToRender.join(", ")
    : "-";
}

function EventComparisonCard({ event }: { event: EventComparison }) {
  return (
    <article className="event-card">
      <div className="event-card-header">
        <strong>{event.match_status ?? "unknown"}</strong>
        <span>F1 {formatOptionalMetric(event.weighted_f1 ?? null)}</span>
      </div>
      <div className="event-pair">
        <div>
          <p className="eyebrow">Gold</p>
          <p>{event.gold_event?.digest ?? "-"}</p>
        </div>
        <div>
          <p className="eyebrow">Prediction</p>
          <p>{event.pred_event?.digest ?? "-"}</p>
        </div>
      </div>
      <div className="field-grid">
        {fields.map((field) => {
          const comparison = event.fields?.[field] ?? emptyFieldComparison;
          return (
            <div className="field-row" key={field}>
              <strong>{field}</strong>
              <span>gold: {values(comparison.gold)}</span>
              <span>pred: {values(comparison.pred)}</span>
              <span>
                TP {comparison.TP ?? 0} / FP {comparison.FP ?? 0} / FN {comparison.FN ?? 0} / F1{" "}
                {formatOptionalMetric(comparison.f1 ?? null)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function DialogueDetail({
  dialogue,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext
}: DialogueDetailProps) {
  if (!dialogue) {
    return (
      <section className="detail-pane empty-state">
        <p className="eyebrow">Current dialogue</p>
        <h2>No dialogues match the current filters</h2>
      </section>
    );
  }

  const audit = dialogue.rowAudit;

  return (
    <section className="detail-pane">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Current dialogue</p>
          <h2>Dialogue {dialogue.dialogue_id}</h2>
          <p>
            gold {audit?.gold_event_count ?? "-"} / pred {audit?.pred_event_count ?? "-"} /
            matched {audit?.matched_events ?? "-"} / unmatched gold {audit?.unmatched_gold ?? "-"} /
            unmatched pred {audit?.unmatched_pred ?? "-"}
          </p>
        </div>
        <div className="nav-buttons">
          <button type="button" disabled={!canGoPrevious} onClick={onPrevious}>
            Previous
          </button>
          <button type="button" disabled={!canGoNext} onClick={onNext}>
            Next
          </button>
        </div>
      </div>
      {dialogue.failure ? <div className="failure-box">{dialogue.failure.reason}</div> : null}
      <section className="dialogue-text">
        {dialogue.dialogue.map((line, index) => (
          <p key={`${dialogue.dialogue_id}-${index}`}>{line}</p>
        ))}
      </section>
      <section className="events-stack">
        {audit?.events.map((event, index) => (
          <EventComparisonCard key={`${event.match_status}-${index}`} event={event} />
        ))}
      </section>
    </section>
  );
}
