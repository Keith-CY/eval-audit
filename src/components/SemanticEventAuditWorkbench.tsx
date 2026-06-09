import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Copy, Download, Trash2 } from "lucide-react";
import type {
  FieldName,
  FlatEventRecord,
  SemanticAuditDialogue,
  SemanticEventAuditDataset,
  SemanticEventComparison,
  SemanticJudgeAudit
} from "../domain/types";

interface SemanticEventAuditWorkbenchProps {
  dataset: SemanticEventAuditDataset;
}

type DialogueSort = "priority" | "id";
type DifferenceSort = "largest-gap" | "soft-gains" | "soft-losses" | "unmatched-first";
type FeedbackMap = Record<string, string>;
type SemanticWorkbenchView = "relations" | "score-difference";

interface DifferenceContributor {
  comparison: SemanticEventComparison;
  delta: number;
  key: string;
  maxFieldDelta: number;
}

interface HighlightRange {
  start: number;
  end: number;
  className: string;
}

const fields: FieldName[] = ["actor", "time", "location", "action"];

function score(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(4) : "-";
}

function signedScore(value: number): string {
  return `${value >= 0 ? "+" : ""}${score(value)}`;
}

function values(valuesToRender: string[] | null | undefined): string {
  return Array.isArray(valuesToRender) && valuesToRender.length > 0
    ? valuesToRender.join(", ")
    : "-";
}

function eventNumber(index: number | null): string {
  return index == null ? "-" : String(index + 1);
}

function storageKey(dataset: SemanticEventAuditDataset): string {
  return `semantic-audit-feedback:${dataset.artifactId}`;
}

function loadFeedback(dataset: SemanticEventAuditDataset): FeedbackMap {
  try {
    const raw = localStorage.getItem(storageKey(dataset));
    return raw ? (JSON.parse(raw) as FeedbackMap) : {};
  } catch {
    return {};
  }
}

function feedbackCount(feedback: FeedbackMap): number {
  return Object.values(feedback).filter((value) => value.trim().length > 0).length;
}

function eventFeedbackKey(comparison: SemanticEventComparison): string {
  const stableKey =
    comparison.eventJudge?.cache_key ??
    `${comparison.match_status}:${comparison.dialogue_id}:${comparison.gold_event_index ?? "none"}:${
      comparison.pred_event_index ?? "none"
    }`;

  return `event:${stableKey}`;
}

function unmatchedFeedbackKey(comparison: SemanticEventComparison): string {
  return `${comparison.match_status}:${comparison.dialogue_id}:${
    comparison.gold_event_index ?? "none"
  }:${comparison.pred_event_index ?? "none"}`;
}

function fieldFeedbackKey(
  comparison: SemanticEventComparison,
  field: FieldName,
  judge: SemanticJudgeAudit,
  index: number
): string {
  return `field:${judge.cache_key ?? `${comparison.dialogue_id}:${field}:${index}`}`;
}

function importSourceLabel(dataset: SemanticEventAuditDataset): string {
  if (dataset.importSource.kind === "github") {
    return `${dataset.importSource.owner}/${dataset.importSource.repo}@${dataset.importSource.ref}/${dataset.importSource.path}`;
  }

  return dataset.importSource.fileName;
}

function sortedDialogues(dialogues: SemanticAuditDialogue[], sort: DialogueSort) {
  return [...dialogues].sort((a, b) => {
    if (sort === "id") {
      return a.dialogue_id.localeCompare(b.dialogue_id, undefined, { numeric: true });
    }

    const aUnmatched = a.unmatchedGold + a.unmatchedPred;
    const bUnmatched = b.unmatchedGold + b.unmatchedPred;

    return (
      Number(bUnmatched > 0) - Number(aUnmatched > 0) ||
      a.averageWeightedF1 - b.averageWeightedF1 ||
      Number(b.hasLowQualityAlignment) - Number(a.hasLowQualityAlignment) ||
      a.dialogue_id.localeCompare(b.dialogue_id, undefined, { numeric: true })
    );
  });
}

function average(valuesToAverage: number[]): number {
  const finiteValues = valuesToAverage.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return 0;
  }

  return finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length;
}

function percent(value: number): string {
  return `${Math.max(0, Math.min(100, value * 100))}%`;
}

function comparisonDelta(comparison: SemanticEventComparison): number {
  return comparison.semantic_alignment_score - comparison.weighted_f1;
}

