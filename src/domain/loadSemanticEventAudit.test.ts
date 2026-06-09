import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadSemanticEventAuditFromGitHub,
  loadSemanticEventAuditZip
} from "./loadSemanticEventAudit";

const flatEvents = [
  {
    source: "gold",
    dialogue_id: "1",
    outcome: "win",
    typed_score: null,
    event_index: 1,
    source_order: 1,
    actor: ["speaker_1"],
    time: ["Friday"],
    location: null,
    action: ["movie"],
    digest: "speaker_1 Friday movie"
  },
  {
    source: "gold",
    dialogue_id: "1",
    outcome: "win",
    typed_score: null,
    event_index: 2,
    source_order: 2,
    actor: ["speaker_1"],
    time: ["Sunday"],
    location: null,
    action: ["dress"],
    digest: "speaker_1 Sunday dress"
  },
  {
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
  },
  {
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
  },
  {
    source: "lora",
    dialogue_id: "1",
    outcome: "win",
    typed_score: 0.75,
    event_index: 2,
    source_order: 2,
    actor: ["speaker_2"],
    time: ["Today"],
    location: null,
    action: ["run"],
    digest: "speaker_2 Today run"
  }
];

const summary = {
  overall_weighted_f1: 0.45,
  strict_event_row_average_f1: 0.45,
  soft_semantic_event_precision: 0.7,
  soft_semantic_event_recall: 0.8,
  soft_semantic_event_f1: 0.747,
  matched_event_quality: 0.93,
  events_evaluated: 3,
  events_matched: 1,
  events_unmatched_gold: 1,
  events_unmatched_pred: 1,
  field_metrics: {
    actor: { weight: 0.3, precision: 1, recall: 1, f1: 1, tp: 1, fp: 0, fn: 0 },
    time: { weight: 0.25, precision: 1, recall: 1, f1: 1, tp: 1, fp: 0, fn: 0 },
    location: { weight: 0.1, precision: 0, recall: 0, f1: 0, tp: 0, fp: 0, fn: 0 },
    action: { weight: 0.35, precision: 0.5, recall: 1, f1: 0.667, tp: 1, fp: 1, fn: 0 }
  },
  weights: { actor: 0.3, time: 0.25, location: 0.1, action: 0.35 },
  semantic_judge: {
    judge_model_id: "gpt-5.5",
    judge_prompt_version: "semantic-judge.v4",
    calls: 5,
    failures: 0
  }
};

const details = [
  {
    dialogue_id: "1",
    event_index: 0,
    gold_event_index: 0,
    pred_event_index: null,
    match_status: "unmatched_gold",
    weighted_f1: 0,
    active_weight: 0,
    alignment_score: 0,
    semantic_alignment_score: 0,
    alignment_fields: {},
    fields: {
      actor: { gold: ["speaker_1"], pred: [], tp: 0, fp: 0, fn: 1, precision: 0, recall: 0, f1: 0 },
      time: { gold: ["Friday"], pred: [], tp: 0, fp: 0, fn: 1, precision: 0, recall: 0, f1: 0 },
      location: { gold: [], pred: [], tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 },
      action: { gold: ["movie"], pred: [], tp: 0, fp: 0, fn: 1, precision: 0, recall: 0, f1: 0 }
    }
  },
  {
    dialogue_id: "1",
    event_index: 1,
    gold_event_index: 1,
    pred_event_index: 0,
    match_status: "matched",
    weighted_f1: 0.75,
    active_weight: 0.9,
    alignment_score: 0.96,
    semantic_alignment_score: 0.96,
    alignment_fields: { actor: 1, time: 1, location: 0, action: 0.8 },
    fields: {
      actor: {
        gold: ["speaker_1"],
        pred: ["speaker_1"],
        tp: 1,
        fp: 0,
        fn: 0,
        precision: 1,
        recall: 1,
        f1: 1,
        semantic_matches: [{ gold_value: "speaker_1", pred_value: "speaker_1", score: 1 }]
      },
      time: {
        gold: ["Sunday"],
        pred: ["Sunday"],
        tp: 1,
        fp: 0,
        fn: 0,
        precision: 1,
        recall: 1,
        f1: 1,
        semantic_matches: [{ gold_value: "Sunday", pred_value: "Sunday", score: 1 }]
      },
      location: { gold: [], pred: [], tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 },
      action: {
        gold: ["dress"],
        pred: ["new dress"],
        tp: 1,
        fp: 0,
        fn: 0,
        precision: 1,
        recall: 1,
        f1: 1,
        semantic_matches: [{ gold_value: "dress", pred_value: "new dress", score: 0.92 }]
      }
    }
  },
  {
    dialogue_id: "1",
    event_index: 2,
    gold_event_index: null,
    pred_event_index: 1,
    match_status: "unmatched_pred",
    weighted_f1: 0,
    active_weight: 0,
    alignment_score: 0,
    semantic_alignment_score: 0,
    alignment_fields: {},
    fields: {
      actor: { gold: [], pred: ["speaker_2"], tp: 0, fp: 1, fn: 0, precision: 0, recall: 0, f1: 0 },
      time: { gold: [], pred: ["Today"], tp: 0, fp: 1, fn: 0, precision: 0, recall: 0, f1: 0 },
      location: { gold: [], pred: [], tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 },
      action: { gold: [], pred: ["run"], tp: 0, fp: 1, fn: 0, precision: 0, recall: 0, f1: 0 }
    }
  }
];

