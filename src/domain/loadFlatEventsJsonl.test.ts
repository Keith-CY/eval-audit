import { describe, expect, it } from "vitest";
import { loadFlatEventsJsonl } from "./loadFlatEventsJsonl";

function makeFlatEventsFile(lines: unknown[], name = "events.flat.jsonl"): File {
  return new File([lines.map((line) => JSON.stringify(line)).join("\n") + "\n"], name, {
    type: "application/jsonl"
  });
}

describe("loadFlatEventsJsonl", () => {
  it("groups flat event rows by dialogue and source", async () => {
    const dataset = await loadFlatEventsJsonl(
      makeFlatEventsFile([
        {
          source: "gold",
          dialogue_id: "2",
          outcome: "loss",
          typed_score: null,
          event_index: 1,
          source_order: 1,
          actor: ["speaker_1"],
          time: ["today"],
          location: null,
          action: ["work"],
          digest: "speaker_1 works today"
        },
        {
          source: "base",
          dialogue_id: "2",
          outcome: "loss",
          typed_score: 0.25,
          event_index: 1,
          source_order: 1,
          actor: ["speaker_2"],
          time: null,
          location: ["office"],
          action: ["wait"],
          digest: "speaker_2 waits at the office"
        },
        {
          source: "lora",
          dialogue_id: "1",
          outcome: "win",
          typed_score: 0.75,
          event_index: 2,
          source_order: 2,
          actor: ["speaker_1"],
          time: ["tomorrow"],
          location: null,
          action: ["movie"],
          digest: "speaker_1 plans a movie"
        }
      ])
    );

    expect(dataset.artifact).toBe("events.flat.jsonl");
    expect(dataset.sources).toEqual(["gold", "base", "lora"]);
    expect(dataset.totalEvents).toBe(3);
    expect(dataset.sourceCounts).toEqual({ base: 1, gold: 1, lora: 1 });
    expect(dataset.dialogues.map((dialogue) => dialogue.dialogue_id)).toEqual(["1", "2"]);
    expect(dataset.dialogues[1].eventsBySource.gold?.[0].digest).toBe("speaker_1 works today");
    expect(dataset.dialogues[1].typedScores).toEqual({ base: 0.25, gold: null });
  });

  it("reports the source line for malformed rows", async () => {
    await expect(
      loadFlatEventsJsonl(
        new File([`{"source":"gold","dialogue_id":"1"}\n{"source":4}\n`], "bad.jsonl")
      )
    ).rejects.toThrow("bad.jsonl line 2");
  });
});