function fieldSoftAlignment(
  comparison: SemanticEventComparison,
  field: FieldName
): number | null {
  const value = comparison.alignment_fields[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fieldExplanationDelta(
  comparison: SemanticEventComparison,
  field: FieldName
): number | null {
  const softAlignment = fieldSoftAlignment(comparison, field);

  if (softAlignment == null) {
    return null;
  }

  return softAlignment - comparison.fields[field].f1;
}

function strongestFieldDelta(comparison: SemanticEventComparison): number {
  return Math.max(
    0,
    ...fields.map((field) => Math.abs(fieldExplanationDelta(comparison, field) ?? 0))
  );
}

function differenceContributors(dialogue: SemanticAuditDialogue): DifferenceContributor[] {
  return dialogue.comparisons.map((comparison) => {
    const delta = comparison.match_status === "matched" ? comparisonDelta(comparison) : 0;

    return {
      comparison,
      delta,
      key: comparisonKey(comparison),
      maxFieldDelta: strongestFieldDelta(comparison)
    };
  });
}

function sortDifferenceContributors(
  contributors: DifferenceContributor[],
  sort: DifferenceSort
): DifferenceContributor[] {
  return [...contributors].sort((a, b) => {
    if (sort === "unmatched-first") {
      const aUnmatched = a.comparison.match_status === "matched" ? 0 : 1;
      const bUnmatched = b.comparison.match_status === "matched" ? 0 : 1;

      return (
        bUnmatched - aUnmatched ||
        Math.abs(b.delta) - Math.abs(a.delta) ||
        b.maxFieldDelta - a.maxFieldDelta ||
        a.comparison.event_index - b.comparison.event_index
      );
    }

    if (sort === "soft-gains") {
      return (
        b.delta - a.delta ||
        b.maxFieldDelta - a.maxFieldDelta ||
        a.comparison.event_index - b.comparison.event_index
      );
    }

    if (sort === "soft-losses") {
      return (
        a.delta - b.delta ||
        b.maxFieldDelta - a.maxFieldDelta ||
        a.comparison.event_index - b.comparison.event_index
      );
    }

    return (
      Math.max(Math.abs(b.delta), b.maxFieldDelta) -
        Math.max(Math.abs(a.delta), a.maxFieldDelta) ||
      a.comparison.event_index - b.comparison.event_index
    );
  });
}

function lower(value: string): string {
  return value.toLocaleLowerCase();
}

function findAllRanges(text: string, needle: string, className: string): HighlightRange[] {
  const normalizedNeedle = needle.trim();

  if (!normalizedNeedle) {
    return [];
  }

  const haystack = lower(text);
  const target = lower(normalizedNeedle);
  const ranges: HighlightRange[] = [];
  let start = haystack.indexOf(target);

  while (start !== -1) {
    ranges.push({ start, end: start + target.length, className });
    start = haystack.indexOf(target, start + target.length);
  }

  return ranges;
}

function valueHasCoverage(valueStart: number, valueEnd: number, ranges: HighlightRange[]): boolean {
  return ranges.some(
    (range) =>
      range.start < valueEnd &&
      range.end > valueStart &&
      (range.className === "strict-match" || range.className === "soft-match")
  );
}

function highlightRangesForValue(
  detail: SemanticEventComparison["fields"][FieldName],
  side: "gold" | "lora",
  value: string
): HighlightRange[] {
  const otherValues = side === "gold" ? detail.pred : detail.gold;
  const strictValues = otherValues.filter((otherValue) => lower(otherValue) === lower(value));
  const softValues = (detail.semantic_matches ?? []).flatMap((match) =>
    side === "gold" ? [match.gold_value] : [match.pred_value]
  );
  const ranges = [
    ...strictValues.flatMap((strictValue) => findAllRanges(value, strictValue, "strict-match")),
    ...softValues.flatMap((softValue) => findAllRanges(value, softValue, "soft-match"))
  ];

  if (
    !valueHasCoverage(0, value.length, ranges) &&
    ((side === "gold" && detail.fn > 0) || (side === "lora" && detail.fp > 0))
  ) {
    ranges.push({
      start: 0,
      end: value.length,
      className: side === "gold" ? "false-negative" : "false-positive"
    });
  }

  return ranges;
}

function renderHighlightedText(value: string, ranges: HighlightRange[]): ReactNode {
  if (ranges.length === 0) {
    return value;
  }

  const boundaries = Array.from(
    new Set([0, value.length, ...ranges.flatMap((range) => [range.start, range.end])])
  )
    .filter((boundary) => boundary >= 0 && boundary <= value.length)
    .sort((a, b) => a - b);

  return boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const text = value.slice(start, end);
    const classNames = Array.from(
      new Set(
        ranges
          .filter((range) => range.start < end && range.end > start)
          .map((range) => range.className)
      )
    );

    if (classNames.length === 0) {
      return text;
    }

    return (
      <span className={`semantic-token ${classNames.join(" ")}`} key={`${start}-${end}`}>
        {text}
      </span>
    );
  });
}

function fieldValue(event: FlatEventRecord, field: FieldName): string[] | null | undefined {
  return event[field];
}

function EventFields({
  event,
  fieldScores,
  showDigest = true
}: {
  event: FlatEventRecord | null;
  fieldScores?: Partial<Record<FieldName, number>>;
  showDigest?: boolean;
}) {
  if (!event) {
    return <p className="empty-list">No event</p>;
  }

  return (
    <dl className="flat-event-fields">
      {fields.map((field) => (
        <div key={field}>
          <dt>{field}</dt>
          <dd>
            <span>{values(fieldValue(event, field))}</span>
            {typeof fieldScores?.[field] === "number" ? (
              <span className="semantic-field-score">F1 {score(fieldScores[field])}</span>
            ) : null}
          </dd>
        </div>
      ))}
      {showDigest ? (
        <div>
          <dt>digest</dt>
          <dd>{event.digest ?? "-"}</dd>
        </div>
      ) : null}
    </dl>
  );
}

