import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { EVALUATION_ZIP_LIMITS, loadEvaluationZip } from "./loadEvaluationZip";

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

  it("rejects oversized zip files before parsing", async () => {
    const oversizedFile = {
      size: EVALUATION_ZIP_LIMITS.maxZipBytes + 1
    } as File;

    await expect(loadEvaluationZip(oversizedFile)).rejects.toThrow(
      "Evaluation zip is too large"
    );
  });

  it("rejects zip files with too many entries", async () => {
    const files = completeArtifactFiles();
    for (let index = 0; index <= EVALUATION_ZIP_LIMITS.maxEntries; index += 1) {
      files[`extra/${index}.txt`] = "";
    }

    const file = await makeZip(files);

    await expect(loadEvaluationZip(file)).rejects.toThrow(
      "Evaluation zip contains too many files"
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

  it("loads melix evaluation bundles with report, gold, and prediction directories", async () => {
    const summary = {
      overall_weighted_f1: 0.5,
      events_evaluated: 2,
      events_matched: 1,
      events_unmatched_gold: 1,
      events_unmatched_pred: 0,
      field_metrics: {
        actor: { tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1, weight: 0.3 },
        time: { tp: 0, fp: 1, fn: 1, precision: 0, recall: 0, f1: 0, weight: 0.25 },
        location: { tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0, weight: 0.1 },
        action: { tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1, weight: 0.35 }
      },
      weights: { actor: 0.3, time: 0.25, location: 0.1, action: 0.35 }
    };
    const goldRow = {
      dialogue_id: "1",
      dialogue: ["speaker_1:今天 加班"],
      events: [
        {
          actor: ["speaker_1"],
          time: ["今天"],
          location: null,
          action: ["加班"],
          digest: "speaker_1今天加班"
        },
        {
          actor: ["speaker_2"],
          time: ["明天"],
          location: null,
          action: ["开会"],
          digest: "speaker_2明天开会"
        }
      ]
    };
    const predictionRow = {
      dialogue_id: "1",
      dialogue: ["speaker_1:今天 加班"],
      events: [
        {
          actor: ["speaker_1"],
          time: ["今天"],
          location: null,
          action: ["加班"],
          digest: "speaker_1今天加班"
        }
      ]
    };
    const rowAudit = {
      dialogue_id: "1",
      gold_event_count: 2,
      pred_event_count: 1,
      matched_pairs: [{ gold_event_index: 0, pred_event_index: 0, alignment_score: 1 }],
      unmatched_gold_indices: [1],
      unmatched_pred_indices: []
    };
    const detail = {
      dialogue_id: "1",
      event_index: 0,
      gold_event_index: 0,
      pred_event_index: 0,
      match_status: "matched",
      weighted_f1: 1,
      active_weight: 0.9,
      alignment_score: 1,
      fields: {
        actor: { gold: ["speaker_1"], pred: ["speaker_1"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 },
        time: { gold: ["今天"], pred: ["今天"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 },
        location: { gold: [], pred: [], tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 },
        action: { gold: ["加班"], pred: ["加班"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 }
      }
    };
    const file = await makeZip({
      "eval-0001/gold_subset.jsonl": `${JSON.stringify(goldRow)}\n`,
      "eval-0001/predictions/deepseek-v4-pro.jsonl": `${JSON.stringify(predictionRow)}\n`,
      "eval-0001/predictions/deepseek-v4-pro.failures.jsonl": "",
      "eval-0001/reports/deepseek-v4-pro/event_eval_summary.json": JSON.stringify(summary),
      "eval-0001/reports/deepseek-v4-pro/event_eval_row_audit.jsonl": `${JSON.stringify(rowAudit)}\n`,
      "eval-0001/reports/deepseek-v4-pro/event_eval_details.jsonl": `${JSON.stringify(detail)}\n`
    });

    const dataset = await loadEvaluationZip(file);

    expect(dataset.artifact).toBe("deepseek-v4-pro");
    expect(dataset.summary.rows_checked).toBe(1);
    expect(dataset.summary.field_metrics.actor.TP).toBe(1);
    expect(dataset.dialogues).toHaveLength(1);
    expect(dataset.dialogues[0].rowAudit?.matched_events).toBe(1);
    expect(dataset.dialogues[0].rowAudit?.unmatched_gold).toBe(1);
    expect(dataset.dialogues[0].rowAudit?.events[0].fields.actor.TP).toBe(1);
    expect(dataset.dialogues[0].rowAudit?.events[0].gold_event?.digest).toBe(
      "speaker_1今天加班"
    );
    expect(dataset.dialogues[0].rowAudit?.events[0].pred_event?.digest).toBe(
      "speaker_1今天加班"
    );
  });
});
