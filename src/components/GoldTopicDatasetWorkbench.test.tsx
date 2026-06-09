import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoldTopicDatasetWorkbench } from "./GoldTopicDatasetWorkbench";
import type { GoldTopicDataset } from "../domain/types";

const dataset: GoldTopicDataset = {
  artifact: "gold-topics.jsonl",
  summary: {
    totalCases: 2,
    totalMessages: 4,
    totalTopics: 3,
    averageMessagesPerCase: 2,
    averageTopicsPerCase: 1.5,
    casesWithWarnings: 1,
    casesWithAllowedUnassigned: 1,
    casesWithFallback: 1
  },
  warnings: [
    {
      code: "missing_message_reference",
      message: "Topic topic-a references missing message missing-msg"
    }
  ],
  cases: [
    {
      gold_case_id: "warning-case",
      source_dialogue_id: "dlg-2",
      source_conversation_id: "conv-2",
      expected_topic_count_range: [2, 2],
      allowed_duplicate_message_ids: [],
      allowed_fallback_reasons: ["empty_conversation"],
      expected_skip_or_fallback_reasons: ["empty_conversation"],
      allowed_unassigned_message_ids: ["msg-4"],
      forbidden_unassigned_message_ids: ["msg-3"],
      notes: ["generated"],
      slices: ["first10"],
      gold_version: "draft",
      case_weight: 1,
      attentionScore: 1200,
      attentionReasons: ["1 warning", "fallback", "allowed unassigned"],
      warnings: [
        {
          code: "missing_message_reference",
          message: "Topic topic-a references missing message missing-msg"
        }
      ],
      messages: [
        {
          message_id: "msg-3",
          sender: "C",
          text: "Complex message",
          timestamp: "2024-10-06T09:00:00",
          requiredTopicIds: ["topic-a", "topic-b"],
          isForbiddenUnassigned: true,
          isAllowedUnassigned: false
        },
        {
          message_id: "msg-4",
          sender: "D",
          text: "Allowed unassigned message",
          timestamp: "2024-10-06T09:01:00",
          requiredTopicIds: [],
          isForbiddenUnassigned: false,
          isAllowedUnassigned: true
        }
      ],
      topics: [
        {
          gold_topic_id: "topic-a",
          label: "Complex A",
          description: "Complex topic one",
          required_message_ids: ["msg-3", "missing-msg"],
          topic_weight: 1,
          boundary_mode: "strict",
          criticality: "normal",
          optional_bridge_message_ids: [],
          allowed_multi_topic_message_ids: [],
          may_merge_with: [],
          may_split_into: []
        },
        {
          gold_topic_id: "topic-b",
          label: "Complex B",
          description: "Complex topic two",
          required_message_ids: ["msg-3"],
          topic_weight: 1,
          boundary_mode: "strict",
          criticality: "normal",
          optional_bridge_message_ids: [],
          allowed_multi_topic_message_ids: [],
          may_merge_with: [],
          may_split_into: []
        }
      ]
    },
    {
      gold_case_id: "simple-case",
      source_dialogue_id: "dlg-1",
      source_conversation_id: "conv-1",
      expected_topic_count_range: [1, 1],
      allowed_duplicate_message_ids: [],
      allowed_fallback_reasons: [],
      expected_skip_or_fallback_reasons: [],
      allowed_unassigned_message_ids: [],
      forbidden_unassigned_message_ids: ["msg-1", "msg-2"],
      notes: [],
      slices: ["first10"],
      gold_version: "draft",
      case_weight: 1,
      attentionScore: 20,
      attentionReasons: [],
      warnings: [],
      messages: [
        {
          message_id: "msg-1",
          sender: "A",
          text: "First simple message",
          timestamp: "2024-10-05T09:00:00",
          requiredTopicIds: ["topic-1"],
          isForbiddenUnassigned: true,
          isAllowedUnassigned: false
        },
        {
          message_id: "msg-2",
          sender: "B",
          text: "Second simple message",
          timestamp: "2024-10-05T09:01:00",
          requiredTopicIds: [],
          isForbiddenUnassigned: true,
          isAllowedUnassigned: false
        }
      ],
      topics: [
        {
          gold_topic_id: "topic-1",
          label: "Simple",
          description: "Simple topic",
          required_message_ids: ["msg-1"],
          topic_weight: 1,
          boundary_mode: "strict",
          criticality: "normal",
          optional_bridge_message_ids: [],
          allowed_multi_topic_message_ids: [],
          may_merge_with: [],
          may_split_into: []
        }
      ]
    }
  ]
};

describe("GoldTopicDatasetWorkbench", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders summary, attention-sorted cases, matrix coverage, and message detail", () => {
    render(<GoldTopicDatasetWorkbench dataset={dataset} />);

    expect(screen.getByText("gold-topics.jsonl")).not.toBeNull();
    expect(screen.getByText("2 cases")).not.toBeNull();

    const caseButtons = screen.getAllByRole("button", { name: /case /i });
    expect(caseButtons.map((button) => button.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("warning-case")])
    );
    expect(caseButtons[0].textContent).toContain("warning-case");

    const matrix = screen.getByLabelText("Topic coverage matrix");
    expect(within(matrix).getByText("Complex A")).not.toBeNull();
    expect(within(matrix).getByLabelText("msg-3 required in Complex A")).not.toBeNull();
    expect(within(matrix).getByLabelText("msg-3 required in Complex B")).not.toBeNull();

    const detail = within(screen.getByLabelText("Gold topic message detail"));
    expect(detail.getByText("Complex message")).not.toBeNull();
    expect(detail.getByText("blocked unassigned")).not.toBeNull();
    expect(detail.getByText("Complex A")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /select message msg-4/i }));
    expect(detail.getByText("Allowed unassigned message")).not.toBeNull();
    expect(detail.getByText("allowed unassigned")).not.toBeNull();
  });

  it("stores case and message notes, exports JSONL, and clears notes after confirmation", () => {
    const createObjectUrl = vi.fn(() => "blob:notes");
    const revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl
    });
    vi.spyOn(document, "createElement");
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<GoldTopicDatasetWorkbench dataset={dataset} />);

    const exportButton = screen.getByRole("button", { name: "Export notes JSONL" });
    expect(exportButton).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Case note"), {
      target: { value: "Case note" }
    });
    fireEvent.change(screen.getByLabelText("Message note"), {
      target: { value: "Message note" }
    });

    expect(screen.getByLabelText("2 notes")).not.toBeNull();
    expect(exportButton).toHaveProperty("disabled", false);

    fireEvent.click(exportButton);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Clear notes" }));
    expect(window.confirm).toHaveBeenCalledWith("Clear all notes for this dataset?");
    expect(screen.getByLabelText("0 notes")).not.toBeNull();
    expect(screen.getByLabelText("Case note")).toHaveProperty("value", "");
    expect(screen.getByLabelText("Message note")).toHaveProperty("value", "");
    expect(exportButton).toHaveProperty("disabled", true);
  });
});
