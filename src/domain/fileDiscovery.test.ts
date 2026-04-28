import { describe, expect, it } from "vitest";
import { classifyZipEntries } from "./fileDiscovery";

describe("classifyZipEntries", () => {
  it("finds logical evaluation files under an artifact directory", () => {
    const entries = classifyZipEntries([
      "google_gemma_4_31B_it/event_eval_summary.json",
      "google_gemma_4_31B_it/row_audit_report.jsonl",
      "google_gemma_4_31B_it/event_eval_details.jsonl",
      "google_gemma_4_31B_it/google_gemma-4-31B-it.jsonl",
      "google_gemma_4_31B_it/google_gemma-4-31B-it.failures.jsonl",
      "__MACOSX/google_gemma_4_31B_it/._row_audit_report.jsonl"
    ]);

    expect(entries.summary).toBe("google_gemma_4_31B_it/event_eval_summary.json");
    expect(entries.rowAudit).toBe("google_gemma_4_31B_it/row_audit_report.jsonl");
    expect(entries.eventDetails).toBe("google_gemma_4_31B_it/event_eval_details.jsonl");
    expect(entries.predictions).toBe("google_gemma_4_31B_it/google_gemma-4-31B-it.jsonl");
    expect(entries.failures).toBe(
      "google_gemma_4_31B_it/google_gemma-4-31B-it.failures.jsonl"
    );
  });

  it("reports missing required logical files", () => {
    const entries = classifyZipEntries(["artifact/event_eval_summary.json"]);
    expect(entries.missingRequired).toEqual([
      "row_audit_report.jsonl",
      "event_eval_details.jsonl",
      "prediction jsonl"
    ]);
  });

  it("prefers prediction candidates from the inferred artifact directory", () => {
    const entries = classifyZipEntries([
      "other/aaa-unrelated.jsonl",
      "artifact/event_eval_summary.json",
      "artifact/row_audit_report.jsonl",
      "artifact/event_eval_details.jsonl",
      "artifact/model-output.jsonl"
    ]);

    expect(entries.predictions).toBe("artifact/model-output.jsonl");
  });

  it("excludes metadata and annotation JSONL files and sorts remaining candidates", () => {
    const entries = classifyZipEntries([
      "artifact/event_eval_summary.json",
      "artifact/row_audit_report.jsonl",
      "artifact/event_eval_details.jsonl",
      "artifact/metadata.jsonl",
      "artifact/annotations.jsonl",
      "artifact/model-annotations.jsonl",
      "artifact/z-model.jsonl",
      "artifact/a-model.jsonl"
    ]);

    expect(entries.predictions).toBe("artifact/a-model.jsonl");
  });
});
