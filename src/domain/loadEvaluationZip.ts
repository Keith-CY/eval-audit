import JSZip from "jszip";
import { normalizeEvaluationArtifacts } from "./evaluationCompat";
import { classifyZipEntries } from "./fileDiscovery";
import { parseJsonl } from "./jsonl";
import { normalizeDataset } from "./normalize";
import type {
  FailureRecord,
  PredictionRow,
  ReviewDataset
} from "./types";

export const EVALUATION_ZIP_LIMITS = {
  maxZipBytes: 100 * 1024 * 1024,
  maxEntries: 500,
  maxTextChars: 50 * 1024 * 1024
};

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function assertZipFileWithinLimits(file: File): void {
  if (file.size > EVALUATION_ZIP_LIMITS.maxZipBytes) {
    throw new Error(
      `Evaluation zip is too large. Maximum supported size is ${formatMegabytes(
        EVALUATION_ZIP_LIMITS.maxZipBytes
      )}.`
    );
  }
}

function assertEntryCountWithinLimits(paths: string[]): void {
  if (paths.length > EVALUATION_ZIP_LIMITS.maxEntries) {
    throw new Error(
      `Evaluation zip contains too many files. Maximum supported entries is ${EVALUATION_ZIP_LIMITS.maxEntries}.`
    );
  }
}

async function readText(zip: JSZip, path: string): Promise<string> {
  const entry = zip.file(path);
  if (!entry) {
    throw new Error(`Zip entry not found: ${path}`);
  }

  const text = await entry.async("text");
  if (text.length > EVALUATION_ZIP_LIMITS.maxTextChars) {
    throw new Error(
      `${path} is too large after decompression. Maximum supported text size is ${formatMegabytes(
        EVALUATION_ZIP_LIMITS.maxTextChars
      )}.`
    );
  }

  return text;
}

function parseJson<T>(sourceName: string, text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`${sourceName}: ${(error as Error).message}`);
  }
}

export async function loadEvaluationZip(file: File): Promise<ReviewDataset> {
  assertZipFileWithinLimits(file);

  const zip = await JSZip.loadAsync(file);
  const zipPaths = Object.keys(zip.files);
  assertEntryCountWithinLimits(zipPaths);

  const entries = classifyZipEntries(zipPaths);

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
  const goldText = entries.gold ? await readText(zip, entries.gold) : "";

  const rawSummary = parseJson<unknown>(entries.summary, summaryText);
  const rawRowAudits = parseJsonl<unknown>(rowAuditText, entries.rowAudit);
  const rawEventDetails = parseJsonl<unknown>(eventDetailsText, entries.eventDetails);
  const predictionRows = parseJsonl<PredictionRow>(predictionText, entries.predictions);
  const goldRows = entries.gold ? parseJsonl<PredictionRow>(goldText, entries.gold) : [];
  const { summary, rowAudits, eventDetails } = normalizeEvaluationArtifacts({
    summary: rawSummary,
    summaryPath: entries.summary,
    rowAudits: rawRowAudits,
    eventDetails: rawEventDetails,
    predictionRows,
    goldRows
  });

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
