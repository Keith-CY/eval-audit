import JSZip from "jszip";
import { classifyZipEntries } from "./fileDiscovery";
import { parseJsonl } from "./jsonl";
import { normalizeDataset } from "./normalize";
import type {
  EvaluationSummary,
  EventComparison,
  FailureRecord,
  PredictionRow,
  ReviewDataset,
  RowAudit
} from "./types";

async function readText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Zip entry not found: ${path}`);
  }

  return entry.async("text");
}

function parseJson<T>(sourceName: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${sourceName}: ${(error as Error).message}`);
  }
}

export async function loadEvaluationZip(file: File): Promise<ReviewDataset> {
  const zip = await JSZip.loadAsync(file);
  const entries = classifyZipEntries(Object.keys(zip.files));

  if (
    entries.missingRequired.length > 0 ||
    !entries.summary ||
    !entries.rowAudit ||
    !entries.eventDetails ||
    !entries.predictions
  ) {
    throw new Error(`Missing required files: ${entries.missingRequired.join(", ")}`);
  }

  const summaryText = await readText(zip, entries.summary);
  const rowAuditText = await readText(zip, entries.rowAudit);
  const eventDetailsText = await readText(zip, entries.eventDetails);
  const predictionText = await readText(zip, entries.predictions);

  const summary = parseJson<EvaluationSummary>(entries.summary, summaryText);
  const rowAudits = parseJsonl<RowAudit>(rowAuditText, entries.rowAudit);
  const eventDetails = parseJsonl<EventComparison>(eventDetailsText, entries.eventDetails);
  const predictionRows = parseJsonl<PredictionRow>(predictionText, entries.predictions);

  let failures: FailureRecord[] = [];
  let failuresWarning: string | null = null;

  if (entries.failures) {
    const failuresText = await readText(zip, entries.failures);
    try {
      failures = parseJsonl<FailureRecord>(failuresText, entries.failures);
    } catch (error) {
      failuresWarning = `Could not parse optional failures file ${entries.failures}: ${
        (error as Error).message
      }`;
    }
  }

  const dataset = normalizeDataset({
    summary,
    rowAudits,
    eventDetails,
    predictionRows,
    failures
  });

  if (failuresWarning) {
    dataset.warnings.push(failuresWarning);
  }

  return dataset;
}
