import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticEventAuditWorkbench } from "./SemanticEventAuditWorkbench";
import type { SemanticEventAuditDataset } from "../domain/types";

const dataset: SemanticEventAuditDataset = {
  artifact: "Archive.zip",
  artifactId: "zip:Archive.zip:123:456",
  importSource: {
    kind: "zip",
    fileName: "Archive.zip",
    size: 123,
    lastModified: 456
  },
  runId: "20260529T172640Z",
  targetSource: "lora",
  warnings: [],
  summary: {
    overallWeightedF1: 0.45,
    strictEventRowAverageF1: 0.45,
    softSemanticEventPrecision: 0.7,
    softSemanticEventRecall: 0.8,
    softSemanticEventF1: 0.747,
    matchedEventQuality: 0.93,
    eventsEvaluated: 3,
    eventsMatched: 1,
    eventsUnmatchedGold: 1,
    eventsUnmatchedPred: 1,
    judgeModelId: "gpt-5.5",
    judgePromptVersion: "semantic-judge.v4",
    fieldMetrics: {
      actor: { weight: 0.3, precision: 1, recall: 1, f1: 1, tp: 1, fp: 0, fn: 0 },
      time: { weight: 0.25, precision: 1, recall: 1, f1: 1, tp: 1, fp: 0, fn: 0 },
      location: { weight: 0.1, precision: 0, recall: 0, f1: 0, tp: 0, fp: 0, fn: 0 },
      action: { weight: 0.35, precision: 0.5, recall: 1, f1: 0.667, tp: 1, fp: 1, fn: 0 }
    }
  },
  dialogues: [
    {
      dialogue_id: "1",
      outcome: "win",
      typedScores: { base: 0.25, gold: null, lora: 0.75 },
      goldEvents: [
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
        }
      ],
      predEvents: [
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
        }
      ],
      baseEvents: [
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
        }
      ],
      rowAudit: {
        dialogue_id: "1",
        alignment_strategy: "semantic_judge_event_alignment",
        gold_event_count: 2,
        pred_event_count: 1,
        matched_pairs: [{ gold_event_index: 1, pred_event_index: 0, alignment_score: 0.96 }],
        unmatched_gold_indices: [0],
        unmatched_pred_indices: [],
        candidate_scores: [
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
      },
      totalEvents: 2,
      unmatchedGold: 1,
      unmatchedPred: 0,
      matched: 1,
      averageWeightedF1: 0.375,
      hasLowQualityAlignment: false,
      comparisons: [
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
          goldEvent: {
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
          predEvent: null,
          eventJudge: null,
          fieldJudges: { actor: [], time: [], location: [], action: [] },
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
          goldEvent: {
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
          predEvent: {
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
          eventJudge: {
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
          fieldJudges: {
            actor: [],
            time: [],
            location: [],
            action: [
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
            ]
          },
          fields: {
            actor: { gold: ["speaker_1"], pred: ["speaker_1"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 },
            time: { gold: ["Sunday"], pred: ["Sunday"], tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1 },
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
        }
      ]
    }
  ]
};

describe("SemanticEventAuditWorkbench", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a dialogue relation graph and switches selected semantic details", async () => {
    render(<SemanticEventAuditWorkbench dataset={dataset} />);

    expect(screen.getAllByText("Archive.zip").length).toBeGreaterThan(0);
    expect(screen.getByText("0.7470")).toBeInTheDocument();
    expect(screen.getByText("Matched quality")).toBeInTheDocument();
    expect(screen.getAllByText("action").length).toBeGreaterThan(0);
    expect(screen.getByText("F1 0.6670")).toBeInTheDocument();

    const graph = screen.getByLabelText("Dialogue 1 event relation graph");
    expect(within(graph).getByText("Gold events")).toBeInTheDocument();
    expect(within(graph).getByText("Lora pred events")).toBeInTheDocument();
    expect(within(graph).getByLabelText("Gold event #1 missing pred")).toBeInTheDocument();
    expect(within(graph).getByLabelText("Gold event #2 matched to Lora event #1")).toBeInTheDocument();
    expect(within(graph).getByLabelText("Lora event #1 matched to Gold event #2")).toBeInTheDocument();
    expect(within(graph).getByRole("button", { name: "Select match Gold #2 to Lora #1 F1 0.7500" })).toBeInTheDocument();
    expect(within(graph).queryByText("speaker_1 Sunday dress")).not.toBeInTheDocument();

    const selectedDetails = screen.getByLabelText("Selected semantic item details");
    expect(within(selectedDetails).getByText("Gold #1 <-> No pred match")).toBeInTheDocument();
    expect(within(selectedDetails).getByText("missing pred")).toBeInTheDocument();

    await userEvent.click(within(graph).getByRole("button", { name: "Select match Gold #2 to Lora #1 F1 0.7500" }));

    expect(within(selectedDetails).getByText("Gold #2 <-> Lora #1")).toBeInTheDocument();
    expect(within(selectedDetails).getByText("event semantic F1 0.7500")).toBeInTheDocument();
    expect(within(selectedDetails).getByText("same dress event")).toBeInTheDocument();
    expect(within(selectedDetails).getAllByText("F1 1.0000").length).toBeGreaterThanOrEqual(2);

    await userEvent.click(screen.getByRole("button", { name: "Show candidates for dialogue 1" }));

    expect(screen.getByText("gold 1 -> lora 0")).toBeInTheDocument();
    expect(screen.getAllByText("same_event").length).toBeGreaterThan(0);
  });

  it("persists semantic feedback and exports non-empty feedback as JSONL", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<SemanticEventAuditWorkbench dataset={dataset} />);
    await userEvent.click(
      within(screen.getByLabelText("Dialogue 1 event relation graph")).getByRole("button", {
        name: "Select match Gold #2 to Lora #1 F1 0.7500"
      })
    );

    await userEvent.type(
      screen.getByLabelText("Feedback for event semantic judgment dialogue 1 gold 1 pred 0"),
      "event relation is correct"
    );
    await userEvent.click(
      within(screen.getByLabelText("Selected semantic item details")).getByRole("button", {
        name: "Show details"
      })
    );
    await userEvent.type(
      screen.getByLabelText("Feedback for field action semantic judgment dialogue 1 gold 1 pred 0"),
      "field equivalence is acceptable"
    );

    expect(
      screen.getByText("Feedback").closest(".metric-card")?.textContent
    ).toContain("2feedback");

    await userEvent.click(screen.getByRole("button", { name: "Copy feedback JSONL" }));

    const exported = writeText.mock.calls[0][0] as string;
    const rows = exported.trim().split("\n").map((line) => JSON.parse(line));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      feedback_scope: "event",
      dialogue_id: "1",
      gold_event_index: 1,
      pred_event_index: 0,
      judge_cache_key: "sha256:event-cache",
      feedback: "event relation is correct"
    });
    expect(rows[1]).toMatchObject({
      feedback_scope: "field",
      field_name: "action",
      judge_cache_key: "sha256:field-cache",
      feedback: "field equivalence is acceptable"
    });

    const stored = JSON.parse(localStorage.getItem("semantic-audit-feedback:zip:Archive.zip:123:456") ?? "{}");
    expect(Object.values(stored)).toContain("event relation is correct");
  });

  it("can switch dialogue sorting", async () => {
    render(
      <SemanticEventAuditWorkbench
        dataset={{
          ...dataset,
          dialogues: [
            ...dataset.dialogues,
            {
              ...dataset.dialogues[0],
              dialogue_id: "0",
              unmatchedGold: 0,
              unmatchedPred: 0,
              matched: 1,
              averageWeightedF1: 1,
              comparisons: []
            }
          ]
        }}
      />
    );

    const list = screen.getByLabelText("Semantic dialogue list");
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([
      expect.stringContaining("Dialogue 1"),
      expect.stringContaining("Dialogue 0")
    ]);

    await userEvent.selectOptions(screen.getByLabelText("Dialogue sort"), "id");

    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([
      expect.stringContaining("Dialogue 0"),
      expect.stringContaining("Dialogue 1"),
    ]);
  });

  it("shows semantic versus soft semantic scoring differences after import", async () => {
    render(<SemanticEventAuditWorkbench dataset={dataset} />);

    await userEvent.click(screen.getByRole("tab", { name: "Semantic vs Soft" }));

    const scoreView = screen.getByLabelText("Semantic versus soft semantic scoring");
    expect(within(scoreView).getByText("Score difference overview")).toBeInTheDocument();
    expect(within(scoreView).getByText("Event semantic F1")).toBeInTheDocument();
    expect(within(scoreView).getByText("Soft semantic F1")).toBeInTheDocument();
    expect(within(scoreView).getByText("+0.2970")).toBeInTheDocument();
    expect(within(scoreView).getByText("same gold and lora pred events")).toBeInTheDocument();

    expect(within(scoreView).getByText("Dialogue score difference")).toBeInTheDocument();
    expect(within(scoreView).getByText("Dialogue 1")).toBeInTheDocument();
    expect(within(scoreView).getByText("event F1 avg 0.3750")).toBeInTheDocument();
    expect(within(scoreView).getByText("soft alignment avg 0.4800")).toBeInTheDocument();
    expect(within(scoreView).getByText("+0.1050")).toBeInTheDocument();

    expect(within(scoreView).getByText("Pair scoring difference")).toBeInTheDocument();
    expect(within(scoreView).getByText("Gold #2 <-> Lora #1")).toBeInTheDocument();
    expect(within(scoreView).getByText("event semantic F1 0.7500")).toBeInTheDocument();
    expect(within(scoreView).getByText("soft alignment 0.9600")).toBeInTheDocument();
    expect(within(scoreView).getByText("+0.2100")).toBeInTheDocument();
  });

  it("explains dialogue score differences with contributors, sorting, token highlights, and shared feedback", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    render(<SemanticEventAuditWorkbench dataset={dataset} />);

    await userEvent.click(screen.getByRole("tab", { name: "Semantic vs Soft" }));

    const scoreView = screen.getByLabelText("Semantic versus soft semantic scoring");
    await userEvent.click(
      within(scoreView).getByRole("button", {
        name: "Expand Dialogue 1 score contributors"
      })
    );

    expect(within(scoreView).getByText("Top contributors")).toBeInTheDocument();
    expect(within(scoreView).getByLabelText("Contributor sort")).toHaveValue("largest-gap");
    expect(
      within(scoreView).getByRole("button", {
        name: "Gold #2 <-> Lora #1 explanation delta +0.2100"
      })
    ).toBeInTheDocument();

    await userEvent.selectOptions(within(scoreView).getByLabelText("Contributor sort"), "unmatched-first");

    expect(within(scoreView).getByLabelText("Top contributors").textContent).toMatch(
      /Gold #1 <-> No pred match.*Gold #2 <-> Lora #1/s
    );

    await userEvent.selectOptions(within(scoreView).getByLabelText("Contributor sort"), "soft-gains");
    await userEvent.click(
      within(scoreView).getByRole("button", {
        name: "Gold #2 <-> Lora #1 explanation delta +0.2100"
      })
    );

    const evidence = within(scoreView).getByLabelText("Contributor evidence");
    expect(within(evidence).getByText("field explanation deltas")).toBeInTheDocument();
    expect(within(evidence).getByText("action strict F1 1.0000")).toBeInTheDocument();
    expect(within(evidence).getByText("soft alignment 0.8000")).toBeInTheDocument();
    expect(within(evidence).getByText("explanation delta -0.2000")).toBeInTheDocument();
    expect(within(evidence).getByText("dress -> new dress (0.9200)")).toBeInTheDocument();

    expect(
      within(evidence)
        .getAllByText("Sunday")
        .some((element) => element.classList.contains("strict-match"))
    ).toBe(true);
    expect(
      within(evidence)
        .getAllByText("new dress")
        .some((element) => element.classList.contains("soft-match"))
    ).toBe(true);

    await userEvent.type(
      within(evidence).getByLabelText(
        "Feedback for field action semantic judgment dialogue 1 gold 1 pred 0"
      ),
      "soft explanation is correct"
    );
    await userEvent.click(screen.getByRole("button", { name: "Copy feedback JSONL" }));

    expect(writeText.mock.calls[0][0]).toContain("soft explanation is correct");
  });
});
