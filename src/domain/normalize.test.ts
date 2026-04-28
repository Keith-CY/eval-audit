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

  it("preserves prediction-only rows after audited rows", () => {
    const predictionOnlyEvent: ExtractedEvent = {
      actor: ["speaker_2"],
      time: ["9点"],
      location: null,
      action: ["出门"],
      digest: "prediction-only-event"
    };

    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: rowAuditsFixture,
      eventDetails: rowAuditsFixture[0].events,
      predictionRows: [
        ...predictionRowsFixture,
        {
          dialogue_id: "57",
          dialogue: ["speaker_2:我 9 点 出门"],
          events: [predictionOnlyEvent]
        }
      ],
      failures: [
        ...failuresFixture,
        {
          dialogue_id: "57",
          line_number: 2,
          event_index: 0,
          reason: "late prediction"
        }
      ]
    });

    expect(dataset.dialogues.map((dialogue) => dialogue.dialogue_id)).toEqual(["56", "57"]);
    expect(dataset.dialogues[1]).toMatchObject({
      row_index: 1,
      dialogue_id: "57",
      dialogue: ["speaker_2:我 9 点 出门"],
      goldEvents: [],
      predEvents: [predictionOnlyEvent],
      rowAudit: null,
      failure: { reason: "late prediction" }
    });
    expect(dataset.warnings).toContain("1 prediction row has no matching row audit record.");
  });

  it("uses event details when row audit events are empty", () => {
    const supplementalEvent = {
      ...rowAuditsFixture[0].events[0],
      weighted_f1: 0.5,
      pred_event: {
        actor: ["speaker_1"],
        time: ["8点"],
        location: null,
        action: ["起床"],
        digest: "supplemental-prediction"
      }
    };
    const auditWithoutEvents = { ...rowAuditsFixture[0], events: [] };

    const dataset = normalizeDataset({
      summary: summaryFixture,
      rowAudits: [auditWithoutEvents],
      eventDetails: [supplementalEvent],
      predictionRows: [],
      failures: []
    });

    expect(dataset.dialogues[0].rowAudit?.events).toEqual([supplementalEvent]);
    expect(dataset.dialogues[0].goldEvents).toEqual([supplementalEvent.gold_event]);
    expect(dataset.dialogues[0].predEvents).toEqual([supplementalEvent.pred_event]);
  });
});
