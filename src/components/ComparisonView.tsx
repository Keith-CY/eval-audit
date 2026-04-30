import { useEffect, useMemo, useState } from "react";
import { dialogueF1 } from "../domain/dialogueMetrics";
import { formatCount, formatOptionalMetric } from "../domain/format";
import type { DialogueReview, ExtractedEvent, FieldName, LoadedEvaluation } from "../domain/types";

interface ComparisonViewProps {
  evaluations: LoadedEvaluation[];
}

const fields: FieldName[] = ["actor", "time", "location", "action"];

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

function EventList({ events }: { events: ExtractedEvent[] }) {
  if (events.length === 0) {
    return <p className="empty-list">No events</p>;
  }

  return (
    <div className="comparison-event-list">
      {events.map((event, index) => (
        <article className="comparison-event" key={`${eventText(event)}-${index}`}>
          <strong>Event {index + 1}</strong>
          <p>{eventText(event)}</p>
          <small>
            actor {values(event.actor)} / time {values(event.time)} / location{" "}
            {values(event.location)} / action {values(event.action)}
          </small>
        </article>
      ))}
    </div>
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
  const resultRows = evaluations.map((evaluation) => ({
    evaluation,
    dialogue: activeId ? findDialogue(evaluation, activeId) : null
  }));
  const referenceDialogue = resultRows.find((result) => result.dialogue)?.dialogue ?? null;
  const goldEvents = goldEventsFor(resultRows.map((result) => result.dialogue));

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
          {resultRows.map(({ evaluation, dialogue }, index) => {
            const audit = dialogue?.rowAudit ?? null;

            return (
              <section className="comparison-column" key={evaluation.id}>
                <h3>Eval {index + 1}</h3>
                <p className="comparison-artifact">{evaluation.dataset.artifact}</p>
                <small>{evaluation.fileName}</small>
                <div className="comparison-metrics">
                  <span>F1 {formatOptionalMetric(dialogueF1(dialogue))}</span>
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
                <EventList events={dialogue?.predEvents ?? []} />
              </section>
            );
          })}
        </div>
      </section>
    </section>
  );
}