interface FeedbackTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function FeedbackTextarea({ label, value, onChange }: FeedbackTextareaProps) {
  return (
    <label className="semantic-feedback">
      <span>{label}</span>
      <textarea
        aria-label={label}
        placeholder="Feedback for this semantic judgment"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function comparisonKey(comparison: SemanticEventComparison): string {
  return `${comparison.dialogue_id}:${comparison.match_status}:${
    comparison.gold_event_index ?? "none"
  }:${comparison.pred_event_index ?? "none"}`;
}

function comparisonRelation(comparison: SemanticEventComparison): string {
  if (comparison.match_status === "matched") {
    return `Gold #${eventNumber(comparison.gold_event_index)} <-> Lora #${eventNumber(
      comparison.pred_event_index
    )}`;
  }

  if (comparison.match_status === "unmatched_gold") {
    return `Gold #${eventNumber(comparison.gold_event_index)} <-> No pred match`;
  }

  return `No gold match <-> Lora #${eventNumber(comparison.pred_event_index)}`;
}

function comparisonFieldScores(
  comparison: SemanticEventComparison
): Partial<Record<FieldName, number>> {
  return {
    actor: comparison.fields.actor.f1,
    time: comparison.fields.time.f1,
    location: comparison.fields.location.f1,
    action: comparison.fields.action.f1
  };
}

function defaultComparison(dialogue: SemanticAuditDialogue): SemanticEventComparison | null {
  return (
    [...dialogue.comparisons].sort((a, b) => {
      const aUnmatched = a.match_status === "matched" ? 0 : 1;
      const bUnmatched = b.match_status === "matched" ? 0 : 1;

      return (
        bUnmatched - aUnmatched ||
        a.weighted_f1 - b.weighted_f1 ||
        a.alignment_score - b.alignment_score ||
        a.event_index - b.event_index
      );
    })[0] ?? null
  );
}

function orderedGraphComparisons(dialogue: SemanticAuditDialogue): SemanticEventComparison[] {
  const matched = dialogue.comparisons
    .filter((comparison) => comparison.match_status === "matched")
    .sort(
      (a, b) =>
        (a.gold_event_index ?? Number.MAX_SAFE_INTEGER) -
          (b.gold_event_index ?? Number.MAX_SAFE_INTEGER) ||
        (a.pred_event_index ?? Number.MAX_SAFE_INTEGER) -
          (b.pred_event_index ?? Number.MAX_SAFE_INTEGER)
    );
  const unmatchedGold = dialogue.comparisons
    .filter((comparison) => comparison.match_status === "unmatched_gold")
    .sort(
      (a, b) =>
        (a.gold_event_index ?? Number.MAX_SAFE_INTEGER) -
        (b.gold_event_index ?? Number.MAX_SAFE_INTEGER)
    );
  const unmatchedPred = dialogue.comparisons
    .filter((comparison) => comparison.match_status === "unmatched_pred")
    .sort(
      (a, b) =>
        (a.pred_event_index ?? Number.MAX_SAFE_INTEGER) -
        (b.pred_event_index ?? Number.MAX_SAFE_INTEGER)
    );

  return [...matched, ...unmatchedGold, ...unmatchedPred];
}

function FieldDetail({
  comparison,
  field,
  feedback,
  setFeedback
}: {
  comparison: SemanticEventComparison;
  field: FieldName;
  feedback: FeedbackMap;
  setFeedback: (key: string, value: string) => void;
}) {
  const detail = comparison.fields[field];
  const judges = comparison.fieldJudges[field];

  return (
    <section className="semantic-field-card" aria-label={`${field} semantic field`}>
      <div className="semantic-field-header">
        <strong>{field}</strong>
        <span>F1 {score(detail.f1)}</span>
        <small>
          TP {detail.tp} / FP {detail.fp} / FN {detail.fn}
        </small>
      </div>
      <div className="semantic-field-values">
        <p>
          <span>gold</span>
          {values(detail.gold)}
        </p>
        <p>
          <span>lora</span>
          {values(detail.pred)}
        </p>
      </div>
      {typeof comparison.alignment_fields[field] === "number" ? (
        <p className="semantic-muted">alignment {score(comparison.alignment_fields[field])}</p>
      ) : null}
      {detail.semantic_matches && detail.semantic_matches.length > 0 ? (
        <div className="semantic-match-list">
          {detail.semantic_matches.map((match, index) => (
            <span key={`${field}-${match.gold_value}-${match.pred_value}-${index}`}>
              {match.gold_value} <b>{"->"}</b> {match.pred_value} ({score(match.score)})
            </span>
          ))}
        </div>
      ) : null}
      {judges.map((judge, index) => {
        const key = fieldFeedbackKey(comparison, field, judge, index);
        return (
          <div className="semantic-judge-card" key={key}>
            <p>
              {judge.reason_code ?? "-"} / confidence {score(judge.confidence)}
            </p>
            <small>{judge.short_reason ?? "-"}</small>
            <FeedbackTextarea
              label={`Feedback for field ${field} semantic judgment dialogue ${
                comparison.dialogue_id
              } gold ${comparison.gold_event_index ?? "none"} pred ${
                comparison.pred_event_index ?? "none"
              }`}
              value={feedback[key] ?? ""}
              onChange={(value) => setFeedback(key, value)}
            />
          </div>
        );
      })}
    </section>
  );
}

function HighlightedFieldValues({
  comparison,
  field,
  side
}: {
  comparison: SemanticEventComparison;
  field: FieldName;
  side: "gold" | "lora";
}) {
  const detail = comparison.fields[field];
  const fieldValues = side === "gold" ? detail.gold : detail.pred;

  if (fieldValues.length === 0) {
    return <span>-</span>;
  }

  return (
    <span className="semantic-token-values">
      {fieldValues.map((value, index) => (
        <span className="semantic-token-value" key={`${side}-${field}-${value}-${index}`}>
          {renderHighlightedText(value, highlightRangesForValue(detail, side, value))}
          {index < fieldValues.length - 1 ? <span className="semantic-token-separator">, </span> : null}
        </span>
      ))}
    </span>
  );
}

function FieldDifferenceDetail({
  comparison,
  field,
  feedback,
  setFeedback
}: {
  comparison: SemanticEventComparison;
  field: FieldName;
  feedback: FeedbackMap;
  setFeedback: (key: string, value: string) => void;
}) {
  const detail = comparison.fields[field];
  const softAlignment = fieldSoftAlignment(comparison, field);
  const delta = fieldExplanationDelta(comparison, field);
  const judges = comparison.fieldJudges[field];

  return (
    <section
      aria-label={`${field} scoring evidence`}
      className={
        delta != null && delta > 0
          ? "semantic-field-card semantic-field-difference positive"
          : delta != null && delta < 0
            ? "semantic-field-card semantic-field-difference negative"
            : "semantic-field-card semantic-field-difference"
      }
    >
      <div className="semantic-field-header">
        <strong>{field}</strong>
        <span>{field} strict F1 {score(detail.f1)}</span>
        <small>soft alignment {softAlignment == null ? "-" : score(softAlignment)}</small>
        <small>explanation delta {delta == null ? "-" : signedScore(delta)}</small>
      </div>
      <div className="semantic-field-values semantic-token-field-values">
        <p>
          <span>gold</span>
          <HighlightedFieldValues comparison={comparison} field={field} side="gold" />
        </p>
        <p>
          <span>lora</span>
          <HighlightedFieldValues comparison={comparison} field={field} side="lora" />
        </p>
      </div>
      <p className="semantic-muted">
        TP {detail.tp} / FP {detail.fp} / FN {detail.fn}
      </p>
      {detail.semantic_matches && detail.semantic_matches.length > 0 ? (
        <div className="semantic-match-list">
          {detail.semantic_matches.map((match, index) => (
            <span key={`${field}-${match.gold_value}-${match.pred_value}-${index}`}>
              {match.gold_value} {"->"} {match.pred_value} ({score(match.score)})
            </span>
          ))}
        </div>
      ) : null}
      {judges.map((judge, index) => {
        const key = fieldFeedbackKey(comparison, field, judge, index);
        return (
          <div className="semantic-judge-card" key={key}>
            <p>
              {judge.reason_code ?? "-"} / confidence {score(judge.confidence)}
            </p>
            <small>{judge.short_reason ?? "-"}</small>
            <FeedbackTextarea
              label={`Feedback for field ${field} semantic judgment dialogue ${
                comparison.dialogue_id
              } gold ${comparison.gold_event_index ?? "none"} pred ${
                comparison.pred_event_index ?? "none"
              }`}
              value={feedback[key] ?? ""}
              onChange={(value) => setFeedback(key, value)}
            />
          </div>
        );
      })}
    </section>
  );
}

function EventGraphCard({
  side,
  comparison,
  event,
  selected,
  onSelect
}: {
  side: "gold" | "lora";
  comparison: SemanticEventComparison;
  event: FlatEventRecord | null;
  selected: boolean;
  onSelect: () => void;
}) {
  if (!event) {
    return <div className="semantic-graph-card-placeholder" aria-hidden="true" />;
  }

  const fieldScores = comparisonFieldScores(comparison);
  const isMatched = comparison.match_status === "matched";
  const eventIndex =
    side === "gold" ? comparison.gold_event_index : comparison.pred_event_index;
  const pairedIndex =
    side === "gold" ? comparison.pred_event_index : comparison.gold_event_index;
  const ariaLabel =
    side === "gold"
      ? isMatched
        ? `Gold event #${eventNumber(eventIndex)} matched to Lora event #${eventNumber(
            pairedIndex
          )}`
        : `Gold event #${eventNumber(eventIndex)} missing pred`
      : isMatched
        ? `Lora event #${eventNumber(eventIndex)} matched to Gold event #${eventNumber(
            pairedIndex
          )}`
        : `Lora event #${eventNumber(eventIndex)} extra pred`;

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={selected ? "semantic-graph-event-card selected" : "semantic-graph-event-card"}
      type="button"
      onClick={onSelect}
    >
      <span className="semantic-graph-card-title">
        {side === "gold" ? "Gold" : "Lora"} #{eventNumber(eventIndex)}
      </span>
      <span className={isMatched ? "semantic-status matched" : "semantic-status"}>
        {isMatched ? "matched" : side === "gold" ? "missing pred" : "extra pred"}
      </span>
      <EventFields event={event} fieldScores={fieldScores} showDigest={false} />
    </button>
  );
}

function DialogueRelationGraph({
  dialogue,
  selectedComparison,
  onSelect
}: {
  dialogue: SemanticAuditDialogue;
  selectedComparison: SemanticEventComparison | null;
  onSelect: (comparison: SemanticEventComparison) => void;
}) {
  const orderedComparisons = orderedGraphComparisons(dialogue);
  const selectedKey = selectedComparison ? comparisonKey(selectedComparison) : null;

  return (
    <section
      aria-label={`Dialogue ${dialogue.dialogue_id} event relation graph`}
      className="semantic-relation-graph"
    >
      <div className="semantic-relation-heading">
        <span>Gold events</span>
        <span aria-hidden="true" />
        <span>Lora pred events</span>
      </div>
      <div className="semantic-relation-rows">
        {orderedComparisons.map((comparison) => {
          const currentKey = comparisonKey(comparison);
          const selected = currentKey === selectedKey;
          const isMatched = comparison.match_status === "matched";

          return (
            <div className="semantic-relation-row" key={currentKey}>
              <EventGraphCard
                comparison={comparison}
                event={comparison.goldEvent}
                onSelect={() => onSelect(comparison)}
                selected={selected}
                side="gold"
              />
              {isMatched ? (
                <button
                  aria-label={`Select match Gold #${eventNumber(
                    comparison.gold_event_index
                  )} to Lora #${eventNumber(comparison.pred_event_index)} F1 ${score(
                    comparison.weighted_f1
                  )}`}
                  aria-pressed={selected}
                  className={
                    selected
                      ? "semantic-relation-link selected"
                      : "semantic-relation-link"
                  }
                  type="button"
                  onClick={() => onSelect(comparison)}
                >
                  <span aria-hidden="true" />
                  <strong>F1 {score(comparison.weighted_f1)}</strong>
                  <span aria-hidden="true" />
                </button>
              ) : (
                <div className="semantic-relation-gap">
                  {comparison.match_status === "unmatched_gold" ? "missing pred" : "extra pred"}
                </div>
              )}
              <EventGraphCard
                comparison={comparison}
                event={comparison.predEvent}
                onSelect={() => onSelect(comparison)}
                selected={selected}
                side="lora"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventComparisonDetails({
  comparison,
  feedback,
  setFeedback
}: {
  comparison: SemanticEventComparison;
  feedback: FeedbackMap;
  setFeedback: (key: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMatched = comparison.match_status === "matched";
  const eventKey = isMatched ? eventFeedbackKey(comparison) : unmatchedFeedbackKey(comparison);
  const relation = comparisonRelation(comparison);
  const feedbackLabel = isMatched
    ? `Feedback for event semantic judgment dialogue ${comparison.dialogue_id} gold ${
        comparison.gold_event_index ?? "none"
      } pred ${comparison.pred_event_index ?? "none"}`
    : `Feedback for ${comparison.match_status} semantic judgment dialogue ${
        comparison.dialogue_id
      } gold ${comparison.gold_event_index ?? "none"} pred ${
        comparison.pred_event_index ?? "none"
      }`;
  const fieldScores = comparisonFieldScores(comparison);

  return (
    <article className="semantic-event-card" aria-label="Selected semantic item details">
      <div className="semantic-event-card-header">
        <div>
          <strong>{relation}</strong>
          <p>
            {comparison.match_status === "unmatched_gold"
              ? "missing pred"
              : comparison.match_status === "unmatched_pred"
                ? "extra pred"
                : comparison.match_status}
          </p>
        </div>
        <button
          aria-expanded={expanded}
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>
      <div className="semantic-score-row">
        <span>event semantic F1 {score(comparison.weighted_f1)}</span>
        <span>alignment {score(comparison.alignment_score)}</span>
        <span>soft alignment {score(comparison.semantic_alignment_score)}</span>
        <span>active weight {score(comparison.active_weight)}</span>
      </div>
      <div className="semantic-event-pair">
        <section aria-label="gold semantic event">
          <p className="eyebrow">Gold</p>
          <EventFields event={comparison.goldEvent} fieldScores={fieldScores} />
        </section>
        <section aria-label="lora semantic event">
          <p className="eyebrow">Lora pred</p>
          <EventFields event={comparison.predEvent} fieldScores={fieldScores} />
        </section>
      </div>
      {comparison.eventJudge ? (
        <div className="semantic-judge-card">
          <p>
            {comparison.eventJudge.reason_code ?? "-"} / confidence{" "}
            {score(comparison.eventJudge.confidence)}
          </p>
          <small>{comparison.eventJudge.short_reason ?? "-"}</small>
        </div>
      ) : null}
      <FeedbackTextarea
        label={feedbackLabel}
        value={feedback[eventKey] ?? ""}
        onChange={(value) => setFeedback(eventKey, value)}
      />
      {expanded ? (
        <div className="semantic-fields-grid">
          {fields.map((field) => (
            <FieldDetail
              comparison={comparison}
              feedback={feedback}
              field={field}
              key={field}
              setFeedback={setFeedback}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ScoreBar({
  label,
  value,
  tone = "neutral"
}: {
  label: string;
  value: number;
  tone?: "neutral" | "soft";
}) {
  return (
    <div className={tone === "soft" ? "semantic-score-bar soft" : "semantic-score-bar"}>
      <div className="semantic-score-bar-label">
        <span>{label}</span>
        <strong>{score(value)}</strong>
      </div>
      <div className="semantic-score-track" aria-hidden="true">
        <span style={{ width: percent(value) }} />
      </div>
    </div>
  );
}

function ContributorButton({
  contributor,
  selected,
  onSelect
}: {
  contributor: DifferenceContributor;
  selected: boolean;
  onSelect: () => void;
}) {
  const comparison = contributor.comparison;
  const unmatched = comparison.match_status !== "matched";
  const label = unmatched
    ? `${comparisonRelation(comparison)} unmatched impact`
    : `${comparisonRelation(comparison)} explanation delta ${signedScore(contributor.delta)}`;

  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className={selected ? "semantic-contributor selected" : "semantic-contributor"}
      type="button"
      onClick={onSelect}
    >
      <strong>{comparisonRelation(comparison)}</strong>
      <span>{unmatched ? "unmatched impact" : `explanation delta ${signedScore(contributor.delta)}`}</span>
      <small>
        event F1 {score(comparison.weighted_f1)} / soft {score(comparison.semantic_alignment_score)}
      </small>
    </button>
  );
}

function ContributorEvidence({
  contributor,
  feedback,
  setFeedback
}: {
  contributor: DifferenceContributor;
  feedback: FeedbackMap;
  setFeedback: (key: string, value: string) => void;
}) {
  const comparison = contributor.comparison;
  const isMatched = comparison.match_status === "matched";
  const eventKey = isMatched ? eventFeedbackKey(comparison) : unmatchedFeedbackKey(comparison);
  const feedbackLabel = isMatched
    ? `Feedback for event semantic judgment dialogue ${comparison.dialogue_id} gold ${
        comparison.gold_event_index ?? "none"
      } pred ${comparison.pred_event_index ?? "none"}`
    : `Feedback for ${comparison.match_status} semantic judgment dialogue ${
        comparison.dialogue_id
      } gold ${comparison.gold_event_index ?? "none"} pred ${
        comparison.pred_event_index ?? "none"
      }`;

  return (
    <article className="semantic-contributor-evidence" aria-label="Contributor evidence">
      <div className="semantic-event-card-header">
        <div>
          <p className="eyebrow">Contributor evidence</p>
          <strong>{comparisonRelation(comparison)}</strong>
          <p>
            {isMatched
              ? `event delta ${signedScore(contributor.delta)}`
              : comparison.match_status === "unmatched_gold"
                ? "missing pred event"
                : "extra pred event"}
          </p>
        </div>
      </div>
      <div className="semantic-score-row">
        <span>event semantic F1 {score(comparison.weighted_f1)}</span>
        <span>soft alignment {score(comparison.semantic_alignment_score)}</span>
        <span>alignment {score(comparison.alignment_score)}</span>
        <span>active weight {score(comparison.active_weight)}</span>
      </div>
      <div className="semantic-event-pair">
        <section aria-label="gold contributor event">
          <p className="eyebrow">Gold</p>
          <EventFields event={comparison.goldEvent} fieldScores={comparisonFieldScores(comparison)} />
        </section>
        <section aria-label="lora contributor event">
          <p className="eyebrow">Lora pred</p>
          <EventFields event={comparison.predEvent} fieldScores={comparisonFieldScores(comparison)} />
        </section>
      </div>
      {comparison.eventJudge ? (
        <div className="semantic-judge-card">
          <p>
            {comparison.eventJudge.reason_code ?? "-"} / confidence{" "}
            {score(comparison.eventJudge.confidence)}
          </p>
          <small>{comparison.eventJudge.short_reason ?? "-"}</small>
        </div>
      ) : null}
      <FeedbackTextarea
        label={feedbackLabel}
        value={feedback[eventKey] ?? ""}
        onChange={(value) => setFeedback(eventKey, value)}
      />
      <section className="semantic-difference-fields" aria-label="field explanation deltas">
        <h4>field explanation deltas</h4>
        <div className="semantic-fields-grid">
          {fields.map((field) => (
            <FieldDifferenceDetail
              comparison={comparison}
              feedback={feedback}
              field={field}
              key={field}
              setFeedback={setFeedback}
            />
          ))}
        </div>
      </section>
    </article>
  );
}

function SemanticVsSoftView({
  dataset,
  activeDialogue,
  feedback,
  setFeedback
}: {
  dataset: SemanticEventAuditDataset;
  activeDialogue: SemanticAuditDialogue | null;
  feedback: FeedbackMap;
  setFeedback: (key: string, value: string) => void;
}) {
  const [expandedDialogueId, setExpandedDialogueId] = useState<string | null>(null);
  const [differenceSort, setDifferenceSort] = useState<DifferenceSort>("largest-gap");
  const [showAllContributors, setShowAllContributors] = useState(false);
  const [selectedContributorKey, setSelectedContributorKey] = useState<string | null>(null);
  const semanticF1 = dataset.summary.strictEventRowAverageF1;
  const softF1 = dataset.summary.softSemanticEventF1;
  const summaryDelta = softF1 - semanticF1;
  const dialogueRows = dataset.dialogues.map((dialogue) => {
    const softAlignmentAverage = average(
      dialogue.comparisons.map((comparison) => comparison.semantic_alignment_score)
    );

    return {
      dialogue,
      eventF1Average: dialogue.averageWeightedF1,
      softAlignmentAverage,
      delta: softAlignmentAverage - dialogue.averageWeightedF1
    };
  });
  const activeDialogueRows = activeDialogue
    ? activeDialogue.comparisons.filter((comparison) => comparison.match_status === "matched")
    : [];
  const expandedDialogue =
    dialogueRows.find(({ dialogue }) => dialogue.dialogue_id === expandedDialogueId)?.dialogue ??
    null;
  const contributors = expandedDialogue
    ? sortDifferenceContributors(differenceContributors(expandedDialogue), differenceSort)
    : [];
  const visibleContributors = showAllContributors ? contributors : contributors.slice(0, 3);
  const selectedContributor =
    contributors.find((contributor) => contributor.key === selectedContributorKey) ??
    contributors[0] ??
    null;

  return (
    <section
      aria-label="Semantic versus soft semantic scoring"
      className="semantic-score-difference"
    >
      <div className="semantic-score-overview">
        <div>
          <p className="eyebrow">Score difference overview</p>
          <h2>Semantic vs Soft Semantic</h2>
          <p className="semantic-muted">same gold and lora pred events</p>
          <small className="semantic-muted">only the scoring lens changes.</small>
        </div>
        <div className="semantic-delta-card">
          <span>Soft - semantic</span>
          <strong>{signedScore(summaryDelta)}</strong>
        </div>
      </div>
      <div className="semantic-score-bars">
        <ScoreBar label="Event semantic F1" value={semanticF1} />
        <ScoreBar label="Soft semantic F1" tone="soft" value={softF1} />
      </div>
      <div className="semantic-soft-pr">
        <span>soft precision {score(dataset.summary.softSemanticEventPrecision)}</span>
        <span>soft recall {score(dataset.summary.softSemanticEventRecall)}</span>
      </div>
      <section className="semantic-difference-table" aria-label="Dialogue score difference">
        <h3>Dialogue score difference</h3>
        <div className="semantic-difference-rows">
          {dialogueRows.map(({ dialogue, eventF1Average, softAlignmentAverage, delta }) => {
            const expanded = dialogue.dialogue_id === expandedDialogueId;

            return (
              <article
                className={
                  expanded
                    ? "semantic-difference-row semantic-dialogue-difference expanded"
                    : "semantic-difference-row semantic-dialogue-difference"
                }
                key={dialogue.dialogue_id}
              >
                <button
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} Dialogue ${
                    dialogue.dialogue_id
                  } score contributors`}
                  type="button"
                  onClick={() => {
                    setExpandedDialogueId(expanded ? null : dialogue.dialogue_id);
                    setSelectedContributorKey(null);
                    setShowAllContributors(false);
                  }}
                >
                  <strong>Dialogue {dialogue.dialogue_id}</strong>
                  <span>event F1 avg {score(eventF1Average)}</span>
                  <span>soft alignment avg {score(softAlignmentAverage)}</span>
                  <span className={delta >= 0 ? "semantic-delta positive" : "semantic-delta"}>
                    {signedScore(delta)}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      </section>
      {expandedDialogue ? (
        <section className="semantic-contributor-panel">
          <div className="semantic-contributor-controls">
            <div>
              <p className="eyebrow">Dialogue explanation</p>
              <h3>Top contributors</h3>
            </div>
            <label>
              <span>Sort</span>
              <select
                aria-label="Contributor sort"
                value={differenceSort}
                onChange={(event) => {
                  setDifferenceSort(event.target.value as DifferenceSort);
                  setSelectedContributorKey(null);
                }}
              >
                <option value="largest-gap">Largest gap</option>
                <option value="soft-gains">Soft gains</option>
                <option value="soft-losses">Soft losses</option>
                <option value="unmatched-first">Unmatched first</option>
              </select>
            </label>
          </div>
          <section className="semantic-contributor-list" aria-label="Top contributors">
            {visibleContributors.map((contributor) => (
              <ContributorButton
                contributor={contributor}
                key={contributor.key}
                onSelect={() => setSelectedContributorKey(contributor.key)}
                selected={selectedContributor?.key === contributor.key}
              />
            ))}
          </section>
          {contributors.length > 3 ? (
            <button
              className="semantic-show-all-contributors"
              type="button"
              onClick={() => setShowAllContributors((current) => !current)}
            >
              {showAllContributors ? "Show top contributors" : "Show all pairs"}
            </button>
          ) : null}
          {selectedContributor ? (
            <ContributorEvidence
              contributor={selectedContributor}
              feedback={feedback}
              setFeedback={setFeedback}
            />
          ) : null}
        </section>
      ) : null}
      <section className="semantic-difference-table" aria-label="Pair scoring difference">
        <h3>Pair scoring difference</h3>
        {activeDialogueRows.length > 0 ? (
          <div className="semantic-difference-rows">
            {activeDialogueRows.map((comparison) => {
              const delta = comparison.semantic_alignment_score - comparison.weighted_f1;

              return (
                <article className="semantic-difference-row" key={comparisonKey(comparison)}>
                  <strong>{comparisonRelation(comparison)}</strong>
                  <span>event semantic F1 {score(comparison.weighted_f1)}</span>
                  <span>soft alignment {score(comparison.semantic_alignment_score)}</span>
                  <span className={delta >= 0 ? "semantic-delta positive" : "semantic-delta"}>
                    {signedScore(delta)}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-list">No matched pairs in the current dialogue</p>
        )}
      </section>
    </section>
  );
}

function exportFeedbackRows(dataset: SemanticEventAuditDataset, feedback: FeedbackMap) {
  const rows: Array<Record<string, unknown>> = [];

  for (const dialogue of dataset.dialogues) {
    for (const comparison of dialogue.comparisons) {
      const eventKey =
        comparison.match_status === "matched"
          ? eventFeedbackKey(comparison)
          : unmatchedFeedbackKey(comparison);
      const eventFeedback = feedback[eventKey]?.trim();

      if (eventFeedback) {
        rows.push({
          artifact: dataset.artifact,
          artifact_id: dataset.artifactId,
          run_id: dataset.runId,
          feedback_scope:
            comparison.match_status === "matched" ? "event" : comparison.match_status,
          field_name: null,
          dialogue_id: comparison.dialogue_id,
          gold_event_index: comparison.gold_event_index,
          pred_event_index: comparison.pred_event_index,
          judge_cache_key: comparison.eventJudge?.cache_key ?? null,
          score: comparison.weighted_f1,
          reason_code: comparison.eventJudge?.reason_code ?? comparison.match_status,
          feedback: eventFeedback,
          created_at: new Date().toISOString()
        });
      }

      for (const field of fields) {
        comparison.fieldJudges[field].forEach((judge, index) => {
          const key = fieldFeedbackKey(comparison, field, judge, index);
          const fieldFeedback = feedback[key]?.trim();

          if (fieldFeedback) {
            rows.push({
              artifact: dataset.artifact,
              artifact_id: dataset.artifactId,
              run_id: dataset.runId,
              feedback_scope: "field",
              field_name: field,
              dialogue_id: comparison.dialogue_id,
              gold_event_index: comparison.gold_event_index,
              pred_event_index: comparison.pred_event_index,
              judge_cache_key: judge.cache_key,
              score: judge.confidence,
              reason_code: judge.reason_code,
              feedback: fieldFeedback,
              created_at: new Date().toISOString()
            });
          }
        });
      }
    }
  }

  return rows;
}

function feedbackJsonl(dataset: SemanticEventAuditDataset, feedback: FeedbackMap): string {
  return exportFeedbackRows(dataset, feedback)
    .map((row) => JSON.stringify(row))
    .join("\n");
}

function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text ? `${text}\n` : ""], { type: "application/jsonl" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SemanticEventAuditWorkbench({ dataset }: SemanticEventAuditWorkbenchProps) {
  const [activeDialogueId, setActiveDialogueId] = useState<string | null>(
    dataset.dialogues[0]?.dialogue_id ?? null
  );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<DialogueSort>("priority");
  const [feedback, setFeedbackState] = useState<FeedbackMap>(() => loadFeedback(dataset));
  const [candidatesExpanded, setCandidatesExpanded] = useState(false);
  const [selectedComparisonKey, setSelectedComparisonKey] = useState<string | null>(null);
  const [view, setView] = useState<SemanticWorkbenchView>("relations");
  const visibleDialogues = useMemo(() => {
    const searched = dataset.dialogues.filter((dialogue) =>
      dialogue.dialogue_id.toLowerCase().includes(search.toLowerCase())
    );

    return sortedDialogues(searched, sort);
  }, [dataset.dialogues, search, sort]);
  const activeDialogue =
    visibleDialogues.find((dialogue) => dialogue.dialogue_id === activeDialogueId) ??
    visibleDialogues[0] ??
    null;
  const selectedComparison = activeDialogue
    ? activeDialogue.comparisons.find(
        (comparison) => comparisonKey(comparison) === selectedComparisonKey
      ) ??
      defaultComparison(activeDialogue)
    : null;

  function setFeedback(key: string, value: string) {
    setFeedbackState((current) => {
      const next = { ...current, [key]: value };
      localStorage.setItem(storageKey(dataset), JSON.stringify(next));
      return next;
    });
  }

  const exportedJsonl = feedbackJsonl(dataset, feedback);
  const count = feedbackCount(feedback);

  return (
    <section className="semantic-workbench" aria-label="Semantic event audit workbench">
      <div className="flat-summary-band semantic-summary-band">
        <div className="metric-card">
          <p className="eyebrow">Artifact</p>
          <h1>{dataset.artifact}</h1>
          <small>{importSourceLabel(dataset)}</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Event semantic F1</p>
          <strong>{score(dataset.summary.strictEventRowAverageF1)}</strong>
          <small>strict row average</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Soft semantic F1</p>
          <strong>{score(dataset.summary.softSemanticEventF1)}</strong>
          <small>
            P {score(dataset.summary.softSemanticEventPrecision)} / R{" "}
            {score(dataset.summary.softSemanticEventRecall)}
          </small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Matched quality</p>
          <strong>{score(dataset.summary.matchedEventQuality)}</strong>
          <small>{dataset.summary.eventsMatched} matched</small>
        </div>
        <div className="metric-card">
          <p className="eyebrow">Feedback</p>
          <strong>{count}</strong>
          <small>{count === 1 ? "feedback" : "feedback"}</small>
        </div>
      </div>
      <div className="semantic-field-summary" aria-label="Field-level semantic F1">
        {fields.map((field) => (
          <div className="metric-card" key={field}>
            <p className="eyebrow">{field}</p>
            <strong>F1 {score(dataset.summary.fieldMetrics[field].f1)}</strong>
            <small>
              P {score(dataset.summary.fieldMetrics[field].precision)} / R{" "}
              {score(dataset.summary.fieldMetrics[field].recall)}
            </small>
          </div>
        ))}
      </div>
      {dataset.warnings.length > 0 ? (
        <div className="warning-strip" role="status">
          {dataset.warnings.join(" ")}
        </div>
      ) : null}
      <div className="semantic-actions">
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(exportedJsonl ? `${exportedJsonl}\n` : "")}
        >
          <Copy size={16} /> Copy feedback JSONL
        </button>
        <button
          type="button"
          onClick={() => downloadText(`semantic-feedback-${dataset.runId ?? "archive"}.jsonl`, exportedJsonl)}
        >
          <Download size={16} /> Download feedback JSONL
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Clear all semantic feedback for this artifact?")) {
              localStorage.removeItem(storageKey(dataset));
              setFeedbackState({});
            }
          }}
        >
          <Trash2 size={16} /> Clear feedback
        </button>
      </div>
      <div className="semantic-inner-tabs" role="tablist" aria-label="Semantic audit views">
        <button
          aria-selected={view === "relations"}
          role="tab"
          type="button"
          onClick={() => setView("relations")}
        >
          Event relations
        </button>
        <button
          aria-selected={view === "score-difference"}
          role="tab"
          type="button"
          onClick={() => setView("score-difference")}
        >
          Semantic vs Soft
        </button>
      </div>
      <div className="flat-events-grid">
        <aside className="dialogue-sidebar" aria-label="Semantic dialogue list">
          <div className="filters">
            <input
              aria-label="Search semantic dialogue id"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dialogue_id"
            />
            <select
              aria-label="Dialogue sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as DialogueSort)}
            >
              <option value="priority">Needs review first</option>
              <option value="id">Dialogue id</option>
            </select>
          </div>
          <div className="dialogue-list">
            {visibleDialogues.map((dialogue) => (
              <button
                key={dialogue.dialogue_id}
                aria-current={dialogue.dialogue_id === activeDialogue?.dialogue_id ? "true" : undefined}
                className={
                  dialogue.dialogue_id === activeDialogue?.dialogue_id
                    ? "dialogue-list-item active"
                    : "dialogue-list-item"
                }
                type="button"
                onClick={() => {
                  setActiveDialogueId(dialogue.dialogue_id);
                  setSelectedComparisonKey(null);
                  setCandidatesExpanded(false);
                }}
              >
                <span>Dialogue {dialogue.dialogue_id}</span>
                <small>
                  {dialogue.matched} matched / {dialogue.unmatchedGold} missing /{" "}
                  {dialogue.unmatchedPred} extra / avg F1 {score(dialogue.averageWeightedF1)}
                </small>
              </button>
            ))}
          </div>
        </aside>
        <section className="detail-pane flat-detail-pane" aria-label="Semantic event detail">
          {activeDialogue ? (
            <>
              <div className="detail-header">
                <div className="detail-title">
                  <p className="eyebrow">Current dialogue</p>
                  <h2>Dialogue {activeDialogue.dialogue_id}</h2>
                  <p>
                    {activeDialogue.matched} matched / {activeDialogue.unmatchedGold} missing /{" "}
                    {activeDialogue.unmatchedPred} extra / outcome {activeDialogue.outcome ?? "-"}
                  </p>
                </div>
              </div>
              {activeDialogue.baseEvents.length > 0 ? (
                <details className="semantic-reference">
                  <summary>Base reference events ({activeDialogue.baseEvents.length})</summary>
                  <div className="flat-event-stack">
                    {activeDialogue.baseEvents.map((event) => (
                      <article className="flat-event-row" key={`${event.source}-${event.event_index}`}>
                        <strong>Base #{event.event_index ?? "-"}</strong>
                        <EventFields event={event} />
                      </article>
                    ))}
                  </div>
                </details>
              ) : null}
              {view === "relations" ? (
                <>
                  <DialogueRelationGraph
                    dialogue={activeDialogue}
                    onSelect={(comparison) => setSelectedComparisonKey(comparisonKey(comparison))}
                    selectedComparison={selectedComparison}
                  />
                  {selectedComparison ? (
                    <EventComparisonDetails
                      comparison={selectedComparison}
                      feedback={feedback}
                      setFeedback={setFeedback}
                    />
                  ) : null}
                  {activeDialogue.rowAudit ? (
                    <section className="semantic-candidates">
                      <button
                        aria-expanded={candidatesExpanded}
                        type="button"
                        onClick={() => setCandidatesExpanded((current) => !current)}
                      >
                        {candidatesExpanded ? "Hide" : "Show"} candidates for dialogue{" "}
                        {activeDialogue.dialogue_id}
                      </button>
                      {candidatesExpanded ? (
                        <div className="semantic-candidate-grid">
                          {activeDialogue.rowAudit.candidate_scores.map((candidate) => (
                            <div
                              className={
                                candidate.accepted ? "semantic-candidate accepted" : "semantic-candidate"
                              }
                              key={`${candidate.gold_event_index}-${candidate.pred_event_index}`}
                            >
                              <strong>
                                gold {candidate.gold_event_index} -&gt; lora{" "}
                                {candidate.pred_event_index}
                              </strong>
                              <span>alignment {score(candidate.alignment_score)}</span>
                              <span>local {score(candidate.local_alignment_score)}</span>
                              <small>{candidate.reason_code ?? "-"}</small>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </>
              ) : (
                <SemanticVsSoftView
                  activeDialogue={activeDialogue}
                  dataset={dataset}
                  feedback={feedback}
                  setFeedback={setFeedback}
                />
              )}
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
