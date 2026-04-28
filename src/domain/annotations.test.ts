import { beforeEach, describe, expect, it } from "vitest";
import { rowAuditsFixture } from "../test/fixtures";
import {
  annotationStorageKey,
  clearAnnotations,
  exportAnnotations,
  getExportableAnnotations,
  loadAnnotations,
  saveAnnotations
} from "./annotations";
import type { Annotation } from "./types";

const annotation: Annotation = {
  artifact: "google_gemma_4_31B_it",
  dialogue_id: "56",
  row_index: 0,
  review_status: "has_issue",
  review_note: "模型没有抽出事件",
  updated_at: "2026-04-29T00:00:00.000Z"
};

describe("annotations", () => {
  beforeEach(() => localStorage.clear());

  it("scopes localStorage keys by artifact", () => {
    expect(annotationStorageKey("google_gemma_4_31B_it")).toBe(
      "evaluation-review:google_gemma_4_31B_it:annotations"
    );
  });

  it("saves and loads annotations", () => {
    saveAnnotations("google_gemma_4_31B_it", { "56": annotation });

    expect(loadAnnotations("google_gemma_4_31B_it")).toEqual({ "56": annotation });
  });

  it("returns an empty map when stored JSON is invalid", () => {
    localStorage.setItem(annotationStorageKey("google_gemma_4_31B_it"), "{invalid");

    expect(loadAnnotations("google_gemma_4_31B_it")).toEqual({});
  });

  it("clears annotations for the current artifact", () => {
    saveAnnotations("google_gemma_4_31B_it", { "56": annotation });
    saveAnnotations("other_artifact", {
      "56": { ...annotation, artifact: "other_artifact" }
    });

    clearAnnotations("google_gemma_4_31B_it");

    expect(loadAnnotations("google_gemma_4_31B_it")).toEqual({});
    expect(loadAnnotations("other_artifact")).toEqual({
      "56": { ...annotation, artifact: "other_artifact" }
    });
  });

  it("exports only changed annotations", () => {
    const untouched: Annotation = {
      ...annotation,
      dialogue_id: "57",
      review_status: "unreviewed",
      review_note: ""
    };

    expect(getExportableAnnotations({ "56": annotation, "57": untouched })).toEqual([
      annotation
    ]);
  });

  it("adds row context and exported_at to JSONL export", () => {
    const jsonl = exportAnnotations({
      annotations: { "56": annotation },
      rowsByDialogueId: new Map([["56", rowAuditsFixture[0]]]),
      exportedAt: "2026-04-29T00:00:00.000Z"
    });

    expect(jsonl).toBe(
      '{"artifact":"google_gemma_4_31B_it","dialogue_id":"56","row_index":0,"review_status":"has_issue","review_note":"模型没有抽出事件","gold_event_count":1,"pred_event_count":0,"matched_events":0,"unmatched_gold":1,"unmatched_pred":0,"exported_at":"2026-04-29T00:00:00.000Z"}\n'
    );
  });

  it("returns an empty string when there are no exportable annotations", () => {
    const jsonl = exportAnnotations({
      annotations: {
        "56": { ...annotation, review_status: "unreviewed", review_note: "" }
      },
      rowsByDialogueId: new Map([["56", rowAuditsFixture[0]]]),
      exportedAt: "2026-04-29T00:00:00.000Z"
    });

    expect(jsonl).toBe("");
  });
});
