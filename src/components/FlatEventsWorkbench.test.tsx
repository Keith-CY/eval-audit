import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlatEventsWorkbench } from "./FlatEventsWorkbench";
import type { FlatEventsDataset } from "../domain/types";

const dataset: FlatEventsDataset = {
  artifact: "events.flat.jsonl",
  totalEvents: 3,
  sources: ["base", "gold", "lora"],
  sourceCounts: { base: 1, gold: 1, lora: 1 },
  outcomeCounts: { win: 3 },
  warnings: [],
  dialogues: [
    {
      dialogue_id: "1",
      outcome: "win",
      outcomes: ["win"],
      typedScores: { base: 0.3, gold: null, lora: 0.7 },
      totalEvents: 3,
      eventsBySource: {
        base: [
          {
            source: "base",
            dialogue_id: "1",
            outcome: "win",
            typed_score: 0.3,
            event_index: 1,
            source_order: 1,
            actor: ["speaker_2"],
            time: null,
            location: ["parking"],
            action: ["moviegoer"],
            digest: "base hidden parking"
          }
        ],
        gold: [
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
            digest: "gold hidden parking"
          }
        ],
        lora: [
          {
            source: "lora",
            dialogue_id: "1",
            outcome: "win",
            typed_score: 0.7,
            event_index: 1,
            source_order: 1,
            actor: ["speaker_1"],
            time: ["Friday"],
            location: null,
            action: ["movie"],
            digest: "lora shared movie"
          }
        ]
      }
    }
  ]
};

describe("FlatEventsWorkbench", () => {
  it("renders comparison sources in gold, base, lora order", () => {
    render(<FlatEventsWorkbench dataset={dataset} />);

    const sourceLabels = within(screen.getByLabelText("Flat event detail"))
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-label"));

    expect(sourceLabels).toEqual(["gold events", "base events", "lora events"]);
  });

  it("shows detailed fields first and expands digest on click", () => {
    render(<FlatEventsWorkbench dataset={dataset} />);

    expect(screen.getAllByText("actor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("speaker_1").length).toBeGreaterThan(0);
    expect(screen.queryByText("gold shared movie")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show digest for gold event 1/i }));

    expect(screen.getByText("gold hidden parking")).toBeInTheDocument();
  });

  it("highlights matching words across visible event fields on hover", () => {
    render(<FlatEventsWorkbench dataset={dataset} />);

    fireEvent.mouseEnter(screen.getByLabelText("gold event 1"));

    const highlightedWords = Array.from(document.querySelectorAll("mark")).map((mark) =>
      mark.textContent
    );
    expect(highlightedWords.filter((word) => word === "movie").length).toBeGreaterThanOrEqual(2);
    expect(highlightedWords).not.toContain("moviegoer");
    expect(highlightedWords).not.toContain("parking");
  });

  it("highlights visible field overlaps symmetrically when the hovered value is longer", () => {
    render(
      <FlatEventsWorkbench
        dataset={{
          ...dataset,
          dialogues: [
            {
              dialogue_id: "1",
              outcome: "win",
              outcomes: ["win"],
              typedScores: { base: 0.3, gold: null, lora: 0.7 },
              totalEvents: 2,
              eventsBySource: {
                gold: [
                  {
                    source: "gold",
                    dialogue_id: "1",
                    outcome: "win",
                    typed_score: null,
                    event_index: 1,
                    source_order: 1,
                    actor: ["speaker_1"],
                    time: ["周五"],
                    location: null,
                    action: ["暂定看电影"],
                    digest: "digest is ignored"
                  }
                ],
                base: [
                  {
                    source: "base",
                    dialogue_id: "1",
                    outcome: "win",
                    typed_score: 0.3,
                    event_index: 1,
                    source_order: 1,
                    actor: ["speaker_2"],
                    time: ["五"],
                    location: null,
                    action: ["看电影"],
                    digest: "digest is ignored"
                  }
                ]
              }
            }
          ]
        }}
      />
    );

    fireEvent.mouseEnter(screen.getByLabelText("gold event 1"));

    const highlightedWords = Array.from(document.querySelectorAll("mark")).map((mark) =>
      mark.textContent
    );
    expect(highlightedWords.filter((word) => word === "看电影").length).toBeGreaterThanOrEqual(2);
    expect(highlightedWords.filter((word) => word === "五").length).toBeGreaterThanOrEqual(2);
  });
});
