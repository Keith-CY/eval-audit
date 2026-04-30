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

async function makeZip(files: Record<string, string>, filename = "artifact.zip"): Promise<File> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], filename, { type: "application/zip" });
}

interface EvaluationZipOptions {
  artifact?: string;
  weightedF1?: number;
  predDigest?: string | null;
}

async function makeEvaluationZip(options: EvaluationZipOptions = {}): Promise<File> {
  const artifact = options.artifact ?? summaryFixture.artifact;
  const weightedF1 = options.weightedF1 ?? rowAuditsFixture[0].events[0].weighted_f1;
  const predDigest = options.predDigest ?? null;
  const rowAudit = JSON.parse(JSON.stringify(rowAuditsFixture[0]));
  const event = rowAudit.events[0];
  const prediction = JSON.parse(JSON.stringify(predictionRowsFixture[0]));

  rowAudit.dialogue_id = "56";
  rowAudit.row_index = 0;
  event.artifact = artifact;
  event.weighted_f1 = weightedF1;

  if (predDigest) {
    const predEvent = {
      actor: ["speaker_1"],
      time: ["8点"],
      location: null,
      action: ["起床"],
      digest: predDigest
    };

    rowAudit.pred_event_count = 1;
    rowAudit.matched_events = 1;
    rowAudit.unmatched_gold = 0;
    rowAudit.unmatched_pred = 0;
    event.match_status = "matched";
    event.pred_event_index = 0;
    event.pred_event = predEvent;
    prediction.events = [predEvent];
  }

  return makeZip(
    {
      "artifact/event_eval_summary.json": JSON.stringify({ ...summaryFixture, artifact }),
      "artifact/row_audit_report.jsonl": `${JSON.stringify(rowAudit)}\n`,
      "artifact/event_eval_details.jsonl": `${JSON.stringify(event)}\n`,
      "artifact/model.jsonl": `${JSON.stringify(prediction)}\n`
    },
    `${artifact}.zip`
  );
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

  it("loads an evaluation zip dropped onto the upload panel", async () => {
    render(<App />);

    fireEvent.drop(screen.getByRole("region", { name: "Upload evaluation artifact" }), {
      dataTransfer: {
        files: [await makeEvaluationZip()]
      }
    });

    expect(await screen.findByText("google_gemma_4_31B_it")).toBeInTheDocument();
    expect(screen.getAllByText("Dialogue 56")).toHaveLength(2);
  });

  it("loads multiple evaluation zips and switches between evaluation tabs", async () => {
    render(<App />);

    await userEvent.upload(screen.getByLabelText("Upload evaluation zip"), [
      await makeEvaluationZip({ artifact: "eval_one" }),
      await makeEvaluationZip({
        artifact: "eval_two",
        weightedF1: 1,
        predDigest: "speaker_18点起床"
      })
    ]);

    expect(await screen.findByRole("tab", { name: /eval_one/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /eval_two/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All results/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /eval_two/ }));

    expect(screen.getByRole("heading", { name: "eval_two" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /eval_two/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("shows gold and every evaluation result for the selected dialogue", async () => {
    render(<App />);

    await userEvent.upload(screen.getByLabelText("Upload evaluation zip"), [
      await makeEvaluationZip({ artifact: "eval_one" }),
      await makeEvaluationZip({
        artifact: "eval_two",
        weightedF1: 1,
        predDigest: "speaker_18点起床"
      })
    ]);

    await userEvent.click(await screen.findByRole("tab", { name: /All results/ }));

    expect(screen.getByRole("heading", { name: "Dialogue 56" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gold" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Eval 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Eval 2" })).toBeInTheDocument();
    expect(screen.getAllByText("speaker_18点起床")).toHaveLength(2);
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
