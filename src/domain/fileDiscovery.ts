export interface ClassifiedEntries {
  summary: string | null;
  rowAudit: string | null;
  eventDetails: string | null;
  predictions: string | null;
  failures: string | null;
  missingRequired: string[];
}

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function isMacOsMetadata(path: string): boolean {
  return path.includes("__MACOSX/") || basename(path).startsWith("._");
}

export function classifyZipEntries(paths: string[]): ClassifiedEntries {
  const usablePaths = paths.filter((path) => !isMacOsMetadata(path));
  const summary = usablePaths.find((path) => basename(path) === "event_eval_summary.json") ?? null;
  const rowAudit = usablePaths.find((path) => basename(path) === "row_audit_report.jsonl") ?? null;
  const eventDetails =
    usablePaths.find((path) => basename(path) === "event_eval_details.jsonl") ?? null;
  const failures =
    usablePaths.find((path) => basename(path).endsWith(".failures.jsonl")) ?? null;
  const predictions =
    usablePaths.find((path) => {
      const name = basename(path);
      return (
        name.endsWith(".jsonl") &&
        name !== "row_audit_report.jsonl" &&
        name !== "event_eval_details.jsonl" &&
        !name.endsWith(".failures.jsonl")
      );
    }) ?? null;

  const missingRequired: string[] = [];
  if (!summary) missingRequired.push("event_eval_summary.json");
  if (!rowAudit) missingRequired.push("row_audit_report.jsonl");
  if (!eventDetails) missingRequired.push("event_eval_details.jsonl");
  if (!predictions) missingRequired.push("prediction jsonl");

  return { summary, rowAudit, eventDetails, predictions, failures, missingRequired };
}
