import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizeDataset } from "../domain/normalize";
import type { DialogueReview, ReviewDataset, RowAudit } from "../domain/types";
import {
  failuresFixture,
  predictionRowsFixture,
  rowAuditsFixture,
  summaryFixture
} from "../test/fixtures";
import { Workbench } from "./Workbench";

function dataset(overrides: Partial<ReviewDataset> = {}): ReviewDataset {
  const normalized = normalizeDataset({
    summary: summaryFixture,
    rowAudits: rowAuditsFixture,
    eventDetails: rowAuditsFixture[0].events,
    predictionRows: predictionRowsFixture,
    failures: failuresFixture
  });

  return { ...normalized, ...overrides };
}

function fullyMatchedDialogue(): DialogueReview {
  const base = dataset().dialogues[0];
  const rowAudit: RowAudit = {
    ...(base.rowAudit as RowAudit),
    row_index: 1,
    dialogue_id: "57",
    gold_event_count: 1,
    pred_event_count: 1,
    matched_events: 1,
    unmatched_gold: 0,
    unmatched_pred: 0,
    events:
      base.rowAudit?.events.map((event) => ({
        ...event,
        row_index: 1,
        dialogue_id: "57",
        match_status: "matched" as const,
        weighted_f1: 1
      })) ?? []
  };

  return {
    ...base,
    row_index: 1,
    dialogue_id: "57",
    dialogue: ["speaker_9:完全 匹配"],
    rowAudit,
    failure: null
  };
}

function twoDialogueDataset(): ReviewDataset {
  const base = dataset();
  return {
    ...base,
    dialogues: [base.dialogues[0], fullyMatchedDialogue()]
  };
}

describe("Workbench", () => {
  beforeEach(() => localStorage.clear());

  it("renders summary metrics, dialogue text, event comparison, and failure reason", () => {
    render(<Workbench dataset={dataset()} />);

    expect(screen.getByText("36.5%")).toBeInTheDocument();
    expect(screen.getByText("speaker_1:我 8 点 起床")).toBeInTheDocument();
    expect(screen.getByText("unmatched_gold")).toBeInTheDocument();
    expect(screen.getByText("remote provider HTTP 504")).toBeInTheDocument();
  });

  it("saves a dialogue annotation and counts it as exportable", async () => {
    render(<Workbench dataset={dataset()} />);

    await userEvent.selectOptions(screen.getByLabelText("Review status"), "has_issue");
    await userEvent.type(screen.getByLabelText("Review note"), "需要复核");

    expect(screen.getByText("Exportable annotations: 1")).toBeInTheDocument();
  });

  it("keeps export disabled until an annotation status or note changes", async () => {
    render(<Workbench dataset={dataset()} />);

    const exportButton = screen.getByRole("button", { name: /Export JSONL/i });
    expect(exportButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Review note"), "note only");

    expect(screen.getByText("Exportable annotations: 1")).toBeInTheDocument();
    expect(exportButton).toBeEnabled();
  });

  it("clears the current annotation back to unreviewed with no exportable records", async () => {
    render(<Workbench dataset={dataset()} />);

    await userEvent.selectOptions(screen.getByLabelText("Review status"), "has_issue");
    await userEvent.type(screen.getByLabelText("Review note"), "needs review");
    expect(screen.getByText("Exportable annotations: 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Clear current/i }));

    expect(screen.getByLabelText("Review status")).toHaveValue("unreviewed");
    expect(screen.getByLabelText("Review note")).toHaveValue("");
    expect(screen.getByText("Exportable annotations: 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export JSONL/i })).toBeDisabled();
  });

  it("updates the visible list and active detail when filters change", async () => {
    render(<Workbench dataset={twoDialogueDataset()} />);

    await userEvent.selectOptions(
      screen.getByLabelText("Evaluation status filter"),
      "fully_matched"
    );

    const list = screen.getByLabelText("Dialogue list");
    expect(within(list).queryByText("Dialogue 56")).not.toBeInTheDocument();
    expect(within(list).getByText("Dialogue 57")).toBeInTheDocument();
    expect(screen.getByText("speaker_9:完全 匹配")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search dialogue id"), "missing");

    expect(within(list).queryByText("Dialogue 57")).not.toBeInTheDocument();
    expect(screen.getByText("No dialogues match the current filters")).toBeInTheDocument();
  });

  it("renders dataset warnings in a warning strip", () => {
    render(<Workbench dataset={dataset({ warnings: ["Optional failures file was skipped."] })} />);

    const warningStrip = screen.getByRole("status", { name: "Dataset warnings" });
    expect(warningStrip).toHaveTextContent("Optional failures file was skipped.");
  });
});
