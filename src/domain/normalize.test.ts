import { describe, expect, it } from "vitest";
import type { ExtractedEvent } from "./types";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { normalizeDataset } from "./normalize";

describe("normalizeDataset", () => {
  it("joins prediction rows, row audits, and failures by dialogue id", () => {
    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: rowAuditsFixture,
      eventDetails: rowAuditsFixture[0].events,
      predictionRows: predictionRowsFixture,
      failures: failuresFixture
    });

    expect(dataset.artifact).toBe("google_gemma_4_31B_it");
    expect(dataset.dialogues).toHaveLength(1);
    expect(dataset.dialogues[0]).toMatchObject({
      dialogue_id: "56",
      row_index: 0,
      dialogue: ["speaker_1:我 8 点 起床", "speaker_2:sad"],
      rowAudit: { gold_event_count: 1, pred_event_count: 0 },
      failure: { reason: "remote provider HTTP 504" }
    });
    expect(dataset.dialogues[0].goldEvents).toHaveLength(1);
    expect(dataset.dialogues[0].predEvents).toHaveLength(0);
  });

  it("adds a warning when row audit and prediction records do not align", () => {
    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: rowAuditsFixture,
      eventDetails: [],
      predictionRows: [],
      failures: []
    });

    expect(dataset.warnings).toContain("1 row audit record has no matching prediction row.");
    expect(dataset.dialogues[0].dialogue_id).toBe("56");
  });

  it("uses prediction row events for predicted events when present", () => {
    const predictedEvent: ExtractedEvent = {
      actor: ["speaker_1"],
      time: ["8点"],
      location: [],
      action: ["醒来"],
      digest: "prediction-row-event"
    };

    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: rowAuditsFixture,
      eventDetails: rowAuditsFixture[0].events,
      predictionRows: [{ ...predictionRowsFixture[0], events: [predictedEvent] }],
      failures: []
    });

    expect(dataset.dialogues[0].predEvents).toEqual([predictedEvent]);
  });
});
