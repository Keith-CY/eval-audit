import { useMemo, useState } from "react";
import { dialogueF1 } from "../domain/dialogueMetrics";
import { formatCount, formatOptionalMetric } from "../domain/format";
import { scoreClass, scoreRange, type ScoreRange } from "../domain/scoreExtremes";
import type {
  DialogueReview,
  FieldName,
  LoadedEvaluation
} from "../domain/types";

interface ReportTableViewProps {
  evaluations: LoadedEvaluation[];
}

const fields: FieldName[] = ["actor", "time", "location", "action"];

function evaluationLabel(evaluation: LoadedEvaluation, index: number): string {
  return evaluation.dataset.artifact || `Eval ${index + 1}`;
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

function goldEventCount(dialogues: Array<DialogueReview | null>): number | null {
  const rowWithGoldCount = dialogues.find(
    (dialogue) => dialogue?.rowAudit?.gold_event_count !== undefined
  );
  if (rowWithGoldCount?.rowAudit) {
    return rowWithGoldCount.rowAudit.gold_event_count;
  }

  const dialogueWithGold = dialogues.find((dialogue) => (dialogue?.goldEvents.length ?? 0) > 0);
  return dialogueWithGold ? dialogueWithGold.goldEvents.length : null;
}

function MetricSpan({
  label,
  value,
  range
}: {
  label: string;
  value: number | null | undefined;
  range?: ScoreRange;
}) {
  return (
    <span aria-label={label} className={scoreClass(value, range)}>
      {formatOptionalMetric(value ?? null)}
    </span>
  );
}

export function ReportTableView({ evaluations }: ReportTableViewProps) {
  const [search, setSearch] = useState("");
  const labels = evaluations.map(evaluationLabel);
  const allDialogueIds = useMemo(() => dialogueIds(evaluations), [evaluations]);
  const filteredDialogueIds = useMemo(() => {
    const query = search.trim();
    return query.length === 0
      ? allDialogueIds
      : allDialogueIds.filter((dialogueId) => dialogueId.includes(query));
  }, [allDialogueIds, search]);
  const summaryOverallRange = scoreRange(
    evaluations.map((evaluation) => evaluation.dataset.summary.overall_weighted_f1)
  );
  const summaryFieldRanges = new Map(
    fields.map((field) => [
      field,
      scoreRange(evaluations.map((evaluation) => evaluation.dataset.summary.field_f1[field]))
    ])
  );
  const dialogueColumnCount = 2 + evaluations.length * 5;

  return (
    <section className="report-view" aria-label="LLM comparison report">
      <section className="report-section">
        <div className="report-section-header">
          <div>
            <p className="eyebrow">Report table</p>
            <h2>LLM Summary</h2>
          </div>
          <small>{formatCount(evaluations.length)} evaluations</small>
        </div>
        <div className="report-table-wrap">
          <table className="report-table" aria-label="LLM summary table">
            <thead>
              <tr>
                <th scope="col">LLM</th>
                <th scope="col">overall F1</th>
                {fields.map((field) => (
                  <th key={field} scope="col">
                    {field} F1
                  </th>
                ))}
                <th scope="col">gold events</th>
                <th scope="col">pred events</th>
                <th scope="col">matched</th>
                <th scope="col">unmatched gold</th>
                <th scope="col">unmatched pred</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation, index) => {
                const label = labels[index];
                const summary = evaluation.dataset.summary;

                return (
                  <tr key={evaluation.id}>
                    <th scope="row">{label}</th>
                    <td>
                      <MetricSpan
                        label={`${label} overall F1`}
                        value={summary.overall_weighted_f1}
                        range={summaryOverallRange}
                      />
                    </td>
                    {fields.map((field) => (
                      <td key={field}>
                        <MetricSpan
                          label={`${label} ${field} F1`}
                          value={summary.field_f1[field]}
                          range={summaryFieldRanges.get(field)}
                        />
                      </td>
                    ))}
                    <td>{formatCount(summary.gold_events)}</td>
                    <td>{formatCount(summary.prediction_events)}</td>
                    <td>{formatCount(summary.events_matched)}</td>
                    <td>{formatCount(summary.unmatched_gold)}</td>
                    <td>{formatCount(summary.unmatched_prediction)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="report-section">
        <div className="report-section-header">
          <div>
            <p className="eyebrow">Per dialogue</p>
            <h2>Dialogue Comparison</h2>
          </div>
          <input
            aria-label="Search report dialogue id"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search dialogue_id"
          />
        </div>
        <div className="report-table-wrap">
          <table className="report-table" aria-label="Dialogue comparison table">
            <thead>
              <tr>
                <th scope="col">Dialogue</th>
                <th scope="col">Gold</th>
                {labels.flatMap((label) => [
                  <th key={`${label}-f1`} scope="col">
                    {label} F1
                  </th>,
                  <th key={`${label}-matched`} scope="col">
                    {label} matched
                  </th>,
                  <th key={`${label}-unmatched-gold`} scope="col">
                    {label} unmatched gold
                  </th>,
                  <th key={`${label}-unmatched-pred`} scope="col">
                    {label} unmatched pred
                  </th>,
                  <th key={`${label}-pred`} scope="col">
                    {label} pred
                  </th>
                ])}
              </tr>
            </thead>
            <tbody>
              {filteredDialogueIds.length === 0 ? (
                <tr>
                  <td colSpan={dialogueColumnCount}>No matching dialogues</td>
                </tr>
              ) : (
                filteredDialogueIds.map((dialogueId) => {
                  const dialogueResults = evaluations.map((evaluation) => {
                    const dialogue = findDialogue(evaluation, dialogueId);
                    return {
                      dialogue,
                      score: dialogueF1(dialogue)
                    };
                  });
                  const dialogueScoreRange = scoreRange(
                    dialogueResults.map((result) => result.score)
                  );

                  return (
                    <tr key={dialogueId}>
                      <td>Dialogue {dialogueId}</td>
                      <td>{formatCount(goldEventCount(dialogueResults.map((result) => result.dialogue)))}</td>
                      {dialogueResults.flatMap(({ dialogue, score }, index) => {
                        const audit = dialogue?.rowAudit ?? null;
                        const label = labels[index];

                        return [
                          <td key={`${label}-f1`}>
                            <MetricSpan
                              label={`${label} dialogue ${dialogueId} F1`}
                              value={score}
                              range={dialogueScoreRange}
                            />
                          </td>,
                          <td key={`${label}-matched`}>{formatCount(audit?.matched_events)}</td>,
                          <td key={`${label}-unmatched-gold`}>
                            {formatCount(audit?.unmatched_gold)}
                          </td>,
                          <td key={`${label}-unmatched-pred`}>
                            {formatCount(audit?.unmatched_pred)}
                          </td>,
                          <td key={`${label}-pred`}>{formatCount(audit?.pred_event_count)}</td>
                        ];
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
