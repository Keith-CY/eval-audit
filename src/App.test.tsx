import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import App from "./App";
import {
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "./test/fixtures";

async function makeZip(files: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], "artifact.zip", { type: "application/zip" });
}

async function makeEvaluationZip(): Promise<File> {
  return makeZip({
    "artifact/event_eval_summary.json": JSON.stringify(summaryFixture),
    "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAuditsFixture[0])}\n`,
    "artifact/event_eval_details.jsonl": `${JSON.stringify(rowAuditsFixture[0].events[0])}\n`,
    "artifact/model.jsonl": `${JSON.stringify(predictionRowsFixture[0])}\n`
  });
}

describe("App", () => {
  it("loads an evaluation zip and shows the workbench", async () => {
    render(<App />);

    await userEvent.upload(
      screen.getByLabelText("Upload evaluation zip"),
      await makeEvaluationZip()
    );

    expect(await screen.findByText("google_gemma_4_31B_it")).toBeInTheDocument();
    expect(screen.getAllByText("Dialogue 56")).toHaveLength(2);
  });

  it("loads a flat events JSONL file from the flat events tab", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("tab", { name: "Flat events JSONL" }));
    await userEvent.upload(
      screen.getByLabelText("Upload flat events JSONL"),
      new File(
        [
          [
            JSON.stringify({
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
            }),
            JSON.stringify({
              source: "base",
              dialogue_id: "1",
              outcome: "win",
              typed_score: 0.5,
              event_index: 1,
              source_order: 1,
              actor: ["speaker_2"],
              time: null,
              location: ["cinema"],
              action: ["movie"],
              digest: "speaker_2 cinema movie"
            })
          ].join("\n")
        ],
        "events.flat.jsonl",
        { type: "application/jsonl" }
      )
    );

    expect(await screen.findByText("events.flat.jsonl")).toBeInTheDocument();
    expect(screen.getAllByText("Dialogue 1")).toHaveLength(2);
    expect(screen.getAllByText("speaker_1").length).toBeGreaterThan(0);
    expect(screen.getByText("cinema")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show digest for gold event 1/i }));

    expect(document.querySelector(".flat-event-digest")?.textContent).toContain(
      "speaker_1 Friday movie"
    );
  });

  it("loads a flat events JSONL file dropped onto the flat events upload panel", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("tab", { name: "Flat events JSONL" }));

    fireEvent.drop(screen.getByRole("region", { name: "Upload flat events artifact" }), {
      dataTransfer: {
        files: [
          new File(
            [
              JSON.stringify({
                source: "gold",
                dialogue_id: "7",
                outcome: "tie",
                typed_score: null,
                event_index: 1,
                source_order: 1,
                actor: ["speaker_1"],
                time: ["Saturday"],
                location: null,
                action: ["dinner"],
                digest: "speaker_1 Saturday dinner"
              })
            ],
            "events.flat.jsonl",
            { type: "application/jsonl" }
          )
        ]
      }
    });

    expect(await screen.findByText("events.flat.jsonl")).toBeInTheDocument();
    expect(screen.getAllByText("Dialogue 7")).toHaveLength(2);
    expect(screen.getByText("Saturday")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show digest for gold event 1/i }));

    expect(document.querySelector(".flat-event-digest")?.textContent).toContain(
      "speaker_1 Saturday dinner"
    );
  });

  it("shows a readable error and keeps upload available when required files are missing", async () => {
    render(<App />);

    const input = screen.getByLabelText("Upload evaluation zip");
    await userEvent.upload(
      input,
      await makeZip({
        "artifact/event_eval_summary.json": JSON.stringify(summaryFixture)
      })
    );

    expect(await screen.findByText(/Missing required files/)).toBeInTheDocument();
    expect(screen.getByLabelText("Upload evaluation zip")).toBeEnabled();
  });
});
