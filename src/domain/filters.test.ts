import { describe, expect, it } from "vitest";
import { failuresFixture, rowAuditsFixture } from "../test/fixtures";
import { filterDialogues } from "./filters";
import type { DialogueReview, RowAudit } from "./types";

const dialogue: DialogueReview = {
  row_index: 0,
  dialogue_id: "56",
  dialogue: ["speaker_1:我 8 点 起床"],
  goldEvents: [],
  predEvents: [],
  rowAudit: rowAuditsFixture[0],
  failure: null
};

function dialogueWith(rowAudit: RowAudit | null): DialogueReview {
  return {
    ...dialogue,
    rowAudit,
    failure: null
  };
}

describe("filterDialogues", () => {
  it("filters by dialogue id search text", () => {
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: {},
        search: "56",
        reviewStatus: "all",
        evaluationStatus: "all"
      })
    ).toHaveLength(1);
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: {},
        search: "99",
        reviewStatus: "all",
        evaluationStatus: "all"
      })
    ).toHaveLength(0);
  });

  it("filters by review status and evaluation status", () => {
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: {
          "56": {
            artifact: "a",
            dialogue_id: "56",
            row_index: 0,
            review_status: "accepted",
            review_note: "",
            event_notes: [],
            updated_at: "now"
          }
        },
        search: "",
        reviewStatus: "accepted",
        evaluationStatus: "unmatched_gold"
      })
    ).toHaveLength(1);
  });

  it("treats dialogues without annotations as unreviewed", () => {
    expect(
      filterDialogues({
        dialogues: [dialogue],
        annotations: {},
        search: "",
        reviewStatus: "unreviewed",
        evaluationStatus: "all"
      })
    ).toEqual([dialogue]);
  });

  it("matches failures even when row audit data is absent", () => {
    const failedPredictionOnlyDialogue: DialogueReview = {
      ...dialogue,
      rowAudit: null,
      failure: failuresFixture[0]
    };

    expect(
      filterDialogues({
        dialogues: [failedPredictionOnlyDialogue],
        annotations: {},
        search: "",
        reviewStatus: "all",
        evaluationStatus: "failure"
      })
    ).toEqual([failedPredictionOnlyDialogue]);
  });

  it("does not match zero prediction for rows without audit data", () => {
    const predictionOnlyDialogue = dialogueWith(null);

    expect(
      filterDialogues({
        dialogues: [predictionOnlyDialogue],
        annotations: {},
        search: "",
        reviewStatus: "all",
        evaluationStatus: "zero_prediction"
      })
    ).toEqual([]);
  });

  it("filters audited dialogues by evaluation status", () => {
    const fullyMatched = {
      ...rowAuditsFixture[0],
      dialogue_id: "57",
      gold_event_count: 1,
      pred_event_count: 1,
      matched_events: 1,
      unmatched_gold: 0,
      unmatched_pred: 0
    };
    const unmatchedPrediction = {
      ...rowAuditsFixture[0],
      dialogue_id: "58",
      gold_event_count: 0,
      pred_event_count: 1,
      matched_events: 0,
      unmatched_gold: 0,
      unmatched_pred: 1
    };
    const zeroPrediction = rowAuditsFixture[0];

    const dialogues = [
      { ...dialogueWith(fullyMatched), dialogue_id: "57" },
      { ...dialogueWith(unmatchedPrediction), dialogue_id: "58" },
      { ...dialogueWith(zeroPrediction), dialogue_id: "56" }
    ];

    expect(
      filterDialogues({
        dialogues,
        annotations: {},
        search: "",
        reviewStatus: "all",
        evaluationStatus: "fully_matched"
      }).map((item) => item.dialogue_id)
    ).toEqual(["57"]);
    expect(
      filterDialogues({
        dialogues,
        annotations: {},
        search: "",
        reviewStatus: "all",
        evaluationStatus: "unmatched_prediction"
      }).map((item) => item.dialogue_id)
    ).toEqual(["58"]);
    expect(
      filterDialogues({
        dialogues,
        annotations: {},
        search: "",
        reviewStatus: "all",
        evaluationStatus: "zero_prediction"
      }).map((item) => item.dialogue_id)
    ).toEqual(["56"]);
  });
});
