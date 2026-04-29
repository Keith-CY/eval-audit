export interface ClassifiedEntries {
  summary: string | null;
  rowAudit: string | null;
  eventDetails: string | null;
  predictions: string | null;
  gold: string | null;
  failures: string | null;
  missingRequired: string[];
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function dirname(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function isMacOsMetadata(path: string): boolean {
  return path.includes("__MACOSX/") || basename(path).startsWith("._");
}

function inferCommonDirectory(paths: string[]): string | null {
  if (paths.length === 0) {
    return null;
  }

  const directories = paths.map(dirname);
  const [firstDirectory] = directories;
  return directories.every((directory) => directory === firstDirectory) ? firstDirectory : null;
}

function isPredictionCandidate(path: string): boolean {
  const name = basename(path);
  return (
    name.endsWith(".jsonl") &&
    !path.includes("/reports/") &&
    name !== "row_audit_report.jsonl" &&
    name !== "event_eval_row_audit.jsonl" &&
    name !== "event_eval_semantic_row_audit.jsonl" &&
    name !== "event_eval_details.jsonl" &&
    name !== "event_eval_semantic_details.jsonl" &&
    name !== "event_eval_dialogue_traces.jsonl" &&
    name !== "event_eval_judge_audit.jsonl" &&
    name !== "gold_subset.jsonl" &&
    name !== "annotations.jsonl" &&
    name !== "metadata.jsonl" &&
    !name.endsWith(".failures.jsonl") &&
    !name.endsWith("-annotations.jsonl")
  );
}

export function classifyZipEntries(paths: string[]): ClassifiedEntries {
  const usablePaths = paths.filter((path) => !isMacOsMetadata(path));
  const summary =
    usablePaths.find((path) => basename(path) === "event_eval_summary.json") ??
    usablePaths.find((path) => basename(path) === "event_eval_semantic_summary.json") ??
    null;
  const rowAudit =
    usablePaths.find((path) => basename(path) === "row_audit_report.jsonl") ??
    usablePaths.find((path) => basename(path) === "event_eval_row_audit.jsonl") ??
    usablePaths.find((path) => basename(path) === "event_eval_semantic_row_audit.jsonl") ??
    null;
  const eventDetails =
    usablePaths.find((path) => basename(path) === "event_eval_details.jsonl") ??
    usablePaths.find((path) => basename(path) === "event_eval_semantic_details.jsonl") ??
    null;
  const gold = usablePaths.find((path) => basename(path) === "gold_subset.jsonl") ?? null;
  const failures =
    usablePaths.find((path) => basename(path).endsWith(".failures.jsonl")) ?? null;
  const requiredPaths = [summary, rowAudit, eventDetails].filter((path): path is string => path !== null);
  const preferredDirectory = inferCommonDirectory(requiredPaths);
  const predictionCandidates = usablePaths.filter(isPredictionCandidate).sort();
  const preferredPredictionCandidates =
    preferredDirectory === null
      ? []
      : predictionCandidates.filter((path) => dirname(path) === preferredDirectory);
  const predictions =
    preferredPredictionCandidates.at(0) ?? predictionCandidates.at(0) ?? null;

  const missingRequired: string[] = [];
  if (!summary) missingRequired.push("event_eval_summary.json");
  if (!rowAudit) missingRequired.push("row_audit_report.jsonl");
  if (!eventDetails) missingRequired.push("event_eval_details.jsonl");
  if (!predictions) missingRequired.push("prediction jsonl");

  return { summary, rowAudit, eventDetails, predictions, gold, failures, missingRequired };
}
