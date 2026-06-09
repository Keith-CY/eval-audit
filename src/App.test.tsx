import { fireEvent, render, screen } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import App from "./App";
import {
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "./test/fixtures";

async function makeZip(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "artifact.zip", { type: "application/zip" });
}

async function makeEvaluationZip(): Promise<File> {
  return makeZip({
    "artifact/event_eval_summary.json": JSON.stringify(summaryFixture),
    "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAuditsFixture[0])}\n`,
    "artifact/event_eval_details.jsonl": `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`,
    "artifact/model.jsonl": `${JSON.stringify(predictionRowsFixture[0])}\n`
  });
}

async function makeSemanticArchiveZip(): Promise<File> {
  const fieldMetric = { weight: 0.25, precision: 1, recall: 1, f1: 1, tp: 1, fp: 0, fn: 0 };
  return makeZip({
    "README.md": "# Archive\n",
    "event-extraction/dialogue-extraction/events.flat.jsonl": [
      JSON.stringify({
        source: "gold",
        dialogue_id: "1",
        outcome: "win",
        typed_score: null,
        event_index: 1,
        source_order: 1,
        actor: ["speaker_1"],
        time: ["Sunday"],
        location: null,
        action: ["dress"],
        digest: "speaker_1 Sunday dress"
      }),
      JSON.stringify({
        source: "base",
        dialogue_id: "1",
        outcome: "win",
        typed_score: 0.25,
        event_index: 1,
        source_order: 1,
        actor: ["speaker_2"],
        time: null,
        location: ["cinema"],
        action: ["movie"],
        digest: "speaker_2 cinema movie"
      }),
      JSON.stringify({
        source: "lora",
        dialogue_id: "1",
        outcome: "win",
        typed_score: 0.75,
        event_index: 1,
        source_order: 1,
        actor: ["speaker_1"],
        time: ["Sunday"],
        location: null,
        action: ["new dress"],
        digest: "speaker_1 Sunday new dress"
      })
    ].join("\n"),
    "event-extraction/semantic-f1/event_eval_semantic_summary.json": JSON.stringify({
      overall_weighted_f1: 0.75,
      strict_event_row_average_f1: 0.75,
      soft_semantic_event_precision: 0.8,
      soft_semantic_event_recall: 0.9,
      soft_semantic_event_f1: 0.847,
      matched_event_quality: 0.96,
      events_evaluated: 1,
      events_matched: 1,
      events_unmatched_gold: 0,
      events_unmatched_pred: 0,
      field_metrics: {
        actor: fieldMetric,
        time: fieldMetric,
        location: { ...fieldMetric, weight: 0.1, f1: 0, precision: 0, recall: 0, tp: 0 },
        action: { ...fieldMetric, weight: 0.35, f1: 0.92, precision: 1, recall: 0.85 }
      },
      semantic_judge: { judge_model_id: "gpt-5.5", judge_prompt_version: "semantic-judge.v4" }
    }),
    "event-extraction/semantic-f1/event_eval_semantic_details.jsonl": `${JSON.stringify({
      dialogue_id: "1",
      event_index: 0,
      gold_event_index: 0,
      pred_event_index: 0,
      match_status: "matched",
      weighted_f1: 0.75,
      active_weight: 0.9,
      alignment_score: 0.96,
      semantic_alignment_score: 0.96,
      alignment_fields: { actor: 1, time: 1, location: 0, action: 0.8 },
      fields: {
        actor: { gold: ["speaker_1"], pred: ["speaker_1"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 },
        time: { gold: ["Sunday"], pred: ["Sunday"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 },
        location: { gold: [], pred: [], tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 },
        action: { gold: ["dress"], pred: ["new dress"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 }
      }
    })}\n`,
    "event-extraction/semantic-f1/event_eval_semantic_row_audit.jsonl": `${JSON.stringify({
      dialogue_id: "1",
      alignment_strategy: "semantic_judge_event_alignment",
      gold_event_count: 1,
      pred_event_count: 1,
      matched_pairs: [{ gold_event_index: 0, pred_event_index: 0, alignment_score: 0.96 }],
      unmatched_gold_indices: [],
      unmatched_pred_indices: [],
      candidate_scores: [],
      low_quality_alignment: false,
      low_quality_alignment_threshold: 0.3,
      low_quality_alignment_pairs: []
    })}\n`,
    "event-extraction/semantic-f1/event_eval_judge_audit.jsonl": `${JSON.stringify({
      dialogue_id: "1",
      kind: "event",
      field_name: null,
      comparison_type: null,
      gold_event_index: 0,
      pred_event_index: 0,
      gold_value: null,
      pred_value: null,
      equivalent: true,
      confidence: 0.96,
      reason_code: "same_event",
      short_reason: "same dress event",
      source: "judge",
      status: "ok",
      cache_key: "sha256:event-cache"
    })}\n`,
    "event-extraction/semantic-f1/manifest.json": JSON.stringify({ run_id: "20260529T172640Z" })
  });
}

