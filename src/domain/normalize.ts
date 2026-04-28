import type {
  EvaluationSummary,
  EventComparison,
  FailureRecord,
  PredictionRow,
  ReviewDataset,
  RowAudit
} from "./types";

export interface NormalizeInput {
  summary: EvaluationSummary;
  rowAudits: RowAudit[];
  eventDetails: EventComparison[];
  predictionRows: PredictionRow[];
  failures: FailureRecord[];
}

function firstByDialogueId<T extends { dialogue_id: string }>(records: T[]): Map<string, T> {
  const map = new Map<string, T>();

  for (const record of records) {
    if (!map.has(record.dialogue_id)) {
      map.set(record.dialogue_id, record);
    }
  }

  return map;
}

function warningForMissing(count: number, singular: string, plural: string): string | null {
  if (count === 0) {
    return null;
  }

  return `${count} ${count === 1 ? singular : plural}`;
}

export function normalizeDataset(input: NormalizeInput): ReviewDataset {
  const predictionsByDialogue = firstByDialogueId(input.predictionRows);
  const failuresByDialogue = firstByDialogueId(input.failures);
  const warnings: string[] = [];

  let auditsWithoutPredictions = 0;

  const dialogues = input.rowAudits.map((rowAudit) => {
    const prediction = predictionsByDialogue.get(rowAudit.dialogue_id) ?? null;
    if (!prediction) {
      auditsWithoutPredictions += 1;
    }

    return {
      row_index: rowAudit.row_index,
      dialogue_id: rowAudit.dialogue_id,
      dialogue: prediction?.dialogue ?? [],
      goldEvents: rowAudit.events.flatMap((event) => (event.gold_event ? [event.gold_event] : [])),
      predEvents:
        prediction?.events ??
        rowAudit.events.flatMap((event) => (event.pred_event ? [event.pred_event] : [])),
      rowAudit,
      failure: failuresByDialogue.get(rowAudit.dialogue_id) ?? null
    };
  });

  const missingPredictionWarning = warningForMissing(
    auditsWithoutPredictions,
    "row audit record has no matching prediction row.",
    "row audit records have no matching prediction rows."
  );
  if (missingPredictionWarning) {
    warnings.push(missingPredictionWarning);
  }

  const auditIds = new Set(input.rowAudits.map((row) => row.dialogue_id));
  const predictionsWithoutAudits = input.predictionRows.filter(
    (row) => !auditIds.has(row.dialogue_id)
  ).length;
  const missingAuditWarning = warningForMissing(
    predictionsWithoutAudits,
    "prediction row has no matching row audit record.",
    "prediction rows have no matching row audit records."
  );
  if (missingAuditWarning) {
    warnings.push(missingAuditWarning);
  }

  return {
    artifact: input.summary.artifact,
    summary: input.summary,
    dialogues,
    warnings
  };
}