const rowAudit = {
  dialogue_id: "1",
  alignment_strategy: "semantic_judge_event_alignment",
  gold_event_count: 2,
  pred_event_count: 2,
  matched_pairs: [{ gold_event_index: 1, pred_event_index: 0, alignment_score: 0.96 }],
  unmatched_gold_indices: [0],
  unmatched_pred_indices: [1],
  candidate_scores: [
    {
      gold_event_index: 0,
      pred_event_index: 0,
      alignment_score: 0,
      accepted: false,
      source: "judge",
      reason_code: "different_event",
      local_alignment_score: 0.2
    },
    {
      gold_event_index: 1,
      pred_event_index: 0,
      alignment_score: 0.96,
      accepted: true,
      source: "judge",
      reason_code: "same_event",
      local_alignment_score: 0.8
    }
  ],
  low_quality_alignment: false,
  low_quality_alignment_threshold: 0.3,
  low_quality_alignment_pairs: []
};

const judgeAudit = [
  {
    dialogue_id: "1",
    kind: "event",
    field_name: null,
    comparison_type: null,
    gold_event_index: 1,
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
  },
  {
    dialogue_id: "1",
    kind: "field",
    field_name: "action",
    comparison_type: null,
    gold_event_index: 1,
    pred_event_index: 0,
    gold_value: "dress",
    pred_value: "new dress",
    equivalent: true,
    confidence: 0.92,
    reason_code: "same_value",
    short_reason: "new dress is equivalent",
    source: "judge",
    status: "ok",
    cache_key: "sha256:field-cache"
  }
];

function jsonl(rows: unknown[]): string {
  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

function archiveFiles(): Record<string, string> {
  return {
    "README.md": "# Semantic audit archive\n",
    "event-extraction/dialogue-extraction/events.flat.jsonl": jsonl(flatEvents),
    "event-extraction/semantic-f1/event_eval_semantic_summary.json": JSON.stringify(summary),
    "event-extraction/semantic-f1/event_eval_semantic_details.jsonl": jsonl(details),
    "event-extraction/semantic-f1/event_eval_semantic_row_audit.jsonl": jsonl([rowAudit]),
    "event-extraction/semantic-f1/event_eval_judge_audit.jsonl": jsonl(judgeAudit),
    "event-extraction/semantic-f1/manifest.json": JSON.stringify({
      run_id: "20260529T172640Z",
      adapter_name: "dialogue-v22",
      source_job_id: "eval-0997",
      artifacts: {}
    })
  };
}

async function makeArchiveZip(files = archiveFiles()): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "Archive.zip", { type: "application/zip" });
}

function githubContent(content: string) {
  return {
    type: "file",
    encoding: "base64",
    content: btoa(content)
  };
}

