import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { loadEvaluationZip } from "./loadEvaluationZip";

async function makeZip(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "artifact.zip", { type: "application/zip" });
}

function completeArtifactFiles(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "artifact/event_eval_summary.json": JSON.stringify(summaryFixture),
    "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAuditsFixture[0])}\n`,
    "artifact/event_eval_details.jsonl": `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`,
    "artifact/model.jsonl": `${JSON.stringify(predictionRowsFixture[0])}\n`,
    "artifact/model.failures.jsonl": `${JSON.stringify(failuresFixture[0])}\n`,
    ...overrides
  };
}

describe("loadEvaluationZip", () => {
  it("loads a complete evaluation artifact", async () => {
    const file = await makeZip(completeArtifactFiles());

    const dataset = await loadEvaluationZip(file);

    expect(dataset.artifact).toBe("google_gemma_4_31B_it");
    expect(dataset.dialogues).toHaveLength(1);
    expect(dataset.dialogues[0].failure?.reason).toBe("remote provider HTTP 504");
  });

  it("throws a readable error when required files are missing", async () => {
    const file = await makeZip({
      "artifact/event_eval_summary.json": JSON.stringify(summaryFixture)
    });

    await expect(loadEvaluationZip(file)).rejects.toThrow(
      "Missing required files: row_audit_report.jsonl, event_eval_details.jsonl, prediction jsonl"
    );
  });

  it("loads a complete artifact when the optional failures file is absent", async () => {
    const file = await makeZip({
      "artifact/event_eval_summary.json": JSON.stringify(summaryFixture),
      "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAuditsFixture[0])}\n`,
      "artifact/event_eval_details.jsonl": `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`,
      "artifact/model.jsonl": `${JSON.stringify(predictionRowsFixture[0])}\n`
    });

    const dataset = await loadEvaluationZip(file);

    expect(dataset.dialogues[0].failure).toBeNull();
  });

  it("reports the summary file path when summary JSON cannot be parsed", async () => {
    const file = await makeZip(
      completeArtifactFiles({
        "artifact/event_eval_summary.json": "{not-json"
      })
    );

    await expect(loadEvaluationZip(file)).rejects.toThrow("artifact/event_eval_summary.json");
  });

  it("loads with a warning when the optional failures file cannot be parsed", async () => {
    const file = await makeZip(
      completeArtifactFiles({
        "artifact/model.failures.jsonl": "not-json\n"
      })
    );

    const dataset = await loadEvaluationZip(file);

    expect(dataset.dialogues[0].failure).toBeNull();
    expect(dataset.warnings).toHaveLength(1);
    expect(dataset.warnings[0]).toContain("artifact/model.failures.jsonl");
    expect(dataset.warnings[0]).toContain("line 1");
  });
});
