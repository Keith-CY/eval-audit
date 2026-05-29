import { type ReactNode, useMemo, useState } from "react";
import type { FlatEventRecord, FlatEventsDataset } from "../domain/types";

interface FlatEventsWorkbenchProps {
  dataset: FlatEventsDataset;
}

function values(valuesToRender: string[] | null | undefined): string {
  return Array.isArray(valuesToRender) && valuesToRender.length > 0
    ? valuesToRender.join(", ")
    : "-";
}

function score(value: number | null | undefined): string {
  return typeof value === "number" ? value.toFixed(4) : "-";
}

const preferredSourceOrder = ["gold", "base", "lora"];
const highlightFields = ["actor", "time", "location", "action"] as const;

function compareSources(a: string, b: string): number {
  const aIndex = preferredSourceOrder.indexOf(a);
  const bIndex = preferredSourceOrder.indexOf(b);

  if (aIndex >= 0 || bIndex >= 0) {
    return (aIndex >= 0 ? aIndex : preferredSourceOrder.length) -
      (bIndex >= 0 ? bIndex : preferredSourceOrder.length);
  }

  return a.localeCompare(b);
}

function normalizeTerm(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueTerms(valuesToCollect: string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const value of valuesToCollect) {
    const term = value.trim();
    const normalized = normalizeTerm(term);

    if (!term || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    terms.push(term);
  }

  return terms;
}

function isCjkTerm(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

function isUsefulTerm(value: string): boolean {
  return isCjkTerm(value) ? value.trim().length > 0 : value.trim().length > 1;
}

function visibleFieldValues(event: FlatEventRecord): string[] {
  return highlightFields.flatMap((field) => event[field] ?? []);
}

function tokenTerms(value: string): string[] {
  return value.match(/[A-Za-z0-9_]+|[\p{Script=Han}]+|[\p{Letter}\p{Number}_-]+/gu) ?? [];
}

function termsForEvent(event: FlatEventRecord): string[] {
  const fieldTerms = visibleFieldValues(event);
  const tokenizedTerms = fieldTerms.flatMap(tokenTerms);

  return uniqueTerms([...fieldTerms, ...tokenizedTerms])
    .filter(isUsefulTerm)
    .sort((a, b) => b.length - a.length);
}

function sharedTerm(left: string, right: string): string | null {
  const normalizedLeft = normalizeTerm(left);
  const normalizedRight = normalizeTerm(right);

  if (normalizedLeft === normalizedRight) {
    return left.length <= right.length ? left : right;
  }

  if (normalizedLeft.includes(normalizedRight) && isUsefulTerm(right)) {
    return right;
  }

  if (normalizedRight.includes(normalizedLeft) && isUsefulTerm(left)) {
    return left;
  }

  return null;
}

function sharedTermsForEvent(event: FlatEventRecord, visibleEvents: FlatEventRecord[]): string[] {
  const eventTerms = termsForEvent(event);
  const otherTerms = visibleEvents
    .filter((visibleEvent) => visibleEvent !== event)
    .flatMap(termsForEvent);
  const sharedTerms: string[] = [];

  for (const eventTerm of eventTerms) {
    for (const otherTerm of otherTerms) {
      const term = sharedTerm(eventTerm, otherTerm);

      if (term) {
        sharedTerms.push(term);
      }
    }
  }

  return uniqueTerms(sharedTerms).sort((a, b) => b.length - a.length);
}

function isAsciiWordTerm(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value);
}

function isAsciiWordChar(value: string | undefined): boolean {
  return typeof value === "string" && /^[A-Za-z0-9_]$/.test(value);
}

function canMatchTermAt(text: string, term: string, startIndex: number): boolean {
  if (!isAsciiWordTerm(term)) {
    return true;
  }

  const before = startIndex > 0 ? text[startIndex - 1] : undefined;
  const after = text[startIndex + term.length];

  return !isAsciiWordChar(before) && !isAsciiWordChar(after);
}

function highlightedText(text: string, terms: string[]) {
  const usableTerms = uniqueTerms(terms).filter((term) =>
    normalizeTerm(text).includes(normalizeTerm(term))
  );

  if (usableTerms.length === 0) {
    return text;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const match = usableTerms.find((term) => {
      const candidate = text.slice(cursor, cursor + term.length);

      return normalizeTerm(candidate) === normalizeTerm(term) && canMatchTermAt(text, term, cursor);
    });

    if (match) {
      parts.push(<mark key={`${match}-${cursor}`}>{text.slice(cursor, cursor + match.length)}</mark>);
      cursor += match.length;
      continue;
    }

    const previous = parts[parts.length - 1];
    const currentChar = text[cursor];

    if (typeof previous === "string") {
      parts[parts.length - 1] = previous + currentChar;
    } else {
      parts.push(currentChar);
    }

    cursor += 1;
  }

  return parts;
}

interface EventRowProps {
  event: FlatEventRecord;
  activeTerms: string[];
  onHover: (event: FlatEventRecord) => void;
  onLeave: () => void;
}

function EventRow({ event, activeTerms, onHover, onLeave }: EventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const digest = event.digest ?? "-";

  return (
    <article
      aria-label={`${event.source} event ${event.event_index ?? "-"}`}
      className="flat-event-row"
      onMouseEnter={() => onHover(event)}
      onMouseLeave={onLeave}
    >
      <div className="flat-event-header">
        <strong>#{event.event_index ?? "-"}</strong>
        <button
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} digest for ${event.source} event ${
            event.event_index ?? "-"
          }`}
          className="flat-digest-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          Digest
        </button>
      </div>
      <dl className="flat-event-fields">
        <div>
          <dt>actor</dt>
          <dd>{highlightedText(values(event.actor), activeTerms)}</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd>{highlightedText(values(event.time), activeTerms)}</dd>
        </div>
        <div>
          <dt>location</dt>
          <dd>{highlightedText(values(event.location), activeTerms)}</dd>
        </div>
        <div>
          <dt>action</dt>
          <dd>{highlightedText(values(event.action), activeTerms)}</dd>
        </div>
      </dl>
      {expanded ? (
        <p className="flat-event-digest">{highlightedText(digest, activeTerms)}</p>
      ) : null}
    </article>
  );
}

export function FlatEventsWorkbench({ dataset }: FlatEventsWorkbenchProps) {
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(
    dataset.dialogues[0]?.dialogue_id ?? null
  );
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [activeTerms, setActiveTerms] = useState<string[]>([]);

  const outcomes = useMemo(
    () => Object.keys(dataset.outcomeCounts).sort((a, b) => a.localeCompare(b)),
    [dataset.outcomeCounts]
  );
  const orderedSources = useMemo(() => [...dataset.sources].sort(compareSources), [dataset.sources]);
  const filteredDialogues = useMemo(
    () =>
      dataset.dialogues.filter((dialogue) => {
        const matchesSearch = dialogue.dialogue_id.toLowerCase().includes(search.toLowerCase());
        const matchesOutcome = outcomeFilter === "all" || dialogue.outcomes.includes(outcomeFilter);

        return matchesSearch && matchesOutcome;
      }),
    [dataset.dialogues, outcomeFilter, search]
  );
  const activeDialogue =
    filteredDialogues.find((dialogue) => dialogue.dialogue_id === activeDialogueId) ??
    filteredDialogues[0] ??
    null;
  const visibleEvents = useMemo(
    () =>
      activeDialogue
        ? orderedSources.flatMap((source) => activeDialogue.eventsBySource[source] ?? [])
        : [],
    [activeDialogue, orderedSources]
  );

  return (
    <section className="flat-workbench" aria-label="Flat events workbench">
      <div className="flat-summary-band">
        <div className="metric-card">
          <p className="eyebrow">Artifact</p>
          <h1>{dataset.artifact}</h1>
          <small>{orderedSources.join(" / ")}</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Dialogues</p>
          <strong>{dataset.dialogues.length}</strong>
          <small>{filteredDialogues.length} visible</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Events</p>
          <strong>{dataset.totalEvents}</strong>
          <small>{orderedSources.length} sources</small>
        </div>
        {orderedSources.map((source) => (
          <div className="metric-card" key={source}>
            <p className="eyebrow">{source}</p>
            <strong>{dataset.sourceCounts[source] ?? 0}</strong>
            <small>events</small>
          </div>
        ))}
      </div>
      {dataset.warnings.length > 0 ? (
        <div className="warning-strip" role="status" aria-label="Flat events warnings">
          {dataset.warnings.join(" ")}
        </div>
      ) : null}
      <div className="flat-events-grid">
        <aside className="dialogue-sidebar" aria-label="Flat dialogue list">
          <div className="filters">
            <input
              aria-label="Search flat dialogue id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dialogue_id"
            />
            <select
              aria-label="Outcome filter"
              value={outcomeFilter}
              onChange={(event) => setOutcomeFilter(event.target.value)}
            >
              <option value="all">All outcomes</option>
              {outcomes.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </div>
          <div className="dialogue-list">
            {filteredDialogues.length === 0 ? (
              <p className="empty-list">No matching dialogues</p>
            ) : (
              filteredDialogues.map((dialogue) => (
                <button
                  key={dialogue.dialogue_id}
                  aria-current={
                    dialogue.dialogue_id === activeDialogue?.dialogue_id ? "true" : undefined
                  }
                  className={
                    dialogue.dialogue_id === activeDialogue?.dialogue_id
                      ? "dialogue-list-item active"
                      : "dialogue-list-item"
                  }
                  type="button"
                  onClick={() => setActiveDialogueId(dialogue.dialogue_id)}
                >
                  <span>Dialogue {dialogue.dialogue_id}</span>
                  <small>
                    {dialogue.totalEvents} events / {dialogue.outcome ?? "-"}
                  </small>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="detail-pane flat-detail-pane" aria-label="Flat event detail">
          {activeDialogue ? (
            <>
              <div className="detail-header">
                <div className="detail-title">
                  <p className="eyebrow">Current dialogue</p>
                  <h2>Dialogue {activeDialogue.dialogue_id}</h2>
                  <p>
                    {activeDialogue.totalEvents} events / outcome {activeDialogue.outcome ?? "-"}
                  </p>
                </div>
              </div>
              <div className="source-columns">
                {orderedSources.map((source) => {
                  const events = activeDialogue.eventsBySource[source] ?? [];

                  return (
                    <section className="source-column" key={source} aria-label={`${source} events`}>
                      <div className="source-column-header">
                        <strong>{source}</strong>
                        <span>
                          {events.length} events / typed score{" "}
                          {score(activeDialogue.typedScores[source])}
                        </span>
                      </div>
                      <div className="flat-event-stack">
                        {events.length === 0 ? (
                          <p className="empty-list">No events</p>
                        ) : (
                          events.map((event, index) => (
                            <EventRow
                              activeTerms={activeTerms}
                              event={event}
                              key={`${source}-${event.event_index ?? index}-${event.digest ?? ""}`}
                              onHover={(hoveredEvent) =>
                                setActiveTerms(sharedTermsForEvent(hoveredEvent, visibleEvents))
                              }
                              onLeave={() => setActiveTerms([])}
                            />
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p className="eyebrow">Current dialogue</p>
              <h2>No dialogues match the current filters</h2>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