describe("loadSemanticEventAuditZip", () => {
  it("loads archive semantic artifacts and links gold to lora pred events", async () => {
    const dataset = await loadSemanticEventAuditZip(await makeArchiveZip());

    expect(dataset.artifact).toBe("Archive.zip");
    expect(dataset.importSource.kind).toBe("zip");
    expect(dataset.targetSource).toBe("lora");
    expect(dataset.runId).toBe("20260529T172640Z");
    expect(dataset.summary.softSemanticEventF1).toBe(0.747);
    expect(dataset.summary.fieldMetrics.action.f1).toBe(0.667);

    const dialogue = dataset.dialogues[0];
    expect(dialogue.dialogue_id).toBe("1");
    expect(dialogue.baseEvents[0].digest).toBe("speaker_2 cinema movie");
    expect(dialogue.comparisons.map((comparison) => comparison.match_status)).toEqual([
      "unmatched_gold",
      "matched",
      "unmatched_pred"
    ]);

    const matched = dialogue.comparisons[1];
    expect(matched.goldEvent?.digest).toBe("speaker_1 Sunday dress");
    expect(matched.predEvent?.digest).toBe("speaker_1 Sunday new dress");
    expect(matched.eventJudge?.cache_key).toBe("sha256:event-cache");
    expect(matched.fieldJudges.action[0].cache_key).toBe("sha256:field-cache");
    expect(dialogue.rowAudit?.candidate_scores[1].accepted).toBe(true);
  });

  it("loads an archive whose semantic root is event-extraction/README.md", async () => {
    const files = archiveFiles();
    delete files["README.md"];
    files["event-extraction/README.md"] = "# Event extraction\n";

    const dataset = await loadSemanticEventAuditZip(await makeArchiveZip(files));

    expect(dataset.dialogues[0].baseEvents[0].digest).toBe("speaker_2 cinema movie");
    expect(dataset.dialogues[0].comparisons[1].predEvent?.digest).toBe(
      "speaker_1 Sunday new dress"
    );
  });

  it("reports missing fixed archive paths", async () => {
    const files = archiveFiles();
    delete files["event-extraction/semantic-f1/event_eval_judge_audit.jsonl"];

    await expect(loadSemanticEventAuditZip(await makeArchiveZip(files))).rejects.toThrow(
      "event-extraction/semantic-f1/event_eval_judge_audit.jsonl"
    );
  });
});

describe("loadSemanticEventAuditFromGitHub", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the fixed archive directory paths using an in-memory token", async () => {
    const files = archiveFiles();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const requestPath = decodeURIComponent(url.split("/contents/")[1].split("?")[0]);
      const relativePath =
        requestPath === "reports/run-1" ? "" : requestPath.replace("reports/run-1/", "");
      const content = files[relativePath];

      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer ghp_test");

      if (relativePath === "") {
        return new Response(JSON.stringify([{ name: "event-extraction", type: "dir" }]), {
          status: 200
        });
      }

      if (!content) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }

      return new Response(JSON.stringify(githubContent(content)), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const dataset = await loadSemanticEventAuditFromGitHub({
      token: " ghp_test ",
      directoryUrl: " https://github.com/Keith-CY/eval-audit/tree/main/reports/run-1 "
    });

    expect(dataset.importSource).toEqual({
      kind: "github",
      owner: "Keith-CY",
      repo: "eval-audit",
      ref: "main",
      path: "reports/run-1"
    });
    expect(dataset.dialogues[0].comparisons[1].eventJudge?.short_reason).toBe("same dress event");
  });

  it("reports unreadable GitHub directories as path or token access problems", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      loadSemanticEventAuditFromGitHub({
        token: "ghp_secret",
        directoryUrl: "https://github.com/Keith-CY/eval-audit/tree/main/missing"
      })
    ).rejects.toThrow("GitHub directory is not readable");

    await expect(
      loadSemanticEventAuditFromGitHub({
        token: "ghp_secret",
        directoryUrl: "https://github.com/Keith-CY/eval-audit/tree/main/missing"
      })
    ).rejects.not.toThrow("ghp_secret");
  });
});
