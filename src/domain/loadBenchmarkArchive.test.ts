import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { loadBenchmarkArchive } from "./loadBenchmarkArchive";

async function makeZip(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "benchmark-eval.zip", { type: "application/zip" });
}

function benchmarkArchiveFiles(): Record<string, string> {
  const summaryCsv = [
    "repo_id,status,benchmark_status,evaluation_status,benchmark_job_id,evaluation_job_id,failure_reason,overall_weighted_f1,events_failed,events_written,events_unmatched_gold,events_unmatched_pred,tokens_per_second,ttft_ms",
    "unsloth/gemma-4-E4B-it-UD-MLX-4bit,completed,completed,completed,model-ops-0006,eval-0001,,0.297252,1.0,77.0,16.0,35.0,70.24901696318689,1105.6216666666667",
    "mlx-community/Qwen3.5-9B-MLX-8bit,failed,completed,failed,model-ops-0021,,\"requestFailed(code: \"\"unavailable\"\", message: \"\"Socket closed\"\")\",,,,,,37.12500987820813,14245.656666666668",
    "unsloth/Qwen3.6-27B-UD-MLX-4bit,failed,failed,completed,,eval-0008,\"requestFailed(code: \"\"not_found\"\", message: \"\"No loaded benchmark target is available\"\")\",0.57547,0.0,56.0,9.0,7.0,,"
  ].join("\n");

  return {
    "melix-model-benchmark-eval/summary.csv": summaryCsv,
    "melix-model-benchmark-eval/manifest.json": JSON.stringify({
      commit: "920520c7d3100cb00341a8eebbda0f3c25ed61fe",
      dataset_id: "top200.event-extraction.top20.v1",
      model_order: [
        "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
        "mlx-community/Qwen3.5-9B-MLX-8bit",
        "unsloth/Qwen3.6-27B-UD-MLX-4bit"
      ],
      schema_version: "melix.local_model_benchmark_eval.v1",
      scoring_mode: "event_extraction_weighted_f1",
      timestamp: "20260509-125659"
    }),
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/benchmark/bench-run.json": JSON.stringify({
      job: { job_id: "model-ops-0006", task_kind: "image-text-to-text", status: "completed", created_at_unix_ms: 1 },
      metrics: {
        "bench.smoke.image_feature_cache_hits": 0,
        "bench.smoke.image_feature_cache_misses": 6,
        "bench.smoke.vlm_tokens_per_second": 70.24901696318689
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
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/evaluation/raw-artifacts/event_eval_summary.json": JSON.stringify({
      overall_weighted_f1: 0.297252,
      events_matched: 42,
      field_metrics: {
        actor: { f1: 0.538462 },
        time: { f1: 0.458015 },
        location: { f1: 0.24 },
        action: { f1: 0.273381 }
      }
    }),
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/evaluation/raw-artifacts/event_eval_dialogue_traces.jsonl": `${JSON.stringify({
      dialogue_id: "2",
      status: "failed",
      failure_reason: "provider returned invalid json",
      total_duration_ms: 200
    })}\n`,
    "melix-model-benchmark-eval/models/unsloth__gemma-4-E4B-it-UD-MLX-4bit/evaluation/raw-artifacts/failure_jsonl.jsonl": `${JSON.stringify({
      dialogue_id: "2",
      line_number: 2,
      reason: "normalization failed"
    })}\n`,
    "melix-model-benchmark-eval/commands.log.jsonl": `${JSON.stringify({
      name: "unsloth__gemma-4-E4B-it-UD-MLX-4bit-eval-run",
      elapsed_seconds: 123.45,
      returncode: 0,
      timeout: false
    })}\n`,
    "melix-model-benchmark-eval/hardware/powermetrics-preflight.json": JSON.stringify({
      collector: "powermetrics --samplers cpu_power,gpu_power,ane_power,thermal",
      note: "powermetrics requires superuser privileges on this host",
      returncode: 1,
      status: "instrumentation_gap"
    }),
    "melix-model-benchmark-eval/cache-audit/cache-inventory-final.json": JSON.stringify({
      label: "final",
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
  };
}

describe("loadBenchmarkArchive", () => {
  it("loads melix benchmark/evaluation archive summaries", async () => {
    const archive = await loadBenchmarkArchive(await makeZip(benchmarkArchiveFiles()));

    expect(archive.title).toBe("melix-model-benchmark-eval");
    expect(archive.manifest?.dataset_id).toBe("top200.event-extraction.top20.v1");
    expect(archive.rows).toHaveLength(3);
    expect(archive.totals.modelCount).toBe(3);
    expect(archive.totals.benchmarkCompleted).toBe(2);
    expect(archive.totals.evaluationCompleted).toBe(2);
    expect(archive.totals.completedBoth).toBe(1);
    expect(archive.bestEvaluation?.repoId).toBe("unsloth/Qwen3.6-27B-UD-MLX-4bit");
    expect(archive.fastestBenchmark?.repoId).toBe(
      "unsloth/gemma-4-E4B-it-UD-MLX-4bit"
    );
    expect(archive.rows[0].benchmarkMetrics?.["bench.smoke.image_feature_cache_misses"]).toBe(6);
    expect(archive.rows[0].fieldF1?.actor).toBe(0.538462);
    expect(archive.rows[1].failureReason).toContain("Socket closed");
    expect(archive.metricComparisons.map((metric) => metric.key)).toEqual(
      expect.arrayContaining([
        "summary.overall_weighted_f1",
        "benchmark.bench.smoke.image_feature_cache_misses",
        "benchmark.job.created_at_unix_ms",
        "evaluation.run.eval.event_extraction.duration_seconds",
        "evaluation.run.job.sample_size",
        "evaluation.summary.field_metrics.actor.f1",
        "evaluation.dialogue_trace.total_duration_ms"
      ])
    );
    expect(
      archive.metricComparisons.find(
        (metric) => metric.key === "benchmark.bench.smoke.image_feature_cache_misses"
      )?.unit
    ).toBe("count");
    expect(archive.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repoId: "mlx-community/Qwen3.5-9B-MLX-8bit",
          source: "summary.csv",
          message: expect.stringContaining("Socket closed")
        }),
        expect.objectContaining({
          repoId: "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
          source: "failure_jsonl.jsonl",
          message: "normalization failed"
        }),
        expect.objectContaining({
          repoId: "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
          source: "event_eval_dialogue_traces.jsonl",
          message: "provider returned invalid json"
        })
      ])
    );
    expect(archive.performance.peakMemoryBytes).toBeNull();
    expect(archive.performance.instrumentationGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "hardware/powermetrics-preflight.json",
          message: expect.stringContaining("powermetrics requires superuser privileges")
        })
      ])
    );
    expect(archive.performance.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repoId: "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
          phase: "evaluation",
          elapsedSeconds: 123.45
        })
      ])
    );
    expect(archive.performance.cacheEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repoId: "unsloth/gemma-4-E4B-it-UD-MLX-4bit",
          sizeBytes: 2147483648
        })
      ])
    );
    expect(archive.performance.resourceIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "runtime-logs/python-worker.log",
          message: expect.stringContaining("Insufficient Memory")
        })
      ])
    );
  });

  it("throws a readable error when the archive summary is missing", async () => {
    await expect(
      loadBenchmarkArchive(
        await makeZip({
          "melix-model-benchmark-eval/manifest.json": "{}"
        })
      )
    ).rejects.toThrow("Missing required benchmark summary.csv");
  });
});
