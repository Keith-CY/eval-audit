import { fireEvent, render, screen, within } from "@testing-library/react";
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

async function makeBenchmarkArchiveZip(): Promise<File> {
  return makeZip({
    "melix-model-benchmark-eval/summary.csv": [
      "repo_id,status,benchmark_status,evaluation_status,benchmark_job_id,evaluation_job_id,failure_reason,overall_weighted_f1,events_failed,events_written,events_unmatched_gold,events_unmatched_pred,tokens_per_second,ttft_ms",
      "unsloth/gemma-4-E4B-it-UD-MLX-4bit,completed,completed,completed,model-ops-0006,eval-0001,,0.297252,1.0,77.0,16.0,35.0,70.24901696318689,1105.6216666666667",
      "unsloth/Qwen3.6-27B-UD-MLX-4bit,failed,failed,completed,,eval-0008,\"requestFailed(code: \"\"not_found\"\", message: \"\"No loaded benchmark target is available\"\")\",0.57547,0.0,56.0,9.0,7.0,,"
    ].join("\n"),
    "melix-model-benchmark-eval/manifest.json": JSON.stringify({
      commit: "920520c7d3100cb00341a8eebbda0f3c25ed61fe",
      dataset_id: "top200.event-extraction.top20.v1",
      schema_version: "melix.local_model_benchmark_eval.v1",
      scoring_mode: "event_extraction_weighted_f1",
      timestamp: "20260509-125659"
    }),
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/evaluation/raw-artifacts/event_eval_summary.json": JSON.stringify({
      overall_weighted_f1: 0.297252,
      field_metrics: {
        actor: { f1: 0.538462 },
        time: { f1: 0.458015 },
        location: { f1: 0.24 },
        action: { f1: 0.273381 }
      }
    }),
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/benchmark/benchmark.csv": [
      "job_id,model_id,metric_name,metric_value,unit",
      "model-ops-0006,unsloth/gemma-4-E4B-it-UD-MLX-4bit,bench.smoke.image_feature_cache_misses,6.0,count"
    ].join("\n"),
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/evaluation/eval-run.json": JSON.stringify([
      {
        job: { job_id: "eval-0001", status: "completed", sample_size: 20 },
        results: [
          {
            metrics: [
              {
                name: "eval.event_extraction.duration_seconds",
                unit: "s",
                value: 254.026569
              }
            ],
            sample_size: 20
          }
        ]
      }
    ]),
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/evaluation/raw-artifacts/event_eval_dialogue_traces.jsonl": `${JSON.stringify({
      dialogue_id: "2",
      line_number: 2,
      status: "failed",
      failure_reason: "provider returned invalid json",
      total_duration_ms: 200
    })}\n`,
    "melix-model-benchmark-eval/commands.log.jsonl": `${JSON.stringify({
      name: "unsloth__gemma-4-E4B-it-UD-MLX-4bit-eval-run",
      elapsed_seconds: 123.45,
      returncode: 0,
      timeout: false
    })}\n`,
    "melix-model-benchmark-eval/hardware/powermetrics-preflight.json": JSON.stringify({
      note: "powermetrics requires superuser privileges on this host",
      returncode: 1,
      status: "instrumentation_gap"
    }),
    "melix-model-benchmark-eval/cache-audit/cache-inventory-final.json": JSON.stringify({
      entries: [
        {
          exists: true,
          label: "final",
          path: "/cache/model",
          repo_id: "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
          size_bytes: 2147483648
        }
      ]
    }),
    "melix-model-benchmark-eval/runtime-logs/python-worker.log":
      "[METAL] Command buffer execution failed: Insufficient Memory\n"
  });
}

async function makeConversationRebuildZip(): Promise<File> {
  return makeZip({
    "final_lccc_large_min10_topic_rebuild_dialogues.json": JSON.stringify([
      {
        dialogue_id: "dlg-topic-a",
        source_dialogue_id: "dlg-source-1",
        source_topic_dialogue_id: "dlg-topic-a",
        source_topic_id: "topic-1",
        source_topic_label: "Gift refusal",
        generation_strategy: "topic_rebuild",
        generation_mode: "topic_rebuild",
        source_dataset: "thu-coai/lccc:large",
        source_row_index: 42,
        input: {
          dialogue: [
            { message_id: "m1", sender: "speaker_1", text: "不用 不用 ， 心意 收到 了" },
            { message_id: "m2", sender: "speaker_2", text: "贴身 戴 的 亲" }
          ]
        },
        lineage: {
          topic_rebuild: {
            topic_id: "topic-1",
            topic_label: "Gift refusal",
            topic_description: "A short exchange about declining a wearable gift.",
            source_conversation_id: "conv-source-1",
            topic_rebuild_method: "llm_topic_membership"
          }
        }
      },
      {
        dialogue_id: "dlg-topic-b",
        source_dialogue_id: "dlg-source-1",
        source_topic_dialogue_id: "dlg-topic-b",
        source_topic_id: "topic-2",
        source_topic_label: "Weekend plan",
        generation_strategy: "topic_rebuild",
        generation_mode: "topic_rebuild",
        source_dataset: "thu-coai/lccc:large",
        source_row_index: 42,
        input: {
          dialogue: [
            { message_id: "m3", sender: "speaker_1", text: "周日 去 博物馆 吗" },
            { message_id: "m4", sender: "speaker_2", text: "可以 ， 再 看 话剧" }
          ]
        },
        lineage: {
          topic_rebuild: {
            topic_id: "topic-2",
            topic_label: "Weekend plan",
            topic_description: "A plan to meet on Sunday.",
            source_conversation_id: "conv-source-1",
            topic_rebuild_method: "llm_topic_membership"
          }
        }
      },
      {
        dialogue_id: "dlg-topic-c",
        source_dialogue_id: "dlg-source-2",
        source_topic_dialogue_id: "dlg-topic-c",
        source_topic_id: "topic-1",
        source_topic_label: "Gift refusal",
        generation_strategy: "topic_rebuild",
        generation_mode: "topic_rebuild",
        source_dataset: "thu-coai/lccc:large",
        source_row_index: 84,
        input: {
          dialogue: [
            { message_id: "m5", sender: "speaker_1", text: "这个 礼物 我 真的 用不上" }
          ]
        },
        lineage: {
          topic_rebuild: {
            topic_id: "topic-1",
            topic_label: "Gift refusal",
            topic_description: "Another gift refusal exchange.",
            source_conversation_id: "conv-source-2",
            topic_rebuild_method: "llm_topic_membership"
          }
        }
      }
    ]),
    "final_lccc_large_min10_topic_rebuild_dialogues_report.json": JSON.stringify({
      inputs: {
        lccc_hf_repo_id: "thu-coai/lccc",
        lccc_config_name: "large",
        lccc_min_turns: 10
      },
      run: {
        llm_model_id: "gpt-5.5",
        drop_full_dialogue_rebuilds: true
      },
      datasets: [
        {
          label: "thu-coai/lccc:large",
          output_topic_dialogues: 3,
          source_dialogues_processed: 2,
          dropped_full_dialogue_rebuilds: 1
        }
      ],
      counts: {
        total: 3,
        by_dataset: { "thu-coai/lccc:large": 3 },
        by_strategy: { topic_rebuild: 3 },
        duplicate_dialogue_id_count: 0
      },
      turn_counts: {
        min: 1,
        max: 2,
        average: 1.666667
      }
    })
  });
}

describe("App", () => {
  it("loads an evaluation zip and shows the workbench", async () => {
    render(<App />);

    await userEvent.upload(
      screen.getByLabelText("Upload evaluation zip"),
      await makeEvaluationZip()
    );

    expect(await screen.findByText("google_gemma_4_31B_it")).toBeInTheDocument();
    expect(screen.getAllByText("Dialogue 56")).toHaveLength(2);
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

    expect(await screen.findByText(/Missing required files/)).toBeInTheDocument();
    expect(screen.getByLabelText("Upload evaluation zip")).toBeEnabled();
  });

  it("loads a benchmark archive by drag and drop and shows the comparison dashboard", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Benchmark compare" }));
    fireEvent.drop(screen.getByLabelText("Drop benchmark archive zip"), {
      dataTransfer: { files: [await makeBenchmarkArchiveZip()] }
    });

    expect(await screen.findByText(/top200\.event-extraction\.top20\.v1/)).toBeInTheDocument();
    expect(screen.getAllByText("Benchmark / Evaluation Compare").length).toBeGreaterThan(0);
    expect(screen.getByText("Best evaluation F1")).toBeInTheDocument();
    expect(screen.getByText("Fastest benchmark")).toBeInTheDocument();
    expect(screen.getByLabelText("Benchmark vs evaluation chart")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Benchmark evaluation model comparison" });
    expect(within(table).getByText("unsloth/gemma-4-E4B-it-UD-MLX-4bit")).toBeInTheDocument();
    expect(within(table).getByText("70.25 tok/s")).toBeInTheDocument();
    expect(within(table).getByText("0.575")).toBeInTheDocument();
    expect(screen.getByText("All quantitative metrics")).toBeInTheDocument();
    expect(screen.getByText("Benchmark errors")).toBeInTheDocument();
    expect(screen.getByText("Performance reports")).toBeInTheDocument();
    expect(screen.getByText("Peak memory not captured")).toBeInTheDocument();
    expect(screen.getByText("Insufficient Memory")).toBeInTheDocument();
    expect(screen.getByText("benchmark.bench.smoke.image_feature_cache_misses")).toBeInTheDocument();
    expect(screen.getByText("provider returned invalid json")).toBeInTheDocument();
  });

  it("loads a conversation rebuild archive and shows source-topic relationships", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Conversation rebuild" }));
    fireEvent.drop(screen.getByLabelText("Drop conversation rebuild zip"), {
      dataTransfer: { files: [await makeConversationRebuildZip()] }
    });

    expect(await screen.findAllByText("dlg-source-1")).not.toHaveLength(0);
    expect(screen.getAllByText("Conversation Rebuild Relations").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Rebuilt dialogues")).not.toHaveLength(0);
    expect(screen.getAllByText("Source dialogues")).not.toHaveLength(0);
    expect(screen.getByText("Source topics")).toBeInTheDocument();
    expect(screen.getAllByText("conv-source-1")).not.toHaveLength(0);
    expect(screen.getAllByText("Gift refusal")).not.toHaveLength(0);
    expect(screen.getAllByText("Weekend plan")).not.toHaveLength(0);
    expect(
      screen.getByText((_, element) =>
        Boolean(
          element?.classList.contains("relation-path") &&
            element.textContent?.replace(/\s+/g, " ").trim() ===
              "dlg-source-1 -> topic-1 -> dlg-topic-a"
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByText("A short exchange about declining a wearable gift.")).toBeInTheDocument();
    expect(screen.getByText("speaker_1")).toBeInTheDocument();
    expect(screen.getByText("不用 不用 ， 心意 收到 了")).toBeInTheDocument();

    const relationshipMap = screen.getByLabelText("Source-topic rebuild relationship diagram");
    expect(within(relationshipMap).getByText("Gift refusal")).toBeInTheDocument();
    expect(within(relationshipMap).getByText("Weekend plan")).toBeInTheDocument();
    expect(
      within(relationshipMap).getByText((_, element) =>
        Boolean(
          element?.classList.contains("relation-path") &&
            element.textContent?.replace(/\s+/g, " ").trim() ===
              "dlg-source-1 -> topic-2 -> dlg-topic-b"
        )
      )
    ).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Filter by rebuilt topic"), "topic-2");

    expect(screen.getByRole("heading", { name: "dlg-topic-b" })).toBeInTheDocument();
    expect(screen.getByText("A plan to meet on Sunday.")).toBeInTheDocument();
    expect(screen.queryByText("Another gift refusal exchange.")).not.toBeInTheDocument();
    const sourceTable = screen.getByRole("table", {
      name: "Conversation rebuild source dialogue splits"
    });
    expect(within(sourceTable).getByText("dlg-source-1")).toBeInTheDocument();
    expect(within(sourceTable).queryByText("dlg-source-2")).not.toBeInTheDocument();
  });
});
