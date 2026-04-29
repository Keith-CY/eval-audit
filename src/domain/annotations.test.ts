import { beforeEach, describe, expect, it, vi } from "vitest";
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
  event_notes: [],
  updated_at: "2026-04-29T00:00:00.000Z"
};

const eventNote = {
  event_key: "unmatched_gold:0:none:0",
  event_index: 0,
  match_status: "unmatched_gold",
  gold_event_index: 0,
  pred_event_index: null,
  note: "gold event needs manual review"
};

describe("annotations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

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

  it("returns an empty map when localStorage cannot be read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage locked");
    });

    expect(loadAnnotations("google_gemma_4_31B_it")).toEqual({});
  });

  it("returns an empty map when stored JSON is not an annotation record", () => {
    localStorage.setItem(annotationStorageKey("null_artifact"), "null");
    localStorage.setItem(annotationStorageKey("array_artifact"), JSON.stringify([annotation]));

    expect(loadAnnotations("null_artifact")).toEqual({});
    expect(loadAnnotations("array_artifact")).toEqual({});
  });

  it("drops invalid stored annotation entries while preserving valid entries", () => {
    localStorage.setItem(
      annotationStorageKey("google_gemma_4_31B_it"),
      JSON.stringify({
        "56": annotation,
        bad_status: { ...annotation, dialogue_id: "57", review_status: "done" },
        bad_note: { ...annotation, dialogue_id: "58", review_note: null },
        bad_row: { ...annotation, dialogue_id: "59", row_index: "0" },
        bad_entry: null
      })
    );

    expect(loadAnnotations("google_gemma_4_31B_it")).toEqual({ "56": annotation });
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

  it("reports failed saves and clears without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage locked");
    });

    expect(saveAnnotations("google_gemma_4_31B_it", { "56": annotation })).toBe(false);
    expect(clearAnnotations("google_gemma_4_31B_it")).toBe(false);
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

  it("does not export unreviewed annotations with whitespace-only notes", () => {
    expect(
      getExportableAnnotations({
        "56": { ...annotation, review_status: "unreviewed", review_note: "   " }
      })
    ).toEqual([]);
  });

  it("exports annotations when an event note changes", () => {
    const eventOnlyAnnotation = {
      ...annotation,
      review_status: "unreviewed" as const,
      review_note: "",
      event_notes: [eventNote]
    };

    expect(getExportableAnnotations({ "56": eventOnlyAnnotation })).toEqual([
      eventOnlyAnnotation
    ]);
  });

  it("sorts exportable annotations by row index then dialogue id", () => {
    const row10: Annotation = { ...annotation, dialogue_id: "2", row_index: 10 };
    const row2b: Annotation = { ...annotation, dialogue_id: "b", row_index: 2 };
    const row2a: Annotation = { ...annotation, dialogue_id: "a", row_index: 2 };

    expect(
      getExportableAnnotations({
        "2": row10,
        b: row2b,
        a: row2a
      })
    ).toEqual([row2a, row2b, row10]);
  });

  it("adds row context, event notes, and exported_at to JSONL export", () => {
    const jsonl = exportAnnotations({
      annotations: { "56": { ...annotation, event_notes: [eventNote] } },
      rowsByDialogueId: new Map([["56", rowAuditsFixture[0]]]),
      exportedAt: "2026-04-29T00:00:00.000Z"
    });

    expect(jsonl).toBe(
      '{"artifact":"google_gemma_4_31B_it","dialogue_id":"56","row_index":0,"review_status":"has_issue","review_note":"模型没有抽出事件","event_notes":[{"event_key":"unmatched_gold:0:none:0","event_index":0,"match_status":"unmatched_gold","gold_event_index":0,"pred_event_index":null,"note":"gold event needs manual review"}],"gold_event_count":1,"pred_event_count":0,"matched_events":0,"unmatched_gold":1,"unmatched_pred":0,"exported_at":"2026-04-29T00:00:00.000Z"}\n'
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
