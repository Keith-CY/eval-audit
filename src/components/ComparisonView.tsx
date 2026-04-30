import { useEffect, useMemo, useState } from "react";
import { dialogueF1 } from "../domain/dialogueMetrics";
import { formatCount, formatOptionalMetric } from "../domain/format";
import type {
  DialogueReview,
  EventComparison,
  ExtractedEvent,
  FieldComparison,
  FieldName,
  LoadedEvaluation
} from "../domain/types";

interface ComparisonViewProps {
  evaluations: LoadedEvaluation[];
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

interface ScoreRange {
  best: number | null;
  worst: number | null;
  hasSpread: boolean;
}

interface EventScoreBadge {
  ariaLabel: string;
  range: ScoreRange | undefined;
  score: number | null | undefined;
}

function scoreRange(scores: Array<number | null | undefined>): ScoreRange {
  const finiteScores = scores.filter(
    (score): score is number => typeof score === "number" && Number.isFinite(score)
  );

  if (finiteScores.length < 2) {
    return { best: null, worst: null, hasSpread: false };
  }

  const best = Math.max(...finiteScores);
  const worst = Math.min(...finiteScores);

  return { best, worst, hasSpread: best !== worst };
}

function scoreClass(
  score: number | null | undefined,
  range: ScoreRange | undefined
): "score-best" | "score-worst" | undefined {
  if (!range?.hasSpread || typeof score !== "number" || !Number.isFinite(score)) {
    return undefined;
  }

  if (score === range.best) return "score-best";
  if (score === range.worst) return "score-worst";

  return undefined;
}

function fieldRangeKey(eventIndex: number, field: FieldName): string {
  return `${eventIndex}:${field}`;
}

function values(valuesToRender: string[] | null | undefined): string {
  return Array.isArray(valuesToRender) && valuesToRender.length > 0
    ? valuesToRender.join(", ")
    : "-";
}

function eventText(event: ExtractedEvent): string {
  if (event.digest) return event.digest;

  const parts = fields
    .map((field) => values(event[field]))
    .filter((value) => value !== "-");

  return parts.length > 0 ? parts.join(" | ") : "-";
}

function dialogueIds(evaluations: LoadedEvaluation[]): string[] {
  const order = new Map<string, number>();

  for (const evaluation of evaluations) {
    for (const dialogue of evaluation.dataset.dialogues) {
      const currentOrder = order.get(dialogue.dialogue_id);
      if (currentOrder === undefined || dialogue.row_index < currentOrder) {
        order.set(dialogue.dialogue_id, dialogue.row_index);
      }
    }
  }

  return Array.from(order.entries())
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .map(([dialogueId]) => dialogueId);
}

function findDialogue(evaluation: LoadedEvaluation, dialogueId: string): DialogueReview | null {
  return (
    evaluation.dataset.dialogues.find((dialogue) => dialogue.dialogue_id === dialogueId) ?? null
  );
}

function goldEventsFor(dialogues: Array<DialogueReview | null>): ExtractedEvent[] {
  const dialogueWithGold = dialogues.find((dialogue) => (dialogue?.goldEvents.length ?? 0) > 0);
  if (dialogueWithGold) return dialogueWithGold.goldEvents;

  return (
    dialogues
      .find((dialogue) => (dialogue?.rowAudit?.events.length ?? 0) > 0)
      ?.rowAudit?.events.flatMap((event) => (event.gold_event ? [event.gold_event] : [])) ?? []
  );
}

function eventScoreBadgesFor(
  dialogue: DialogueReview | null,
  label: string,
  eventScoreRanges: Map<number, ScoreRange>
): EventScoreBadge[] {
  const auditEvents = dialogue?.rowAudit?.events ?? [];
  const visibleEvents = dialogue?.predEvents ?? [];

  return visibleEvents.map((_, predIndex) => {
    const matchedAuditIndex = auditEvents.findIndex((event) => event.pred_event_index === predIndex);
    const eventIndex = matchedAuditIndex >= 0 ? matchedAuditIndex : predIndex;
    const auditEvent = auditEvents[eventIndex];

    return {
      ariaLabel: `${label} event digest ${predIndex + 1} score`,
      range: eventScoreRanges.get(eventIndex),
      score: auditEvent?.weighted_f1
    };
  });
}

function EventList({
  events,
  scoreBadges = []
}: {
  events: ExtractedEvent[];
  scoreBadges?: EventScoreBadge[];
}) {
  if (events.length === 0) {
    return <p className="empty-list">No events</p>;
  }

  return (
    <div className="comparison-event-list">
      {events.map((event, index) => {
        const scoreBadge = scoreBadges[index] ?? null;
        const scoreTone = scoreClass(scoreBadge?.score, scoreBadge?.range);

        return (
          <article className="comparison-event" key={`${eventText(event)}-${index}`}>
            <div className="comparison-event-header">
              <strong>Event {index + 1}</strong>
              {typeof scoreBadge?.score === "number" && Number.isFinite(scoreBadge.score) ? (
                <span
                  aria-label={scoreBadge.ariaLabel}
                  className={
                    scoreTone
                      ? `comparison-event-score ${scoreTone}`
                      : "comparison-event-score"
                  }
                >
                  Event Level F1 {formatOptionalMetric(scoreBadge.score)}
                </span>
              ) : null}
            </div>
            <p>{eventText(event)}</p>
            <small>
              actor {values(event.actor)} / time {values(event.time)} / location{" "}
              {values(event.location)} / action {values(event.action)}
            </small>
          </article>
        );
      })}
    </div>
  );
}

function FieldComparisonRows({
  events,
  label,
  eventScoreRanges,
  fieldScoreRanges
}: {
  events: EventComparison[];
  label: string;
  eventScoreRanges: Map<number, ScoreRange>;
  fieldScoreRanges: Map<string, ScoreRange>;
}) {
  if (events.length === 0) {
    return <p className="empty-list">No field comparisons</p>;
  }

  return (
    <section className="field-comparison" aria-label={`${label} field comparison`}>
      <h4>Field comparison</h4>
      {events.map((event, eventIndex) => (
        <article className="comparison-field-event" key={`${event.match_status}-${eventIndex}`}>
          <div className="event-card-header">
            <strong>Event {eventIndex + 1}</strong>
            <span
              aria-label={`${label} event ${eventIndex + 1} score`}
              className={scoreClass(event.weighted_f1, eventScoreRanges.get(eventIndex))}
            >
              {event.match_status} / F1 {formatOptionalMetric(event.weighted_f1 ?? null)}
            </span>
          </div>
          <div className="comparison-field-grid">
            {fields.map((field) => {
              const comparison = event.fields?.[field] ?? emptyFieldComparison;

              return (
                <div className="comparison-field-row" key={field}>
                  <strong>{field}</strong>
                  <span>gold: {values(comparison.gold)}</span>
                  <span>pred: {values(comparison.pred)}</span>
                  <span
                    aria-label={`${label} event ${eventIndex + 1} ${field} score`}
                    className={scoreClass(
                      comparison.f1,
                      fieldScoreRanges.get(fieldRangeKey(eventIndex, field))
                    )}
                  >
                    TP {comparison.TP ?? 0} / FP {comparison.FP ?? 0} / FN {comparison.FN ?? 0} /
                    F1 {formatOptionalMetric(comparison.f1 ?? null)}
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </section>
  );
}

export function ComparisonView({ evaluations }: ComparisonViewProps) {
  const allDialogueIds = useMemo(() => dialogueIds(evaluations), [evaluations]);
  const [search, setSearch] = useState("");
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(
    allDialogueIds[0] ?? null
  );

  useEffect(() => {
    setSearch("");
    setActiveDialogueId(allDialogueIds[0] ?? null);
  }, [allDialogueIds]);

  const filteredDialogueIds = useMemo(() => {
    const query = search.trim();
    return query.length === 0
      ? allDialogueIds
      : allDialogueIds.filter((dialogueId) => dialogueId.includes(query));
  }, [allDialogueIds, search]);

  const activeId =
    filteredDialogueIds.find((dialogueId) => dialogueId === activeDialogueId) ??
    filteredDialogueIds[0] ??
    null;
  const activeIndex = activeId ? filteredDialogueIds.indexOf(activeId) : -1;
  const resultRows = evaluations.map((evaluation) => {
    const dialogue = activeId ? findDialogue(evaluation, activeId) : null;

    return {
      evaluation,
      dialogue,
      dialogueScore: dialogueF1(dialogue)
    };
  });
  const referenceDialogue = resultRows.find((result) => result.dialogue)?.dialogue ?? null;
  const goldEvents = goldEventsFor(resultRows.map((result) => result.dialogue));
  const dialogueScoreRange = scoreRange(resultRows.map((result) => result.dialogueScore));
  const eventScoreRanges = new Map<number, ScoreRange>();
  const fieldScoreRanges = new Map<string, ScoreRange>();
  const maxEventCount = Math.max(
    0,
    ...resultRows.map((result) => result.dialogue?.rowAudit?.events.length ?? 0)
  );

  for (let eventIndex = 0; eventIndex < maxEventCount; eventIndex += 1) {
    eventScoreRanges.set(
      eventIndex,
      scoreRange(
        resultRows.map((result) => result.dialogue?.rowAudit?.events[eventIndex]?.weighted_f1)
      )
    );

    for (const field of fields) {
      fieldScoreRanges.set(
        fieldRangeKey(eventIndex, field),
        scoreRange(
          resultRows.map(
            (result) => result.dialogue?.rowAudit?.events[eventIndex]?.fields?.[field]?.f1
          )
        )
      );
    }
  }

  if (!activeId) {
    return (
      <section className="comparison-view">
        <aside className="dialogue-sidebar" aria-label="Comparison dialogue list">
          <input
            aria-label="Search comparison dialogue id"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dialogue_id"
          />
          <p className="empty-list">No matching dialogues</p>
        </aside>
        <section className="detail-pane empty-state">
          <p className="eyebrow">All results</p>
          <h2>No dialogues match the current search</h2>
        </section>
      </section>
    );
  }

  return (
    <section className="comparison-view">
      <aside className="dialogue-sidebar" aria-label="Comparison dialogue list">
        <input
          aria-label="Search comparison dialogue id"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search dialogue_id"
        />
        <div className="dialogue-list">
          {filteredDialogueIds.map((dialogueId) => (
            <button
              key={dialogueId}
              type="button"
              className={
                dialogueId === activeId ? "dialogue-list-item active" : "dialogue-list-item"
              }
              aria-current={dialogueId === activeId ? "true" : undefined}
              onClick={() => setActiveDialogueId(dialogueId)}
            >
              <span>Dialogue {dialogueId}</span>
              <small>{evaluations.length} evaluations</small>
            </button>
          ))}
        </div>
      </aside>
      <section className="comparison-detail" aria-label="All evaluation results">
        <div className="detail-header">
          <div className="detail-title">
            <p className="eyebrow">All results</p>
            <h2>Dialogue {activeId}</h2>
          </div>
          <div className="nav-buttons">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => setActiveDialogueId(filteredDialogueIds[activeIndex - 1])}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={activeIndex < 0 || activeIndex >= filteredDialogueIds.length - 1}
              onClick={() => setActiveDialogueId(filteredDialogueIds[activeIndex + 1])}
            >
              Next
            </button>
          </div>
        </div>
        {referenceDialogue ? (
          <section className="dialogue-text">
            {referenceDialogue.dialogue.map((line, index) => (
              <p key={`${activeId}-${index}`}>{line}</p>
            ))}
          </section>
        ) : null}
        <div className="comparison-columns">
          <section className="comparison-column">
            <h3>Gold</h3>
            <small>{formatCount(goldEvents.length)} events</small>
            <EventList events={goldEvents} />
          </section>
          {resultRows.map(({ evaluation, dialogue, dialogueScore }, index) => {
            const audit = dialogue?.rowAudit ?? null;
            const label = `Eval ${index + 1}`;

            return (
              <section className="comparison-column" key={evaluation.id}>
                <h3>{label}</h3>
                <p className="comparison-artifact">{evaluation.dataset.artifact}</p>
                <small>{evaluation.fileName}</small>
                <div className="comparison-metrics">
                  <span
                    aria-label={`${label} dialogue score`}
                    className={scoreClass(dialogueScore, dialogueScoreRange)}
                  >
                    F1 {formatOptionalMetric(dialogueScore)}
                  </span>
                  <span>
                    gold {audit?.gold_event_count ?? "-"} / pred {audit?.pred_event_count ?? "-"}
                  </span>
                  <span>
                    matched {audit?.matched_events ?? "-"} / unmatched gold{" "}
                    {audit?.unmatched_gold ?? "-"} / unmatched pred {audit?.unmatched_pred ?? "-"}
                  </span>
                </div>
                {dialogue?.failure ? (
                  <div className="failure-box">{dialogue.failure.reason}</div>
                ) : null}
                <EventList
                  events={dialogue?.predEvents ?? []}
                  scoreBadges={eventScoreBadgesFor(dialogue, label, eventScoreRanges)}
                />
                <FieldComparisonRows
                  events={dialogue?.rowAudit?.events ?? []}
                  label={label}
                  eventScoreRanges={eventScoreRanges}
                  fieldScoreRanges={fieldScoreRanges}
                />
              </section>
            );
          })}
        </div>
      </section>
    </section>
  );
}