function makeGoldTopicJsonl(): File {
  return new File(
    [
      `${JSON.stringify({
        allowed_duplicate_message_ids: [],
        allowed_fallback_reasons: [],
        allowed_unassigned_message_ids: [],
        case_weight: 1,
        expected_topic_count_range: [1, 1],
        forbidden_unassigned_message_ids: ["msg-1"],
        gold_case_id: "gpt55-draft-001",
        gold_topics: [
          {
            allowed_multi_topic_message_ids: [],
            boundary_mode: "strict",
            criticality: "normal",
            description: "Review progress topic",
            gold_topic_id: "topic-1",
            label: "Review progress",
            may_merge_with: [],
            may_split_into: [],
            optional_bridge_message_ids: [],
            required_message_ids: ["msg-1"],
            topic_weight: 1
          }
        ],
        gold_version: "draft",
        messages: [
          {
            message_id: "msg-1",
            sender: "Lei",
            text: "Please finish the review deck.",
            timestamp: "2024-10-05T09:15:00"
          }
        ],
        notes: [],
        slices: ["first10"],
        source_conversation_id: "conv-1",
        source_dialogue_id: "dlg-1"
      })}\n`
    ],
    "gold-topics.jsonl",
    { type: "application/jsonl" }
  );
}

describe("App", () => {
  it("loads an evaluation zip and shows the workbench", async () => {
    render(<App />);

    await userEvent.upload(
      screen.getByLabelText("Upload evaluation zip"),
      await makeEvaluationZip()
    );

    expect(await screen.findByText("google_gemma_4_31B_it")).not.toBeNull();
    expect(screen.getAllByText("Dialogue 56")).toHaveLength(2);
  });

  it("loads a semantic event audit archive from the second tab", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("tab", { name: "Semantic event audit" }));
    expect(screen.getByLabelText("GitHub token")).not.toBeNull();
    expect(screen.getByLabelText("GitHub directory URL")).not.toBeNull();

    await userEvent.upload(
      screen.getByLabelText("Upload semantic audit archive"),
      await makeSemanticArchiveZip()
    );

    expect((await screen.findAllByText("artifact.zip")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dialogue 1")).toHaveLength(2);
    expect(screen.getByText("Soft semantic F1")).not.toBeNull();
    expect(screen.getByText("Gold #1 <-> Lora #1")).not.toBeNull();
    expect(screen.getByText("same dress event")).not.toBeNull();
  });

  it("loads a semantic archive dropped onto the semantic import panel", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("tab", { name: "Semantic event audit" }));

    fireEvent.drop(screen.getByRole("region", { name: "Upload semantic event audit" }), {
      dataTransfer: {
        files: [await makeSemanticArchiveZip()]
      }
    });

    expect((await screen.findAllByText("artifact.zip")).length).toBeGreaterThan(0);
    expect(screen.getByText("Gold #1 <-> Lora #1")).not.toBeNull();
  });

  it("loads a gold topic dataset from the third tab", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("tab", { name: "Gold topic dataset" }));

    await userEvent.upload(
      screen.getByLabelText("Upload gold topic dataset JSONL"),
      makeGoldTopicJsonl()
    );

    expect(await screen.findByText("gold-topics.jsonl")).not.toBeNull();
    expect(screen.getByText("gpt55-draft-001")).not.toBeNull();
    const detail = within(screen.getByLabelText("Gold topic message detail"));
    expect(detail.getByText("Please finish the review deck.")).not.toBeNull();
    expect(detail.getByText("Review progress")).not.toBeNull();
  });

  it("shows a readable error and keeps upload available when required files are missing", async () => {
    render(<App />);

    const input = screen.getByLabelText("Upload evaluation zip");
    await userEvent.upload(
      input,
      await makeZip({
        "artifact/event_eval_summary.json": JSON.stringify(summaryFixture)
      })
    );

    expect(await screen.findByText(/Missing required files/)).not.toBeNull();
    expect(screen.getByLabelText("Upload evaluation zip")).toHaveProperty("disabled", false);
  });
});
