import { render, screen } from "@testing-library/react";
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
